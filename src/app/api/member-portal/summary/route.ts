import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getCarwashBonusPerTx } from "@/lib/services/shu-settings";

// GET /api/member-portal/summary - Get member's complete summary
export async function GET() {
    try {
        const session = await auth();
        if (!session?.user || !session.user.memberId) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const memberId = session.user.memberId;

        // Get member info
        const member = await prisma.member.findUnique({
            where: { id: memberId },
            include: {
                branch: true,
            },
        });

        if (!member) {
            return NextResponse.json({ message: "Member not found" }, { status: 404 });
        }

        // Get savings accounts with balances
        const savingsAccounts = await prisma.savingsAccount.findMany({
            where: { memberId, status: "active" },
            include: {
                product: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        type: true,
                        targetAmount: true,
                        linkedBankName: true,
                    },
                },
                transactions: {
                    select: {
                        id: true,
                        type: true,
                        amount: true,
                        notes: true,
                        transactionDate: true,
                    },
                    orderBy: { transactionDate: "asc" },
                },
            },
        });

        const totalSavings = savingsAccounts.reduce(
            (sum, acc) => sum + Number(acc.balance),
            0
        );

        // Get active loans
        const loans = await prisma.loan.findMany({
            where: { memberId },
            select: {
                id: true,
                loanNo: true,
                principalAmount: true,
                principalPaid: true,
                interestPaid: true,
                principalOutstanding: true,
                interestOutstanding: true,
                monthlyInstallment: true,
                tenorMonths: true,
                status: true,
                disbursementDate: true,
                firstDueDate: true,
                lastDueDate: true,
                paidOffDate: true,
            },
        });

        const activeLoans = loans.filter((l) => l.status === "active");
        const totalOutstanding = activeLoans.reduce(
            (sum, l) => sum + Number(l.principalOutstanding) + Number(l.interestOutstanding),
            0
        );

        // Get unit transactions summary — fetch extra to allow for dedup filtering
        const unitTransactionsRaw = await prisma.unitTransaction.findMany({
            where: { memberId },
            orderBy: { transactionDate: "desc" },
            take: 20,
            select: {
                id: true, transactionNo: true, unitType: true, description: true,
                amount: true, transactionDate: true, isPaid: true, paidDate: true,
                status: true, paymentMethod: true, notes: true,
            },
        });

        // Dedup: exclude auto-generated salary_cut piutang (StoreSale already represents them)
        const unitTransactions = unitTransactionsRaw.filter(t => {
            if (t.paymentMethod === "salary_cut" && t.notes?.startsWith("Auto-generated dari penjualan kasir")) {
                return false;
            }
            return true;
        });

        // Fetch StoreSale for dashboard history (filter voided in JS — Prisma JSON filter
        // excludes rows where metadata is null, which is most sales)
        const storeSaleTxsRaw = await prisma.storeSale.findMany({
            where: { memberId },
            orderBy: { createdAt: "desc" },
            take: 15,
            select: {
                id: true, saleNo: true, unitType: true, totalAmount: true,
                createdAt: true, paymentMethod: true, metadata: true,
                items: { select: { product: { select: { name: true } }, quantity: true } },
            },
        });
        const storeSaleTxs = storeSaleTxsRaw.filter(s => !(s.metadata?.isVoided === true));

        const paymentLabels: Record<string, string> = { cash: "Tunai", qris: "QRIS", salary_cut: "Potong Gaji" };

        // Merge UnitTransaction + StoreSale into unified recent list
        const mergedRecent = [
            ...unitTransactions.map(t => ({
                id: t.id,
                transactionNo: t.transactionNo,
                unitType: t.unitType,
                description: t.description,
                amount: Number(t.amount),
                transactionDate: t.transactionDate,
                isPaid: t.isPaid,
                status: t.status,
                paymentMethod: t.paymentMethod,
                source: 'unit' as const,
            })),
            ...storeSaleTxs.map(s => {
                const itemDesc = s.items.map(i => `${i.product?.name || "[Produk Dihapus]"} x${i.quantity}`).join(', ');
                return {
                    id: s.id + 100000, // offset to avoid ID clash in frontend keys
                    transactionNo: s.saleNo,
                    unitType: s.unitType || 'toko',
                    description: itemDesc || 'Belanja Toko',
                    amount: Number(s.totalAmount),
                    transactionDate: s.createdAt,
                    isPaid: s.paymentMethod !== "salary_cut",
                    status: 'completed',
                    paymentMethod: s.paymentMethod,
                    source: 'store' as const,
                };
            }),
        ].sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime()).slice(0, 10);

        // Stats: combine both tables — exclude auto-generated salary_cut from UnitTransaction stats
        // (StoreSale already represents those transactions)
        const unitStats = await prisma.unitTransaction.groupBy({
            by: ["unitType"],
            where: {
                memberId,
                status: { not: "voided" },
                NOT: {
                    paymentMethod: "salary_cut",
                    notes: { startsWith: "Auto-generated dari penjualan kasir" },
                },
            },
            _sum: { amount: true },
            _count: { id: true },
        });

        // FIX: Use findMany to filter voided sales
        const storeStatsRaw = await prisma.storeSale.findMany({
            where: { memberId },
            select: { unitType: true, totalAmount: true, metadata: true },
        });

        // Merge stats by unitType
        const statsMap = new Map<string, { totalAmount: number; count: number }>();
        for (const s of unitStats) {
            const key = s.unitType;
            const exist = statsMap.get(key) || { totalAmount: 0, count: 0 };
            exist.totalAmount += Number(s._sum.amount || 0);
            exist.count += s._count.id;
            statsMap.set(key, exist);
        }
        for (const s of storeStatsRaw) {
            // Skip voided
            if (s.metadata) {
                const meta = typeof s.metadata === "object" ? s.metadata : JSON.parse(s.metadata as string);
                if ((meta as any).isVoided) continue;
            }
            const key = s.unitType;
            const exist = statsMap.get(key) || { totalAmount: 0, count: 0 };
            exist.totalAmount += Number(s.totalAmount || 0);
            exist.count += 1;
            statsMap.set(key, exist);
        }
        const mergedStats = Array.from(statsMap.entries()).map(([unitType, v]) => ({ unitType, ...v }));

        // Unpaid piutang: exclude auto-generated salary_cut (StoreSale handles those)
        const unpaidUnitTotal = await prisma.unitTransaction.aggregate({
            where: {
                memberId,
                isPaid: false,
                status: { not: "voided" },
                NOT: {
                    paymentMethod: "salary_cut",
                    notes: { startsWith: "Auto-generated dari penjualan kasir" },
                },
            },
            _sum: { amount: true },
            _count: { id: true },
        });

        // Count salary_cut StoreSales as unpaid piutang (filter voided in JS)
        const unpaidStoreSalesRaw = await prisma.storeSale.findMany({
            where: { memberId, paymentMethod: "salary_cut" },
            select: { totalAmount: true, metadata: true },
        });
        const unpaidStoreSales = unpaidStoreSalesRaw.filter(s => !(s.metadata?.isVoided === true));
        const unpaidStoreAmount = unpaidStoreSales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
        const unpaidStoreCount = unpaidStoreSales.length;

        const totalUnpaidAmount = Number(unpaidUnitTotal._sum.amount || 0) + unpaidStoreAmount;
        const totalUnpaidCount = unpaidUnitTotal._count.id + unpaidStoreCount;
        const year = new Date().getFullYear();
        const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
        const endDate = new Date(`${year}-12-31T23:59:59.999Z`);

        // Optimized: Use SQL aggregation instead of loading all sales into memory
        const [sysTokoAgg, sysUnit, sysLoanInt, myTokoAgg, myUnit, myLoan] = await Promise.all([
            // System-wide toko: SUM of non-voided sales
            prisma.$queryRaw<{ member_total: number; non_member_total: number }[]>`
                SELECT
                    COALESCE(SUM(CASE WHEN member_id IS NOT NULL THEN total_amount ELSE 0 END), 0)::float as member_total,
                    COALESCE(SUM(CASE WHEN member_id IS NULL THEN total_amount ELSE 0 END), 0)::float as non_member_total
                FROM store_sales
                WHERE created_at >= ${startDate} AND created_at <= ${endDate}
                  AND (metadata IS NULL OR (metadata->>'isVoided')::boolean IS NOT TRUE)
            `,
            prisma.unitTransaction.aggregate({ where: { transactionDate: { gte: startDate, lte: endDate }, isPaid: true, status: { not: "voided" } }, _sum: { amount: true } }),
            prisma.loanPayment.aggregate({ where: { paymentDate: { gte: startDate, lte: endDate } }, _sum: { interestPortion: true } }),
            // My toko contributions
            prisma.$queryRaw<{ total: number }[]>`
                SELECT COALESCE(SUM(total_amount), 0)::float as total
                FROM store_sales
                WHERE member_id = ${memberId}
                  AND created_at >= ${startDate} AND created_at <= ${endDate}
                  AND (metadata IS NULL OR (metadata->>'isVoided')::boolean IS NOT TRUE)
            `,
            prisma.unitTransaction.aggregate({ where: { memberId, transactionDate: { gte: startDate, lte: endDate }, status: { not: "voided" } }, _sum: { amount: true } }),
            prisma.loan.aggregate({ where: { memberId, disbursementDate: { gte: startDate, lte: endDate } }, _sum: { totalAmount: true } }),
        ]);

        const sysTokoMemberTotal = sysTokoAgg[0]?.member_total ?? 0;
        const sysTokoNonMemberTotal = sysTokoAgg[0]?.non_member_total ?? 0;
        const myTokoTotal = myTokoAgg[0]?.total ?? 0;

        // Income calculation
        const memberIncome = sysTokoMemberTotal + Number(sysUnit._sum.amount || 0) + Number(sysLoanInt._sum.interestPortion || 0);
        const nonMemberIncome = sysTokoNonMemberTotal;
        const totalIncome = memberIncome + nonMemberIncome;
        const totalExpense = totalIncome * 0.4;
        const totalNetSurplus = totalIncome - totalExpense;

        // --- System-Wide Savings Capital via SQL (replaces loading ALL members into JS) ---
        const [savingsCapitalAgg, legacyWajibAgg, mySavingsAgg] = await Promise.all([
            // Total pokok + wajib from savings_accounts
            prisma.$queryRaw<{ total: number }[]>`
                SELECT COALESCE(SUM(sa.balance), 0)::float as total
                FROM savings_accounts sa
                JOIN savings_products sp ON sa.product_id = sp.id
                WHERE sa.status = 'active'
                  AND sp.type IN ('pokok', 'wajib')
            `,
            // Legacy tabungan_wajib for members WITHOUT imported wajib savings account
            prisma.$queryRaw<{ total: number }[]>`
                SELECT COALESCE(SUM(m.tabungan_wajib), 0)::float as total
                FROM members m
                WHERE m.status = 'active' AND m.deleted_at IS NULL
                  AND NOT EXISTS (
                    SELECT 1 FROM savings_accounts sa
                    JOIN savings_products sp ON sa.product_id = sp.id
                    WHERE sa.member_id = m.id AND sp.type = 'wajib'
                  )
                  AND m.tabungan_wajib > 0
            `,
            // This member's pokok + wajib savings
            prisma.$queryRaw<{ total: number; has_wajib: boolean }[]>`
                SELECT
                    COALESCE(SUM(sa.balance), 0)::float as total,
                    BOOL_OR(sp.type = 'wajib') as has_wajib
                FROM savings_accounts sa
                JOIN savings_products sp ON sa.product_id = sp.id
                WHERE sa.member_id = ${memberId}
                  AND sa.status = 'active'
                  AND sp.type IN ('pokok', 'wajib')
            `,
        ]);

        let totalSysSavings = (savingsCapitalAgg[0]?.total ?? 0) + (legacyWajibAgg[0]?.total ?? 0);
        let mySavCont = mySavingsAgg[0]?.total ?? 0;
        // Legacy fallback: if member has no imported wajib account, use tabunganWajib
        if (!mySavingsAgg[0]?.has_wajib && member.tabunganWajib) {
            mySavCont += Number(member.tabunganWajib);
        }

        totalSysSavings = totalSysSavings || 1;
        const totalSavingsCapital = totalSysSavings;

        // --- Jasa Simpanan Pool (20%) ---
        // Based on TOTAL koperasi surplus
        const jasaModalPool = Math.max(0, totalNetSurplus * 0.20);

        // --- Jasa Anggota Pool (25%) — AD-ART Pasal 42 POOL METHOD ---
        // Pool = 25% × Laba Bersih, distributed by member's transaction share
        const jasaUsahaPool = Math.max(0, totalNetSurplus * 0.25);

        // 1. Calculate Jasa Modal (Proportional Pool by savings capital)
        const myModal = (mySavCont / totalSysSavings) * jasaModalPool;

        // 2. Calculate Jasa Usaha (Pool Method: proportional by transaction volume)
        const totalMemberTxVolume = sysTokoMemberTotal + Number(sysUnit._sum.amount || 0) + Number(sysLoanInt._sum.interestPortion || 0);

        // My transaction volume
        const myTokoVolume = myTokoTotal;
        const myUnitVolume = Number(myUnit._sum.amount || 0);
        const myLoanInterestAgg = await prisma.loanPayment.aggregate({
            where: { memberId, paymentDate: { gte: startDate, lte: endDate } },
            _sum: { interestPortion: true }
        });
        const myLoanVolume = Number(myLoanInterestAgg._sum.interestPortion || 0);
        const myTotalVolume = myTokoVolume + myUnitVolume + myLoanVolume;

        // My share of the pool = (my volume / total volume) × pool
        const myUsaha = totalMemberTxVolume > 0 ? (myTotalVolume / totalMemberTxVolume) * jasaUsahaPool : 0;
        const jasaUsahaPercent = totalMemberTxVolume > 0 ? (myTotalVolume / totalMemberTxVolume) * 100 : 0;

        // --- SHU Cuci Mobil: Rp 2.000 fix per transaksi anggota ---
        const CARWASH_BONUS_PER_TX = await getCarwashBonusPerTx();
        const myCarwashTxCount = await prisma.unitTransaction.count({
            where: {
                memberId,
                unitType: "cuci_mobil",
                status: "completed",
                transactionDate: { gte: startDate, lte: endDate },
            }
        });
        const myCarwashBonus = myCarwashTxCount * CARWASH_BONUS_PER_TX;

        const estimatedSHUTotal = Math.round(myModal + myUsaha + myCarwashBonus);
        const jasaModalPercent = totalSysSavings > 0 ? (mySavCont / totalSysSavings) * 100 : 0;

        return NextResponse.json({
            data: {
                member: {
                    id: member.id,
                    memberNo: member.memberNo,
                    nrp: member.nrp,
                    name: member.name,
                    category: member.category,
                    salary: member.salary ? Number(member.salary) : null,
                    tunlesKinerja: member.tunlesKinerja ? Number(member.tunlesKinerja) : null,
                    tabunganWajib: member.tabunganWajib ? Number(member.tabunganWajib) : null,
                    phone: member.phone,
                    email: member.email,
                    address: member.address,
                    joinDate: member.joinDate,
                    status: member.status,
                    branch: member.branch,
                },
                savings: {
                    accounts: savingsAccounts.map((acc) => ({
                        id: acc.id,
                        accountNo: acc.accountNo,
                        product: acc.product,
                        balance: Number(acc.balance),
                        status: acc.status,
                        // H&U extended fields (null for non-H&U products — additive, non-breaking)
                        targetAmount: acc.targetAmount ? Number(acc.targetAmount) : null,
                        monthlyTarget: acc.monthlyTarget ? Number(acc.monthlyTarget) : null,
                        maturityDate: acc.maturityDate,
                        history: acc.transactions.map((t) => ({
                            id: t.id,
                            type: t.type,
                            amount: Number(t.amount),
                            notes: t.notes,
                            date: t.transactionDate,
                        })),
                    })),
                    totalBalance: totalSavings,
                },
                loans: {
                    list: loans.map((l) => ({
                        ...l,
                        principalAmount: Number(l.principalAmount),
                        principalPaid: Number(l.principalPaid),
                        interestPaid: Number(l.interestPaid),
                        principalOutstanding: Number(l.principalOutstanding),
                        interestOutstanding: Number(l.interestOutstanding),
                        monthlyInstallment: Number(l.monthlyInstallment),
                        tenorMonths: l.tenorMonths,
                    })),
                    activeCount: activeLoans.length,
                    totalOutstanding,
                },
                unitTransactions: {
                    recent: mergedRecent,
                    byUnit: mergedStats,
                    unpaidTotal: totalUnpaidAmount,
                    unpaidCount: totalUnpaidCount,
                },
                estimatedSHU: {
                    total: estimatedSHUTotal,
                    jasaModal: Math.round(myModal),
                    jasaUsaha: Math.round(myUsaha),
                    carwashBonus: myCarwashBonus,
                    carwashCount: myCarwashTxCount,
                    jasaModalPercent,
                    jasaUsahaPercent,
                },
            },
        });
    } catch (error) {
        console.error("GET /api/member-portal/summary error:", error);
        return NextResponse.json(
            { message: "Failed to fetch member summary" },
            { status: 500 }
        );
    }
}
