import prisma from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

function toNum(d: Decimal | number | null | undefined): number {
    if (d === null || d === undefined) return 0;
    return typeof d === "number" ? d : Number(d);
}

// AD-ART Pasal 35 — SHU Allocation for Members
export const SHU_ALLOCATIONS_MEMBER = [
    { key: "cadangan", label: "Dana Cadangan", percentage: 25, description: "Dana Cadangan Koperasi" },
    { key: "jasa_usaha", label: "Jasa Anggota (Usaha)", percentage: 30, description: "Dibagi berdasar kontribusi pinjaman & belanja" },
    { key: "jasa_modal", label: "Jasa Modal (Simpanan)", percentage: 20, description: "Dibagi berdasar proporsi simpanan pokok dan wajib" },
    { key: "pengurus", label: "Dana Pengurus dan Pengawas", percentage: 7.5, description: "Imbalan jasa pengurus dan pengawas" },
    { key: "pegawai", label: "Dana Kesejahteraan Pegawai", percentage: 7.5, description: "Kesejahteraan pegawai/karyawan" },
    { key: "pendidikan", label: "Dana Pendidikan Koperasi", percentage: 5, description: "Pendidikan Koperasi" },
    { key: "sosial", label: "Dana Sosial", percentage: 5, description: "Dana Sosial" },
];

// AD-ART Pasal 35 — SHU Allocation for Non-Member revenue
export const SHU_ALLOCATIONS_NON_MEMBER = [
    { key: "cadangan", label: "Dana Cadangan", percentage: 60, description: "Dana cadangan koperasi" },
    { key: "pendidikan1", label: "Dana Pendidikan Koperasi (Bagian 1)", percentage: 10, description: "Dana Pendidikan" },
    { key: "pegawai", label: "Dana Kesejahteraan Pegawai", percentage: 10, description: "Kesejahteraan pegawai/karyawan" },
    { key: "pendidikan2", label: "Dana Pendidikan Koperasi (Bagian 2)", percentage: 10, description: "Dana Pendidikan" },
    { key: "sosial", label: "Dana Sosial", percentage: 10, description: "Dana Sosial Koperasi" },
];

