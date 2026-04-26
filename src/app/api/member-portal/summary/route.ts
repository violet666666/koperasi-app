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

        // Get unit transactions summary (include voided for display but mark them)
        const unitTransactions = await prisma.unitTransaction.findMany({
            where: { memberId },
            orderBy: { transactionDate: "desc" },
            take: 10,
            select: {
                id: true, transactionNo: true, unitType: true, description: true,
                amount: true, transactionDate: true, isPaid: true, paidDate: true,
                status: true, paymentMethod: true,
            },
        });

        // BUG-113 FIX: Also fetch StoreSale for dashboard history
        const storeSaleTxs = await prisma.storeSale.findMany({
            where: { memberId },
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
                id: true, saleNo: true, unitType: true, totalAmount: true,
                createdAt: true, paymentMethod: true,
                items: { select: { product: { select: { name: true } }, quantity: true } },
            },
        });

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
                const itemDesc = s.items.map(i => `${i.product.name} x${i.quantity}`).join(', ');
                return {
                    id: s.id + 100000, // offset to avoid ID clash in frontend keys
                    transactionNo: s.saleNo,
                    unitType: s.unitType || 'toko',
                    description: itemDesc || 'Belanja Toko',
                    amount: Number(s.totalAmount),
                    transactionDate: s.createdAt,
                    isPaid: true, // StoreSale is always paid (cash/QRIS at checkout)
                    status: 'completed',
                    paymentMethod: s.paymentMethod,
                    source: 'store' as const,
                };
            }),
        ].sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime()).slice(0, 10);

        // Stats: combine both tables
        const unitStats = await prisma.unitTransaction.groupBy({
            by: ["unitType"],
            where: { memberId, status: { not: "voided" } },
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

        const unpaidUnitTotal = await prisma.unitTransaction.aggregate({
            where: { memberId, isPaid: false, status: { not: "voided" } },
            _sum: { amount: true },
            _count: { id: true },
        });

        // --- Real-time SHU Estimation ---
        const year = new Date().getFullYear();
        const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
        const endDate = new Date(`${year}-12-31T23:59:59.999Z`);

        const [sysTokoRaw, sysUnit, sysLoanInt, myTokoRaw, myUnit, myLoan] = await Promise.all([
            // FIX: Use findMany to filter voided sales for SHU calculation
            prisma.storeSale.findMany({ where: { createdAt: { gte: startDate, lte: endDate } }, select: { totalAmount: true, memberId: true, metadata: true } }),
            prisma.unitTransaction.aggregate({ where: { transactionDate: { gte: startDate, lte: endDate }, isPaid: true, status: { not: "voided" } }, _sum: { amount: true } }),
            prisma.loanPayment.aggregate({ where: { paymentDate: { gte: startDate, lte: endDate } }, _sum: { interestPortion: true } }),
            // My contributions
            prisma.storeSale.findMany({ where: { memberId, createdAt: { gte: startDate, lte: endDate } }, select: { totalAmount: true, metadata: true } }),
            prisma.unitTransaction.aggregate({ where: { memberId, transactionDate: { gte: startDate, lte: endDate }, status: { not: "voided" } }, _sum: { amount: true } }),
            prisma.loan.aggregate({ where: { memberId, disbursementDate: { gte: startDate, lte: endDate } }, _sum: { totalAmount: true } }),
        ]);

        // Helper: filter out voided StoreSale
        const filterActiveSales = (sales: any[]) => sales.filter((s: any) => {
            if (!s.metadata) return true;
            const meta = typeof s.metadata === "object" ? s.metadata : JSON.parse(s.metadata as string);
            return !meta.isVoided;
        });

        const activeSysTokoAll = filterActiveSales(sysTokoRaw);
        const sysTokoMemberTotal = activeSysTokoAll.filter((s: any) => s.memberId !== null).reduce((sum: number, s: any) => sum + Number(s.totalAmount || 0), 0);
        const sysTokoNonMemberTotal = activeSysTokoAll.filter((s: any) => s.memberId === null).reduce((sum: number, s: any) => sum + Number(s.totalAmount || 0), 0);
        const myTokoTotal = filterActiveSales(myTokoRaw).reduce((sum: number, s: any) => sum + Number(s.totalAmount || 0), 0);

        // Income calculation
        const memberIncome = sysTokoMemberTotal + Number(sysUnit._sum.amount || 0) + Number(sysLoanInt._sum.interestPortion || 0);
        const nonMemberIncome = sysTokoNonMemberTotal;
        const totalIncome = memberIncome + nonMemberIncome;
        const totalExpense = totalIncome * 0.4; // Estimated 40% operating expenses
        const totalNetSurplus = totalIncome - totalExpense; // Total koperasi surplus

        // --- Calculate System-Wide Savings Capital ---
        // To prevent double counting between legacy `tabunganWajib` and new `savingsAccounts`
        const allRelevantMembers = await prisma.member.findMany({
            where: { status: "active", deletedAt: null },
            select: { id: true, tabunganWajib: true, savingsAccounts: { select: { balance: true, product: { select: { type: true } } } } }
        });
        
        let totalSysSavings = 0;
        let mySavCont = 0;

        for (const m of allRelevantMembers) {
            let mSav = 0;
            let hasImportedWajib = false;
            for (const acc of m.savingsAccounts) {
                // SHU Jasa Modal ONLY applies to Pokok and Wajib (Sukarela is excluded by definition)
                if (acc.product.type === "pokok" || acc.product.type === "wajib") {
                    mSav += Number(acc.balance);
                }
                // FIXED: Cek keberadaan rekening saja, bukan balance > 0.
                // Saldo 0 setelah koreksi tetap berarti rekening sudah ada.
                if (acc.product.type === "wajib") hasImportedWajib = true;
            }
            if (!hasImportedWajib) mSav += Number(m.tabunganWajib || 0); // Legacy fallback
            
            totalSysSavings += mSav;
            if (m.id === memberId) mySavCont = mSav;
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
        // System-wide member transaction volume = all member toko sales + all unit transactions + all loan interest
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
                    unpaidTotal: Number(unpaidUnitTotal._sum.amount || 0),
                    unpaidCount: unpaidUnitTotal._count.id,
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
