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
    const requestedUnitType = url.searchParams.get("unitType");
    const userUnitType = (session.user as any).unitType as string | undefined;
    const roleName = session.user.role;
    const hasManageAll = session.user.permissions?.includes("manage_all");

    // Role check: anggota tidak boleh akses stats
    if (roleName === "anggota") {
        return NextResponse.json({ message: "Akses ditolak." }, { status: 403 });
    }

    // Unit isolation: non-operator hanya lihat unit sendiri
    let unitType: string;
    if (hasManageAll) {
        unitType = requestedUnitType || userUnitType || "";
    } else {
        unitType = userUnitType || "";
        if (requestedUnitType && requestedUnitType !== unitType) {
            return NextResponse.json({ message: "Anda tidak memiliki akses ke unit ini." }, { status: 403 });
        }
    }

    if (!unitType) {
        return NextResponse.json({ message: "unitType diperlukan" }, { status: 400 });
    }

    try {
        const now = new Date();

        // ── Timezone WIB (+7) ─────────────────────────────────────────────────
        // Server berjalan di UTC. Saat 01:31 WIB = 18:31 UTC (masih 'kemarin' UTC).
        // Kita harus pakai tanggal WIB agar "hari ini" sesuai dengan yang user lihat.
        const WIB_OFFSET = 7 * 60 * 60 * 1000; // +7 jam dalam milidetik
        const nowWIB = new Date(now.getTime() + WIB_OFFSET);
        const localYear = nowWIB.getUTCFullYear();
        const localMonth = nowWIB.getUTCMonth();
        const localDate = nowWIB.getUTCDate();

        // Hari ini di WIB: dari 00:00 WIB (= 17:00 UTC hari sebelumnya) sampai 00:00 WIB besok
        // Untuk StoreSale (DateTime) — pakai epoch UTC yang mewakili jam 00:00 WIB
        const todayStartWIB = new Date(Date.UTC(localYear, localMonth, localDate) - WIB_OFFSET);
        const todayEndWIB = new Date(todayStartWIB.getTime() + 86400000);

        // Untuk UnitTransaction (@db.Date) — Prisma simpan sebagai pure date UTC.
        // transactionDate '2026-04-07' disimpan sebagai 2026-04-07T00:00:00.000Z.
        // Kita query dengan batas UTC yang mewakili tanggal WIB yang sama.
        const todayDateUTC = new Date(Date.UTC(localYear, localMonth, localDate));
        const tomorrowDateUTC = new Date(todayDateUTC.getTime() + 86400000);

        const weekStartUTC = new Date(todayDateUTC);
        weekStartUTC.setUTCDate(weekStartUTC.getUTCDate() - 6);
        
        const weekStartWIB = new Date(todayStartWIB);
        weekStartWIB.setUTCDate(weekStartWIB.getUTCDate() - 6);

        // Today's transactions for this unit (@db.Date)
        const todayTrx = await prisma.unitTransaction.findMany({
            where: {
                unitType,
                transactionDate: { gte: todayDateUTC, lt: tomorrowDateUTC },
                status: { notIn: ["voided"] }, // exclude voided dari semua hitungan
            },
            select: { amount: true, paymentMethod: true, isPaid: true, status: true },
        });

        // Also count StoreSale for toko unit
        const rawTodayStoreSales = unitType === "toko" ? await prisma.storeSale.findMany({
            where: {
                unitType,
                createdAt: { gte: todayStartWIB, lt: todayEndWIB },
            },
            select: { totalAmount: true, paymentMethod: true, metadata: true },
        }) : [];
        
        const todayStoreSales = rawTodayStoreSales.filter(sale => {
            const meta = typeof sale.metadata === 'string' ? JSON.parse(sale.metadata) : sale.metadata || {};
            return !meta.isVoided;
        });

        // ── KPI Calculations (consistent: Total = Cash + QRIS + SalaryCut) ────
        const todayCash = todayTrx.filter(t => t.paymentMethod === "cash").reduce((s, t) => s + Number(t.amount), 0)
            + todayStoreSales.filter(s => s.paymentMethod === "cash").reduce((s, t) => s + Number(t.totalAmount), 0);
        const todayQris = todayTrx.filter(t => t.paymentMethod === "qris").reduce((s, t) => s + Number(t.amount), 0)
            + todayStoreSales.filter(s => s.paymentMethod === "qris").reduce((s, t) => s + Number(t.totalAmount), 0);
        // Hanya hitung potong gaji yang bukan pending_void (sudah exclude voided di query)
        const todaySalaryCut = todayTrx.filter(t => t.paymentMethod === "salary_cut" && t.status !== "pending_void")
            .reduce((s, t) => s + Number(t.amount), 0)
            + todayStoreSales.filter(s => s.paymentMethod === "salary_cut")
            .reduce((s, t) => s + Number(t.totalAmount), 0);
        // Total = Cash + QRIS + SalaryCut (konsisten, tidak include transaksi yang tidak terkategori)
        const todayTotal = todayCash + todayQris + todaySalaryCut;
        const todayCount = todayTrx.length + todayStoreSales.length;
        // Pending = tagihan aktif (belum lunas, bukan void)
        const todayPending = todayTrx.filter(t => !t.isPaid && t.status !== "pending_void").length;
        // Pending Void = menunggu approval
        const todayPendingVoid = todayTrx.filter(t => t.status === "pending_void").length;

        // Weekly chart data (last 7 days)
        // Group manually by date string to avoid timezone/timestamp grouping issues from Prisma
        const weeklyUnitTrx = await prisma.unitTransaction.findMany({
            where: { unitType, transactionDate: { gte: weekStartUTC, lt: tomorrowDateUTC }, status: { notIn: ["voided"] } },
            select: { transactionDate: true, amount: true },
        });
        
        const weeklyStoreTrxRaw = unitType === "toko" ? await prisma.storeSale.findMany({
            where: { unitType, createdAt: { gte: weekStartWIB, lt: todayEndWIB } },
            select: { createdAt: true, totalAmount: true, metadata: true },
        }) : [];
        
        const weeklyStoreTrx = weeklyStoreTrxRaw.filter(sale => {
            const meta = typeof sale.metadata === 'string' ? JSON.parse(sale.metadata) : sale.metadata || {};
            return !meta.isVoided;
        });

        const weeklyChartMap = new Map();
        for (let i = 0; i < 7; i++) {
            const dUTC = new Date(weekStartUTC);
            dUTC.setUTCDate(dUTC.getUTCDate() + i);
            // Format as YYYY-MM-DD (UTC date = WIB date since we correctly shifted)
            const dStr = dUTC.toISOString().slice(0, 10);
            weeklyChartMap.set(dStr, { date: dUTC, total: 0, count: 0 });
        }

        weeklyUnitTrx.forEach(t => {
            const dUtc = new Date(t.transactionDate);
            // Pada UnitTransaction (@db.Date), date disimpan sebagai UTC midnight = tanggal WIB yang sama
            const key = dUtc.toISOString().slice(0, 10); // YYYY-MM-DD
            const entry = weeklyChartMap.get(key);
            if (entry) {
                entry.total += Number(t.amount);
                entry.count += 1;
            }
        });

        weeklyStoreTrx.forEach(t => {
            // StoreSale (DateTime) — geser ke WIB lalu ambil tanggalnya
            const dWIB = new Date(new Date(t.createdAt).getTime() + WIB_OFFSET);
            const key = dWIB.toISOString().slice(0, 10); // YYYY-MM-DD WIB
            const entry = weeklyChartMap.get(key);
            if (entry) {
                entry.total += Number(t.totalAmount);
                entry.count += 1;
            }
        });

        const weeklyChart = Array.from(weeklyChartMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());

        // QRIS is no longer loaded here — it's fetched on-demand from /api/unit-layanan/qris
        // This avoids shipping a 2.7MB base64 string on every stats call.

        // Recent transactions (last 10 combined)
        const recentUnitTrx = await prisma.unitTransaction.findMany({
            where: { unitType },
            orderBy: { transactionDate: "desc" },
            take: 10,
            select: {
                id: true, transactionNo: true, amount: true,
                paymentMethod: true, description: true, transactionDate: true,
                createdAt: true, // DateTime lengkap untuk display jam
                isPaid: true, member: { select: { name: true } },
            },
        });

        let allRecent = recentUnitTrx.map(t => ({
            id: Number(t.id),
            no: t.transactionNo,
            amount: Number(t.amount),
            method: t.paymentMethod,
            desc: t.description,
            date: t.createdAt, // pakai createdAt agar jam akurat, bukan transactionDate yang hanya tanggal
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