export async function calculateSystemSHU(year: number, month?: number | null) {
    const isAllMonths = !month;
    let startDate: Date;
    let endDate: Date;
    let periodLabel: string;

    if (!isAllMonths && month !== null) {
        startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
        endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
        const monthName = new Date(year, month - 1).toLocaleDateString("id-ID", { month: "long" });
        periodLabel = `${monthName} ${year}`;
    } else {
        startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
        endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
        periodLabel = `Tahun ${year}`;
    }

    // 1. Dapatkan Income/Expense dari Jurnal (Atau Fallback)
    const journalLines = await prisma.journalLine.findMany({
        where: {
            journal: { transactionDate: { gte: startDate, lte: endDate } },
        },
        include: { account: { select: { code: true, name: true, type: true } } },
    });

    let totalIncome = 0;
    let totalExpense = 0;
    const incomeAccounts: Record<string, { code: string; name: string; amount: number }> = {};
    const expenseAccounts: Record<string, { code: string; name: string; amount: number }> = {};

    if (journalLines.length > 0) {
        for (const line of journalLines) {
            const debit = toNum(line.debit);
            const credit = toNum(line.credit);
            if (line.account.type === "income") {
                const amount = credit - debit;
                totalIncome += amount;
                if (!incomeAccounts[line.account.code]) incomeAccounts[line.account.code] = { code: line.account.code, name: line.account.name, amount: 0 };
                incomeAccounts[line.account.code].amount += amount;
            } else if (line.account.type === "expense") {
                const amount = debit - credit;
                totalExpense += amount;
                if (!expenseAccounts[line.account.code]) expenseAccounts[line.account.code] = { code: line.account.code, name: line.account.name, amount: 0 };
                expenseAccounts[line.account.code].amount += amount;
            }
        }
    } else {
        // FALLBACK
        const expensesTx = await prisma.cashBankTransaction.findMany({
            where: { transactionDate: { gte: startDate, lte: endDate }, category: "biaya_operasional" }
        });
        expensesTx.forEach(tx => totalExpense += toNum(tx.amount));
        if (totalExpense > 0) expenseAccounts["CB-EXP"] = { code: "CB-EXP", name: "Biaya Operasional (Kas & Bank)", amount: totalExpense };

        const incomeTx = await prisma.cashBankTransaction.findMany({
            where: { transactionDate: { gte: startDate, lte: endDate }, category: "lainnya", type: "in" }
        });
        let cbIncomeTotal = 0;
        incomeTx.forEach(tx => {
            const desc = (tx.description || "").toLowerCase();
            if (!desc.includes("saldo") && !desc.includes("simpan") && !desc.includes("potong") && !desc.includes("angsur")) {
                cbIncomeTotal += toNum(tx.amount);
            }
        });
        totalIncome += cbIncomeTotal;
        if (cbIncomeTotal > 0) incomeAccounts["CB-INC"] = { code: "CB-INC", name: "Pendapatan Lainnya (Kas)", amount: cbIncomeTotal };

        try {
            const storeSalesInc = await prisma.storeSale.aggregate({
                where: { createdAt: { gte: startDate, lte: endDate }, metadata: { path: ["isVoided"], equals: false } as any },
                _sum: { totalAmount: true }
            });
            const storeIncTotal = toNum(storeSalesInc._sum.totalAmount);
            if (storeIncTotal > 0) {
                totalIncome += storeIncTotal;
                incomeAccounts["ST-INC"] = { code: "ST-INC", name: "Pendapatan Toko", amount: storeIncTotal };
            }
        } catch (e) {}
    }

    const netSurplus = Math.max(0, totalIncome - totalExpense);

    // 2. Hitung Rasio Member vs Non-Member
    let memberGrossIncome = 0;
    let nonMemberGrossIncome = 0;
    
    // a. Income dari Toko (Anggota vs Non-Anggota)
    const storeSalesMember = await prisma.storeSale.aggregate({
        where: { createdAt: { gte: startDate, lte: endDate }, memberId: { not: null }, metadata: { path: ["isVoided"], equals: false } as any },
        _sum: { totalAmount: true }
    });
    const storeSalesNonMember = await prisma.storeSale.aggregate({
        where: { createdAt: { gte: startDate, lte: endDate }, memberId: null, metadata: { path: ["isVoided"], equals: false } as any },
        _sum: { totalAmount: true }
    });
    memberGrossIncome += toNum(storeSalesMember._sum.totalAmount);
    nonMemberGrossIncome += toNum(storeSalesNonMember._sum.totalAmount);

    // b. Income dari Pinjaman (Bunga) -> Semua Anggota
    const loanInterest = await prisma.loanPayment.aggregate({
        where: { paymentDate: { gte: startDate, lte: endDate } },
        _sum: { interestPortion: true }
    });
    memberGrossIncome += toNum(loanInterest._sum.interestPortion);

    // c. Income dari Jasa (Unit Transaksi) -> Hanya lunas/non-void
    const unitTxMember = await prisma.unitTransaction.aggregate({
        where: { transactionDate: { gte: startDate, lte: endDate }, isPaid: true, status: "completed", memberId: { not: null } },
        _sum: { amount: true }
    });
    memberGrossIncome += toNum(unitTxMember._sum.amount);

    const unitTxNonMember = await prisma.unitTransaction.aggregate({
        where: { transactionDate: { gte: startDate, lte: endDate }, isPaid: true, status: "completed", memberId: null },
        _sum: { amount: true }
    });
    nonMemberGrossIncome += toNum(unitTxNonMember._sum.amount);

    // Proposi Laba
    const totalCalcGross = memberGrossIncome + nonMemberGrossIncome;
    let memberRatio = totalCalcGross > 0 ? memberGrossIncome / totalCalcGross : 0.8;
    let nonMemberRatio = 1 - memberRatio;

    const memberSurplus = Math.round(netSurplus * memberRatio);
    const nonMemberSurplus = netSurplus - memberSurplus;

    // 3. Alokasikan berdasar AD-ART
    const allocationsMember = SHU_ALLOCATIONS_MEMBER.map((alloc) => ({
        ...alloc,
        amount: Math.round((memberSurplus * alloc.percentage) / 100),
    }));

    const allocationsNonMember = SHU_ALLOCATIONS_NON_MEMBER.map((alloc) => ({
        ...alloc,
        amount: Math.round((nonMemberSurplus * alloc.percentage) / 100),
    }));

    const jasaModalPool = Math.round((memberSurplus * 20) / 100);
    const jasaUsahaPool = Math.round((memberSurplus * 30) / 100);

    // 4. Hitung SHU Per Member
    // Ambil semua transaksi spesifik tahun ini untuk Usaha, dan saldo aktif untuk Modal
    const members = await prisma.member.findMany({
        where: { status: "active", deletedAt: null },
        select: {
            id: true,
            memberNo: true,
            name: true,
            tabunganWajib: true,
            userAccount: { select: { name: true } },
            savingsAccounts: { 
                where: { status: "active" },
                include: { product: { select: { type: true } } } 
            },
            loanPayments: {
                where: { paymentDate: { gte: startDate, lte: endDate } },
                select: { principalPortion: true, interestPortion: true } // Cicilan yg DISETOR saja
            },
            storeSales: {
                where: { createdAt: { gte: startDate, lte: endDate } },
                select: { totalAmount: true, metadata: true }
            },
            unitTransactions: {
                where: { transactionDate: { gte: startDate, lte: endDate }, isPaid: true, status: "completed" },
                select: { amount: true }
            }
        }
    });

    let totalSystemSavings = 0;
    let totalSystemTransactions = 0;

    const memberStats = members.map(m => {
        // Kontribusi Modal (Hanya Pokok + Wajib saldo mutakhir)
        const savingsBal = m.savingsAccounts
            .filter(sa => sa.product.type === "pokok" || sa.product.type === "wajib")
            .reduce((sum, sa) => sum + toNum(sa.balance), 0) + Number(m.tabunganWajib || 0);

        // Kontribusi Usaha (Angsuran Pokok+Bunga LUNAS + Toko + Jasa LUNAS tahun berjalan)
        const loanContrib = m.loanPayments.reduce((sum, lp) => sum + toNum(lp.principalPortion) + toNum(lp.interestPortion), 0);
        
        const storeContrib = m.storeSales
            .filter(sale => {
                const meta = sale.metadata as any;
                return !meta?.isVoided;
            })
            .reduce((sum, sale) => sum + toNum(sale.totalAmount), 0);

        const unitContrib = m.unitTransactions.reduce((sum, ut) => sum + toNum(ut.amount), 0);

        const transactionContrib = loanContrib + storeContrib + unitContrib;

        totalSystemSavings += savingsBal;
        totalSystemTransactions += transactionContrib;

        return {
            id: m.id,
            memberNo: m.memberNo,
            name: m.userAccount?.name || m.name,
            savingsContribution: savingsBal,
            loanContribution: transactionContrib,
            totalContribution: savingsBal + transactionContrib
        };
    });

    const memberDistribution = memberStats.map(m => {
        const modalPortion = totalSystemSavings > 0 ? Math.round((m.savingsContribution / totalSystemSavings) * jasaModalPool) : 0;
        const usahaPortion = totalSystemTransactions > 0 ? Math.round((m.loanContribution / totalSystemTransactions) * jasaUsahaPool) : 0;
        const totalSHU = modalPortion + usahaPortion;
        const memberDividend = jasaModalPool + jasaUsahaPool;

        return {
            ...m,
            modalPortion,
            usahaPortion,
            shuAmount: totalSHU,
            shuShare: totalSHU, // alias for reports/shu
            percentage: memberDividend > 0 ? Number(((totalSHU / memberDividend) * 100).toFixed(2)) : 0
        };
    });

    // Formatting output untuk backwards compatible dengan reports/shu & reports/shu/calculate
    const incomeDetails = Object.values(incomeAccounts).sort((a, b) => b.amount - a.amount);
    const expenseDetails = Object.values(expenseAccounts).sort((a, b) => b.amount - a.amount);

    return {
        // Base Metrics
        year,
        month,
        periodLabel,
        totalIncome,
        totalExpense,
        netSurplus,
        memberRatio,
        nonMemberRatio,
        memberSurplus,
        nonMemberSurplus,
        jasaModalPool,
        jasaUsahaPool,
        memberDividend: jasaModalPool + jasaUsahaPool,
        totalSavingsCapital: totalSystemSavings,
        memberCount: members.length,

        // Allocations
        allocationsMember,
        allocationsNonMember,
        
        // Members
        memberDistribution: memberDistribution.sort((a, b) => b.shuAmount - a.shuAmount),

        // Accounts detail
        incomeDetails,
        expenseDetails
    };
}
