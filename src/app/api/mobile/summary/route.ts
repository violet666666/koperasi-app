import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../middleware";
import { getCarwashBonusPerTx } from "@/lib/services/shu-settings";

// GET /api/mobile/summary — Ringkasan lengkap data untuk Dashboard Mobile
export async function GET(request: Request) {
    const mobileUser = getMobileUser(request);
    if (!mobileUser) return unauthorizedResponse();

    try {
        const user = await prisma.user.findUnique({
            where: { id: Number(mobileUser.id) },
            include: { member: true, role: true },
        });
        if (!user) {
            return NextResponse.json({ message: "User tidak ditemukan" }, { status: 404 });
        }

        const memberId = user.memberId;
        const roleName = user.role.name;
        const isOperator = ["operator", "admin", "superadmin"].includes(roleName);
        const isKasir = roleName === "kasir";

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        if (isKasir) {
            const [todaySalesRaw, latestSales] = await Promise.all([
                // FIX: Use findMany to filter voided sales
                prisma.storeSale.findMany({
                    where: { createdAt: { gte: todayStart } },
                    select: { totalAmount: true, metadata: true },
                }),
                prisma.storeSale.findMany({
                    take: 5,
                    orderBy: { createdAt: "desc" },
                    include: { items: { include: { product: { select: { name: true } } } } },
                }),
            ]);

            // Filter out voided sales
            const activeTodaySales = todaySalesRaw.filter((s: any) => {
                if (!s.metadata) return true;
                const meta = typeof s.metadata === "object" ? s.metadata : JSON.parse(s.metadata as string);
                return !meta.isVoided;
            });

            return NextResponse.json({
                data: {
                    type: "kasir",
                    user: {
                        id: user.id, name: user.name, email: user.email,
                        role: user.role.name, roleDisplayName: user.role.displayName,
                    },
                    today: {
                        salesTotal: activeTodaySales.reduce((sum: number, s: any) => sum + Number(s.totalAmount || 0), 0),
                        salesCount: activeTodaySales.length,
                    },
                    latestSales: latestSales.map(s => ({
                        id: s.id,
                        saleNo: s.saleNo,
                        totalAmount: Number(s.totalAmount),
                        paymentMethod: s.paymentMethod,
                        timestamp: s.createdAt.toISOString(),
                        itemCount: s.items.length,
                    })),
                },
            });
        }

        // Jika operator/admin, kirim statistik koperasi global + aktivitas hari ini
        if (isOperator || (!memberId && roleName !== "anggota")) {
            const [
                totalMembers, totalSavings, totalLoans, totalArrears, pendingApprovals,
                totalTunkin, membersWithTunkin, _legacyTabWajib /* unused - Single Source of Truth is SavingsAccount */,
                todayDeposits, todayWithdrawals, todayPayments,
            ] = await Promise.all([
                prisma.member.count({ where: { status: "active", deletedAt: null } }),
                prisma.savingsAccount.aggregate({ _sum: { balance: true }, where: { status: "active" } }),
                prisma.loan.aggregate({ _sum: { principalOutstanding: true }, where: { status: { in: ["active", "overdue"] } } }),
                prisma.loan.aggregate({ _sum: { principalOutstanding: true }, where: { status: "overdue" } }),
                prisma.loanApplication.count({ where: { status: "submitted" } }),
                prisma.member.aggregate({ _sum: { tunlesKinerja: true }, where: { tunlesKinerja: { gt: 0 }, deletedAt: null } }),
                prisma.member.count({ where: { tunlesKinerja: { gt: 0 }, deletedAt: null } }),
                prisma.member.aggregate({ _sum: { tabunganWajib: true }, where: { status: "active", deletedAt: null } }),
                // Today deposits
                prisma.savingsTransaction.aggregate({
                    _sum: { amount: true }, _count: { id: true },
                    where: { type: "deposit", transactionDate: { gte: todayStart } },
                }),
                // Today withdrawals (pencairan pinjaman hari ini)
                prisma.loan.aggregate({
                    _sum: { principalAmount: true }, _count: { id: true },
                    where: { disbursementDate: { gte: todayStart } },
                }),
                // Today loan payments
                prisma.loanPayment.aggregate({
                    _sum: { amount: true }, _count: { id: true },
                    where: { paymentDate: { gte: todayStart } },
                }),
            ]);

            return NextResponse.json({
                data: {
                    type: "operator",
                    user: {
                        id: user.id, name: user.name, email: user.email,
                        role: user.role.name, roleDisplayName: user.role.displayName,
                    },
                    stats: {
                        totalMembers,
                        totalSavings: Number(totalSavings._sum.balance || 0),
                        totalLoansOutstanding: Number(totalLoans._sum.principalOutstanding || 0),
                        totalArrears: Number(totalArrears._sum.principalOutstanding || 0),
                        pendingApprovals,
                        totalTunkin: Number(totalTunkin._sum.tunlesKinerja || 0),
                        membersWithTunkin,
                    },
                    today: {
                        deposits: Number(todayDeposits._sum.amount || 0),
                        depositsCount: todayDeposits._count.id,
                        withdrawals: Number(todayWithdrawals._sum.principalAmount || 0),
                        withdrawalsCount: todayWithdrawals._count.id,
                        payments: Number(todayPayments._sum.amount || 0),
                        paymentsCount: todayPayments._count.id,
                    },
                },
            });
        }

        // Jika anggota biasa, kirim data personal
        // Guard: jika user belum terhubung dengan data member
        if (!memberId || !user.member) {
            return NextResponse.json({
                data: {
                    type: "member",
                    user: {
                        id: user.id, name: user.name, email: user.email,
                        role: user.role.name, roleDisplayName: user.role.displayName,
                    },
                    member: null,
                    savings: { accounts: [], totalBalance: 0 },
                    loans: { list: [], activeCount: 0, totalOutstanding: 0 },
                    unitCredit: { unpaidTotal: 0, unpaidCount: 0 },
                },
            });
        }

        const [savingsAccounts, loans, unitUnpaid, latestSejahtera] = await Promise.all([
            prisma.savingsAccount.findMany({
                where: { memberId, status: "active" },
                include: {
                    product: { select: { name: true, type: true } },
                    // Include deposit transactions for wajib accounts (untuk detail mutasi bulanan)
                    transactions: {
                        where: { type: { in: ['deposit', 'correction'] } },
                        select: { id: true, type: true, amount: true, notes: true, transactionDate: true },
                        orderBy: { transactionDate: 'asc' },
                    },
                },
            }),
            prisma.loan.findMany({
                where: { memberId },
                select: {
                    id: true, loanNo: true, principalAmount: true, principalPaid: true, interestPaid: true,
                    principalOutstanding: true, interestOutstanding: true, monthlyInstallment: true,
                    tenorMonths: true, status: true, disbursementDate: true, firstDueDate: true,
                    lastDueDate: true, paidOffDate: true,
                },
            }),
            prisma.unitTransaction.aggregate({
                where: { memberId, isPaid: false, status: { not: "voided" } },
                _sum: { amount: true }, _count: { id: true },
            }),
            prisma.tabunganSejahteraHistory.findFirst({
                where: { memberId },
                orderBy: [
                    { tahun: 'desc' },
                    { bulan: 'desc' }
                ]
            })
        ]);

        // Single Source of Truth: hanya SavingsAccount (tidak lagi menambahkan legacy tabunganWajib)
        const totalSavingsBalance = savingsAccounts.reduce((s, a) => s + Number(a.balance), 0);
        const activeLoans = loans.filter((l) => l.status === "active" || l.status === "overdue");
        const totalOutstanding = activeLoans.reduce((s, l) => s + Number(l.principalOutstanding), 0);

        // --- Fast Estimated SHU Calculation ---
        const year = new Date().getFullYear();
        const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
        const endDate = new Date(`${year}-12-31T23:59:59.999Z`);

        const [sysTokoRaw, sysUnit, sysLoanInt, sysSavings, sysTajib, sysSimpananPokok, mySavings, myTokoRaw, myUnit, myLoan] = await Promise.all([
            // FIX: Use findMany to filter voided sales for SHU calculation
            prisma.storeSale.findMany({ where: { createdAt: { gte: startDate, lte: endDate } }, select: { totalAmount: true, memberId: true, metadata: true } }),
            prisma.unitTransaction.aggregate({ where: { transactionDate: { gte: startDate, lte: endDate }, isPaid: true, status: { not: "voided" } }, _sum: { amount: true } }),
            prisma.loanPayment.aggregate({ where: { paymentDate: { gte: startDate, lte: endDate } }, _sum: { interestPortion: true } }),
            prisma.savingsTransaction.aggregate({ where: { type: "deposit", transactionDate: { gte: startDate, lte: endDate } }, _sum: { amount: true } }),
            // System total Simpanan Wajib & Simpanan Pokok (all active members)
            prisma.member.aggregate({ where: { status: "active", deletedAt: null }, _sum: { tabunganWajib: true } }),
            prisma.savingsAccount.aggregate({ where: { status: "active", product: { type: "pokok" } }, _sum: { balance: true } }),
            
            prisma.savingsTransaction.aggregate({ where: { account: { memberId }, type: "deposit", transactionDate: { gte: startDate, lte: endDate } }, _sum: { amount: true } }),
            prisma.storeSale.findMany({ where: { memberId, createdAt: { gte: startDate, lte: endDate } }, select: { totalAmount: true, metadata: true } }),
            prisma.unitTransaction.aggregate({ where: { memberId, transactionDate: { gte: startDate, lte: endDate }, status: { not: "voided" } }, _sum: { amount: true } }),
            prisma.loan.aggregate({ where: { memberId, disbursementDate: { gte: startDate, lte: endDate } }, _sum: { totalAmount: true } })
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

        const memberIncome = sysTokoMemberTotal + Number(sysUnit._sum.amount || 0) + Number(sysLoanInt._sum.interestPortion || 0);
        const nonMemberIncome = sysTokoNonMemberTotal;
        const totalIncome = memberIncome + nonMemberIncome;

        const totalExpense = totalIncome * 0.4;
        const totalNetSurplus = totalIncome - totalExpense; // Total koperasi surplus

        // Jasa Simpanan Pool (20%) — from TOTAL surplus with minimum floor
        // Single Source of Truth: SavingsAccount balance only (no legacy tabunganWajib double-add)
        // SHU Modal: hanya Pokok + Wajib (exclude Sukarela) sesuai AD-ART Pasal 42
        const totalActiveSavBal = await prisma.savingsAccount.aggregate({
            where: { status: "active", product: { type: { in: ["pokok", "wajib"] } } }, _sum: { balance: true }
        });
        const totalSavingsCapital = Number(totalActiveSavBal._sum.balance || 0);
        const totalSysSav = totalSavingsCapital || 1;
        const surplusBasedPool = totalNetSurplus * 0.20;
        const minSavingsReturnPool = (totalSavingsCapital * 0.06) * 0.20;
        const jasaModalPool = Math.max(surplusBasedPool, minSavingsReturnPool);

        // Jasa Anggota (25%) — AD-ART Pasal 42 POOL METHOD
        const jasaUsahaPool = Math.max(0, totalNetSurplus * 0.25);

        // Member Numerators — hanya Pokok + Wajib (exclude Sukarela) sesuai AD-ART Pasal 42
        const mySavCont = savingsAccounts
            .filter(a => a.product.type === 'pokok' || a.product.type === 'wajib')
            .reduce((s, a) => s + Number(a.balance), 0) || 1;
        
        // 1. Calculate Jasa Modal (Proportional Pool)
        const myModal = (mySavCont / totalSysSav) * jasaModalPool;

        // 2. Calculate Jasa Usaha (Pool Method: proportional by transaction volume)
        const totalMemberTxVolume = sysTokoMemberTotal + Number(sysUnit._sum.amount || 0) + Number(sysLoanInt._sum.interestPortion || 0);
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

        const estimatedSHU = Math.round(myModal + myUsaha + myCarwashBonus);

        return NextResponse.json({
            data: {
                type: "member",
                user: {
                    id: user.id, name: user.name, email: user.email,
                    role: user.role.name, roleDisplayName: user.role.displayName,
                    nrp: user.member.nrp,
                },
                member: {
                    id: user.member.id, memberNo: user.member.memberNo,
                    name: user.member.name, salary: Number(user.member.salary || 0),
                    tunlesKinerja: Number(user.member.tunlesKinerja || 0),
                    tabunganWajib: Number(user.member.tabunganWajib || 0),
                },
                savings: {
                    accounts: savingsAccounts.map((a) => ({
                        id: a.id, accountNo: a.accountNo, balance: Number(a.balance), product: a.product,
                        // Kirim transactions hanya untuk akun wajib (detail mutasi bulanan)
                        transactions: a.product.type === 'wajib' ? (a as any).transactions?.map((t: any) => ({
                            id: t.id, type: t.type, amount: Number(t.amount),
                            notes: t.notes, transactionDate: t.transactionDate?.toISOString(),
                        })) : undefined,
                    })),
                    totalBalance: totalSavingsBalance,
                    sejahteraBalance: latestSejahtera ? Number(latestSejahtera.saldoAkhir) : 0,
                },
                loans: {
                    list: loans.map((l) => ({
                        ...l, principalAmount: Number(l.principalAmount), principalPaid: Number(l.principalPaid),
                        interestPaid: Number(l.interestPaid), principalOutstanding: Number(l.principalOutstanding),
                        interestOutstanding: Number(l.interestOutstanding), monthlyInstallment: Number(l.monthlyInstallment),
                        tenorMonths: l.tenorMonths,
                    })),
                    activeCount: activeLoans.length,
                    totalOutstanding,
                },
                unitCredit: {
                    unpaidTotal: Number(unitUnpaid._sum.amount || 0),
                    unpaidCount: unitUnpaid._count.id,
                },
                estimatedSHU,
                estimatedSHUDetail: {
                    jasaModal: Math.round(myModal),
                    jasaUsaha: Math.round(myUsaha),
                    carwashBonus: myCarwashBonus,
                    carwashCount: myCarwashTxCount,
                },
            },
        });
    } catch (error: any) {
        console.error("GET /api/mobile/summary error:", error?.message || error);
        return NextResponse.json({ message: "Gagal memuat data", error: error?.message }, { status: 500 });
    }
}
