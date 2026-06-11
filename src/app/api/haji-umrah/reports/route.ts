import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

const HAJI_UMRAH_TYPES = ["tabungan_haji", "tabungan_umrah"];

// GET /api/haji-umrah/reports — Rekap & laporan tabungan haji/umrah
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const reportType = searchParams.get("type") || "rekap"; // rekap | progress | admin_fee
        const dateFrom = searchParams.get("dateFrom");
        const dateTo = searchParams.get("dateTo");
        const productType = searchParams.get("productType"); // tabungan_haji | tabungan_umrah

        const types = productType ? [productType] : HAJI_UMRAH_TYPES;

        const dateFilter = dateFrom && dateTo ? {
            transactionDate: {
                gte: new Date(dateFrom),
                lte: new Date(dateTo),
            },
        } : {};

        if (reportType === "rekap") {
            // Rekap all accounts
            const accounts = await prisma.savingsAccount.findMany({
                where: {
                    product: { type: { in: types }, deletedAt: null },
                    status: "active",
                },
                include: {
                    member: { select: { id: true, memberNo: true, name: true, nrp: true } },
                    product: true,
                },
                orderBy: { createdAt: "desc" },
            });

            const totalSaldo = accounts.reduce((sum, a) => sum + Number(a.balance), 0);
            const totalTarget = accounts.reduce((sum, a) => sum + Number(a.targetAmount ?? a.product.targetAmount ?? 0), 0);

            return NextResponse.json({
                data: accounts.map((a) => ({
                    accountNo: a.accountNo,
                    memberName: a.member.name,
                    memberNrp: a.member.nrp,
                    productType: a.product.type,
                    productName: a.product.name,
                    balance: Number(a.balance),
                    target: Number(a.targetAmount ?? a.product.targetAmount ?? 0),
                    progress: Number(a.targetAmount ?? a.product.targetAmount ?? 0) > 0
                        ? Math.round((Number(a.balance) / Number(a.targetAmount ?? a.product.targetAmount)) * 10000) / 100
                        : 0,
                    monthlyTarget: Number(a.monthlyTarget ?? 0),
                    openedDate: a.openedDate,
                    maturityDate: a.maturityDate,
                })),
                summary: {
                    totalAccounts: accounts.length,
                    totalSaldo,
                    totalTarget,
                    globalProgress: totalTarget > 0 ? Math.round((totalSaldo / totalTarget) * 10000) / 100 : 0,
                },
            });
        }

        if (reportType === "admin_fee") {
            // Admin fee revenue report
            const fees = await prisma.cashBankTransaction.findMany({
                where: {
                    category: "pendapatan_unit",
                    unitType: "haji_umrah",
                    type: "in",
                    ...dateFilter,
                },
                orderBy: { transactionDate: "desc" },
            });

            const totalFee = fees.reduce((sum, f) => sum + Number(f.amount), 0);

            return NextResponse.json({
                data: fees.map((f) => ({
                    transactionNo: f.transactionNo,
                    amount: Number(f.amount),
                    description: f.description,
                    transactionDate: f.transactionDate,
                })),
                summary: {
                    totalTransactions: fees.length,
                    totalAdminFee: totalFee,
                },
            });
        }

        // Default: progress report — used by dashboard page
        const accounts = await prisma.savingsAccount.findMany({
            where: {
                product: { type: { in: types }, deletedAt: null },
                status: "active",
            },
            include: {
                member: { select: { name: true, nrp: true } },
                product: true,
            },
        });

        const totalSaldo = accounts.reduce((sum, a) => sum + Number(a.balance), 0);
        const totalTarget = accounts.reduce((sum, a) => sum + Number(a.targetAmount ?? a.product.targetAmount ?? 0), 0);
        const globalProgress = totalTarget > 0 ? Math.round((totalSaldo / totalTarget) * 10000) / 100 : 0;

        const nearTarget = accounts.filter((a) => {
            const target = Number(a.targetAmount ?? a.product.targetAmount ?? 0);
            return target > 0 && Number(a.balance) >= target * 0.8;
        });

        const reachedTarget = accounts.filter((a) => {
            const target = Number(a.targetAmount ?? a.product.targetAmount ?? 0);
            return target > 0 && Number(a.balance) >= target;
        });

        // Monthly deposits — find product IDs first since aggregate doesn't support relation filters
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const hajiUmrahProductIds = (await prisma.savingsProduct.findMany({
            where: { type: { in: types }, deletedAt: null },
            select: { id: true },
        })).map(p => p.id);
        const monthlyDepositsResult = await prisma.savingsTransaction.aggregate({
            _sum: { amount: true },
            where: {
                type: "deposit",
                status: "completed",
                productId: { in: hajiUmrahProductIds },
                transactionDate: { gte: startOfMonth },
            },
        });
        const monthlyDeposits = Number(monthlyDepositsResult._sum.amount ?? 0);

        // Recent 5 accounts opened
        const recentAccounts = accounts
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 5)
            .map((a) => ({
                accountNo: a.accountNo,
                memberName: a.member.name,
                productType: a.product.type,
                balance: Number(a.balance),
                target: Number(a.targetAmount ?? a.product.targetAmount ?? 0),
                progress: Number(a.targetAmount ?? a.product.targetAmount ?? 0) > 0
                    ? Math.round((Number(a.balance) / Number(a.targetAmount ?? a.product.targetAmount)) * 100)
                    : 0,
                openedDate: a.openedDate,
            }));

        // Admin fee revenue this month
        const adminFeeThisMonth = await prisma.cashBankTransaction.aggregate({
            _sum: { amount: true },
            where: {
                category: "pendapatan_unit",
                unitType: "haji_umrah",
                type: "in",
                transactionDate: { gte: startOfMonth },
            },
        });
        const adminFeeRevenue = Number(adminFeeThisMonth._sum.amount ?? 0);

        return NextResponse.json({
            data: {
                totalAccounts: accounts.length,
                totalSaldo,
                totalTarget,
                globalProgress,
                monthlyDeposits,
                adminFeeRevenue,
                nearTarget: nearTarget.length,
                reachedTarget: reachedTarget.length,
                recentAccounts,
                nearTargetAccounts: nearTarget.map((a) => ({
                    memberName: a.member.name,
                    balance: Number(a.balance),
                    target: Number(a.targetAmount ?? a.product.targetAmount ?? 0),
                    progress: Math.round((Number(a.balance) / Number(a.targetAmount ?? a.product.targetAmount ?? 1)) * 100),
                })),
            },
        });
    } catch (error) {
        console.error("GET /api/haji-umrah/reports error:", error);
        return NextResponse.json({ message: "Failed to generate report" }, { status: 500 });
    }
}
