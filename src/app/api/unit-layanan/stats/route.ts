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
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(todayStart.getTime() + 86400000);

        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - 6);
        weekStart.setHours(0, 0, 0, 0);

        // Today's transactions for this unit
        const todayTrx = await prisma.unitTransaction.findMany({
            where: {
                unitType,
                transactionDate: { gte: todayStart, lt: todayEnd },
            },
            select: { amount: true, paymentMethod: true, isPaid: true },
        });

        // Also count StoreSale for toko unit
        const todayStoreSales = unitType === "toko" ? await prisma.storeSale.findMany({
            where: {
                unitType,
                createdAt: { gte: todayStart, lt: todayEnd },
            },
            select: { totalAmount: true, paymentMethod: true },
        }) : [];

        const todayTotal = todayTrx.reduce((s, t) => s + Number(t.amount), 0)
            + todayStoreSales.reduce((s, t) => s + Number(t.totalAmount), 0);
        const todayCount = todayTrx.length + todayStoreSales.length;
        const todayCash = todayTrx.filter(t => t.paymentMethod === "cash").reduce((s, t) => s + Number(t.amount), 0)
            + todayStoreSales.filter(s => s.paymentMethod === "cash").reduce((s, t) => s + Number(t.totalAmount), 0);
        const todayQris = todayTrx.filter(t => t.paymentMethod === "qris").reduce((s, t) => s + Number(t.amount), 0)
            + todayStoreSales.filter(s => s.paymentMethod === "qris").reduce((s, t) => s + Number(t.totalAmount), 0);
        const todaySalaryCut = todayTrx.filter(t => t.paymentMethod === "salary_cut").reduce((s, t) => s + Number(t.amount), 0);
        const todayPending = todayTrx.filter(t => !t.isPaid).length;

        // Weekly chart data (last 7 days)
        // Group manually by date string to avoid timezone/timestamp grouping issues from Prisma
        const weeklyUnitTrx = await prisma.unitTransaction.findMany({
            where: { unitType, transactionDate: { gte: weekStart, lt: todayEnd } },
            select: { transactionDate: true, amount: true },
        });
        
        const weeklyStoreTrx = unitType === "toko" ? await prisma.storeSale.findMany({
            where: { unitType, createdAt: { gte: weekStart, lt: todayEnd } },
            select: { createdAt: true, totalAmount: true },
        }) : [];

        const weeklyChartMap = new Map();
        for (let i = 0; i < 7; i++) {
            const d = new Date(weekStart);
            d.setDate(d.getDate() + i);
            d.setHours(0,0,0,0);
            weeklyChartMap.set(d.getTime(), { date: d, total: 0, count: 0 });
        }

        weeklyUnitTrx.forEach(t => {
            const d = new Date(t.transactionDate);
            d.setHours(0,0,0,0);
            const entry = weeklyChartMap.get(d.getTime());
            if (entry) {
                entry.total += Number(t.amount);
                entry.count += 1;
            }
        });

        weeklyStoreTrx.forEach(t => {
            const d = new Date(t.createdAt);
            d.setHours(0,0,0,0);
            const entry = weeklyChartMap.get(d.getTime());
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
                    member: { select: { name: true } },
                },
            });
            
            allRecent = [
                ...allRecent,
                ...recentStoreTrx.map(t => ({
                    id: t.id + 1000000, // offset id to avoid frontend key collisions
                    no: t.saleNo,
                    amount: Number(t.totalAmount),
                    method: t.paymentMethod,
                    desc: `Penjualan Toko ${t.paymentMethod === 'salary_cut' ? '(Potong Gaji)' : ''}`,
                    date: t.createdAt,
                    isPaid: t.paymentMethod !== "salary_cut",
                    memberName: t.member?.name || t.customerName || null,
                }))
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
