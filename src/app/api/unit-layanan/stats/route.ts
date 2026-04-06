import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/unit-layanan/stats?unitType=xxx
// Returns today's + weekly stats for a specific unit (for kasir/admin dashboard)
export async function GET(request: Request) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const unitType = url.searchParams.get("unitType") || (session.user as any).unitType;

    if (!unitType) {
        return NextResponse.json({ message: "unitType diperlukan" }, { status: 400 });
    }

    try {
        const now = new Date();
        const localYear = now.getFullYear();
        const localMonth = now.getMonth();
        const localDate = now.getDate();

        // Bagi type StoreSale (DateTime): Gunakan object Date Javascript biasa (local timezone 00:00)
        const todayStart = new Date(localYear, localMonth, localDate);
        const todayEnd = new Date(todayStart.getTime() + 86400000);

        // Bagi tipe @db.Date (UnitTransaction): Prisma mengekstrak yyyy-mm-dd dalam UTC.
        // Jika pakai JS Date biasa, pukul 00:00 WIB terbaca sebagai 17:00 UTC h-1 (misal 5 April).
        // Sehingga query `< hari ini` menjadi `< '2026-04-05'`, alhasil transaksi hari ini (6 Apr) TIDAK termuat!
        // Solusinya: Paksa construct jam 00:00 murni di UTC.
        const todayDateUTC = new Date(Date.UTC(localYear, localMonth, localDate));
        const tomorrowDateUTC = new Date(todayDateUTC.getTime() + 86400000);

        const weekStartUTC = new Date(todayDateUTC);
        weekStartUTC.setDate(weekStartUTC.getDate() - 6);
        
        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - 6);

        // Today's transactions for this unit (@db.Date)
        const todayTrx = await prisma.unitTransaction.findMany({
            where: {
                unitType,
                transactionDate: { gte: todayDateUTC, lt: tomorrowDateUTC },
            },
            select: { amount: true, paymentMethod: true, isPaid: true, status: true },
        });

        // Also count StoreSale for toko unit
        const rawTodayStoreSales = unitType === "toko" ? await prisma.storeSale.findMany({
            where: {
                unitType,
                createdAt: { gte: todayStart, lt: todayEnd },
            },
            select: { totalAmount: true, paymentMethod: true, metadata: true },
        }) : [];
        
        const todayStoreSales = rawTodayStoreSales.filter(sale => {
            const meta = typeof sale.metadata === 'string' ? JSON.parse(sale.metadata) : sale.metadata || {};
            return !meta.isVoided;
        });

        const todayTotal = todayTrx.reduce((s, t) => s + Number(t.amount), 0)
            + todayStoreSales.reduce((s, t) => s + Number(t.totalAmount), 0);
        const todayCount = todayTrx.length + todayStoreSales.length;
        const todayCash = todayTrx.filter(t => t.paymentMethod === "cash").reduce((s, t) => s + Number(t.amount), 0)
            + todayStoreSales.filter(s => s.paymentMethod === "cash").reduce((s, t) => s + Number(t.totalAmount), 0);
        const todayQris = todayTrx.filter(t => t.paymentMethod === "qris").reduce((s, t) => s + Number(t.amount), 0)
            + todayStoreSales.filter(s => s.paymentMethod === "qris").reduce((s, t) => s + Number(t.totalAmount), 0);
        // Hanya hitung potong gaji yg belum lunas DAN bukan pending_void/voided
        const todaySalaryCut = todayTrx.filter(t => t.paymentMethod === "salary_cut" && t.status !== "voided" && t.status !== "pending_void")
            .reduce((s, t) => s + Number(t.amount), 0);
        // Pending = tagihan aktif (belum lunas, bukan void)
        const todayPending = todayTrx.filter(t => !t.isPaid && t.status !== "voided" && t.status !== "pending_void").length;
        // Pending Void = menunggu approval
        const todayPendingVoid = todayTrx.filter(t => t.status === "pending_void").length;

        // Weekly chart data (last 7 days)
        // Group manually by date string to avoid timezone/timestamp grouping issues from Prisma
        const weeklyUnitTrx = await prisma.unitTransaction.findMany({
            where: { unitType, transactionDate: { gte: weekStartUTC, lt: tomorrowDateUTC } },
            select: { transactionDate: true, amount: true },
        });
        
        const weeklyStoreTrxRaw = unitType === "toko" ? await prisma.storeSale.findMany({
            where: { unitType, createdAt: { gte: weekStart, lt: todayEnd } },
            select: { createdAt: true, totalAmount: true, metadata: true },
        }) : [];
        
        const weeklyStoreTrx = weeklyStoreTrxRaw.filter(sale => {
            const meta = typeof sale.metadata === 'string' ? JSON.parse(sale.metadata) : sale.metadata || {};
            return !meta.isVoided;
        });

        const weeklyChartMap = new Map();
        for (let i = 0; i < 7; i++) {
            const dLocal = new Date(weekStart);
            dLocal.setDate(dLocal.getDate() + i);
            const key = `${dLocal.getFullYear()}-${dLocal.getMonth()}-${dLocal.getDate()}`;
            weeklyChartMap.set(key, { date: dLocal, total: 0, count: 0 });
        }

        weeklyUnitTrx.forEach(t => {
            const dUtc = new Date(t.transactionDate);
            // Pada UnitTransacion (@db.Date), data yg ditarik Prisma biasanya dalam UTC murni misal 00:00:00Z.
            // Gunakan UTC date method agar cocok dengan key lokal kita.
            const key = `${dUtc.getUTCFullYear()}-${dUtc.getUTCMonth()}-${dUtc.getUTCDate()}`;
            const entry = weeklyChartMap.get(key);
            if (entry) {
                entry.total += Number(t.amount);
                entry.count += 1;
            }
        });

        weeklyStoreTrx.forEach(t => {
            const d = new Date(t.createdAt);
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            const entry = weeklyChartMap.get(key);
            if (entry) {
                entry.total += Number(t.totalAmount);
                entry.count += 1;
            }
        });

        const weeklyChart = Array.from(weeklyChartMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());

        // Recent transactions (last 10 combined)
        const recentUnitTrx = await prisma.unitTransaction.findMany({
            where: { unitType },
            orderBy: { transactionDate: "desc" },
            take: 10,
            select: {
                id: true, transactionNo: true, amount: true,
                paymentMethod: true, description: true, transactionDate: true,
                isPaid: true, member: { select: { name: true } },
            },
        });

        let allRecent = recentUnitTrx.map(t => ({
            id: Number(t.id),
            no: t.transactionNo,
            amount: Number(t.amount),
            method: t.paymentMethod,
            desc: t.description,
            date: t.transactionDate,
            isPaid: t.isPaid,
            memberName: t.member?.name ?? null,
        }));

        if (unitType === "toko") {
            const recentStoreTrx = await prisma.storeSale.findMany({
                where: { unitType },
                orderBy: { createdAt: "desc" },
                take: 10,
                select: {
                    id: true, saleNo: true, totalAmount: true,
                    paymentMethod: true, customerName: true, createdAt: true,
                    metadata: true,
                    member: { select: { name: true } },
                },
            });
            
            allRecent = [
                ...allRecent,
                ...recentStoreTrx.map(t => {
                    const meta = typeof t.metadata === 'string' ? JSON.parse(t.metadata) : t.metadata || {};
                    const isVoided = meta.isVoided === true;
                    return {
                        id: t.id + 1000000, // offset id to avoid frontend key collisions
                        no: t.saleNo,
                        amount: Number(t.totalAmount),
                        method: t.paymentMethod,
                        desc: `Penjualan Toko ${t.paymentMethod === 'salary_cut' ? '(Potong Gaji)' : ''} ${isVoided ? '[DIBATALKAN]' : ''}`,
                        date: t.createdAt,
                        isPaid: isVoided ? false : (t.paymentMethod !== "salary_cut"),
                        memberName: t.member?.name || t.customerName || null,
                    };
                })
            ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 10);
        }

        const unitLabel: Record<string, string> = {
            toko: "Toko PRIMKOPPOL",
            cuci_mobil: "Cuci Mobil",
            barbershop: "Barbershop",
            fitness: "Fitness",
            playstation: "Playstation",
            resto_cafe: "Resto & Cafe",
            fotocopy: "Fotocopy",
            laundry: "Laundry",
            simpan_pinjam: "Simpan Pinjam",
        };

        return NextResponse.json({
            data: {
                unit: unitLabel[unitType] || unitType,
                unitType,
                today: {
                    total: todayTotal,
                    count: todayCount,
                    cash: todayCash,
                    qris: todayQris,
                    salaryCut: todaySalaryCut,
                    pending: todayPending,
                    pendingVoid: todayPendingVoid,
                },
                weeklyChart: weeklyChart.map(g => ({
                    date: g.date.toLocaleDateString("id-ID", { weekday: "short", day: "numeric" }),
                    total: g.total,
                    count: g.count,
                })),
                recentTransactions: allRecent,
            }
        });
    } catch (error) {
        console.error("GET /api/unit-layanan/stats error:", error);
        return NextResponse.json({ message: "Gagal memuat statistik unit" }, { status: 500 });
    }
}
