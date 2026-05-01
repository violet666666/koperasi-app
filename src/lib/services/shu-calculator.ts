import prisma from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { getCarwashBonusPerTx } from "./shu-settings";

function toNum(d: Decimal | number | null | undefined): number {
    if (d === null || d === undefined) return 0;
    return typeof d === "number" ? d : Number(d);
}

// Default Fallback Settings jika di Database belum di-set
const DEFAULT_SHU_CONFIG = {
    carwashBonusPerTx: 2000,
    memberAllocations: [
        { key: "jasa_usaha", label: "Jasa Anggota", percentage: 25, description: "Berdasar kontribusi belanja & jasa (Jasa Anggota)" },
        { key: "jasa_modal", label: "Jasa Simpanan", percentage: 20, description: "Berdasar simpanan pokok & wajib (Jasa Simpanan)" },
        { key: "cadangan", label: "Cadangan", percentage: 30, description: "Dana Cadangan Koperasi (Cadangan)" },
        { key: "pengurus", label: "Dana Pengurus", percentage: 10, description: "Insentif Pengurus & Pengawas (Dana Pengurus)" },
        { key: "pegawai", label: "Dana Pegawai", percentage: 5, description: "Kesejahteraan Karyawan (Dana Pegawai)" },
        { key: "pendidikan", label: "Dana Pendidikan", percentage: 5, description: "Pendidikan Perkoperasian (Dana Pendidikan)" },
        { key: "sosial", label: "Dana Sosial", percentage: 5, description: "Bakti Sosial (Dana Sosial)" },
    ],
    nonMemberAllocations: [
        { key: "cadangan", label: "Dana Cadangan", percentage: 60, description: "Dana cadangan koperasi" },
        { key: "pendidikan1", label: "Dana Pendidikan Koperasi (Bagian 1)", percentage: 10, description: "Dana Pendidikan" },
        { key: "pegawai", label: "Dana Kesejahteraan Pegawai", percentage: 10, description: "Kesejahteraan pegawai/karyawan" },
        { key: "pendidikan2", label: "Dana Pendidikan Koperasi (Bagian 2)", percentage: 10, description: "Dana Pendidikan" },
        { key: "sosial", label: "Dana Sosial", percentage: 10, description: "Dana Sosial Koperasi" },
    ]
};

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

    // Ambil konfigurasi persentase dari Settings (DB)
    const setting = await prisma.systemSetting.findUnique({ where: { id: "global" } });
    let config = DEFAULT_SHU_CONFIG;
    if (setting && setting.shuConfig) {
        const dbConfig = setting.shuConfig as any;
        if (dbConfig.memberAllocations && dbConfig.nonMemberAllocations) {
            config = dbConfig;
        }
    }

    // 1. Dapatkan Income/Expense dari Jurnal
    const journalLines = await prisma.journalLine.findMany({
        where: {
            journal: { transactionDate: { gte: startDate, lte: endDate }, isPosted: true },
        },
        include: { account: { select: { code: true, name: true, type: true } } },
    });

    let totalIncome = 0;
    let totalExpense = 0;
    const incomeAccounts: Record<string, { code: string; name: string; amount: number }> = {};
    const expenseAccounts: Record<string, { code: string; name: string; amount: number }> = {};

    if (journalLines.length > 0) {
        // Jika Jurnal Sistem sudah berjalan sempurna
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
        // FALLBACK: Bila Jurnal belum terbentuk utuh, hitung Gross Margin (Laba Kotor) Langsung
        const expensesTx = await prisma.cashBankTransaction.findMany({
            where: { transactionDate: { gte: startDate, lte: endDate }, category: { in: ["biaya_operasional", "beban_operasional_unit"] } }
        });
        expensesTx.forEach(tx => totalExpense += toNum(tx.amount));
        if (totalExpense > 0) expenseAccounts["CB-EXP"] = { code: "CB-EXP", name: "Biaya Operasional (Kas & Unit)", amount: totalExpense };

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

        // Tambah Pendapatan Pinjaman (Hanya Bunga = Keuntungan)
        const loanInterest = await prisma.loanPayment.aggregate({
            where: { paymentDate: { gte: startDate, lte: endDate } },
            _sum: { interestPortion: true }
        });
        const interestTotal = toNum(loanInterest._sum.interestPortion);
        if (interestTotal > 0) {
            totalIncome += interestTotal;
            incomeAccounts["LN-INC"] = { code: "LN-INC", name: "Pendapatan Jasa Pinjaman", amount: interestTotal };
        }

        // Tambah Pendapatan Jasa Unit (Barbershop, Cuci Mobil dll)
        const unitTx = await prisma.unitTransaction.aggregate({
            where: { transactionDate: { gte: startDate, lte: endDate }, isPaid: true, status: "completed" },
            _sum: { amount: true }
        });
        const unitTxTotal = toNum(unitTx._sum.amount);
        if (unitTxTotal > 0) {
            totalIncome += unitTxTotal;
            incomeAccounts["UT-INC"] = { code: "UT-INC", name: "Pendapatan Usaha Jasa Unit", amount: unitTxTotal };
        }

        try {
            // Omzet Toko Bruto — gunakan NOT filter agar transaksi tanpa metadata tetap terhitung
            const storeSalesInc = await prisma.storeSale.aggregate({
                where: { createdAt: { gte: startDate, lte: endDate }, NOT: { metadata: { path: ["isVoided"], equals: true } } as any },
                _sum: { totalAmount: true }
            });
            const storeIncTotal = toNum(storeSalesInc._sum.totalAmount);
            if (storeIncTotal > 0) {
                totalIncome += storeIncTotal;
                incomeAccounts["ST-INC"] = { code: "ST-INC", name: "Omzet Bruto Toko", amount: storeIncTotal };
            }

            // Kurangi dengan Harga Pokok Penjualan (HPP) Toko agar mendapat Margin!
            const soldItems = await prisma.storeSaleItem.findMany({
                where: { sale: { createdAt: { gte: startDate, lte: endDate }, NOT: { metadata: { path: ["isVoided"], equals: true } } as any } },
                include: { product: { select: { costPrice: true } } }
            });
            let cogsTotal = 0;
            soldItems.forEach(item => {
                cogsTotal += item.quantity * toNum(item.product?.costPrice);
            });
            if (cogsTotal > 0) {
                totalExpense += cogsTotal;
                expenseAccounts["ST-COGS"] = { code: "ST-COGS", name: "HPP Toko (Modal Barang)", amount: cogsTotal };
            }
        } catch (e) {
            console.error("SHU Toko calc error:", e);
        }
    }

    const netSurplus = Math.max(0, totalIncome - totalExpense);

    // 2. Hitung Rasio Member vs Non-Member berdasarkan Omzet
    let memberGrossIncome = 0;
    let nonMemberGrossIncome = 0;
    
    const storeSalesMember = await prisma.storeSale.aggregate({
        where: { createdAt: { gte: startDate, lte: endDate }, memberId: { not: null }, NOT: { metadata: { path: ["isVoided"], equals: true } } as any },
        _sum: { totalAmount: true }
    });
    const storeSalesNonMember = await prisma.storeSale.aggregate({
        where: { createdAt: { gte: startDate, lte: endDate }, memberId: null, NOT: { metadata: { path: ["isVoided"], equals: true } } as any },
        _sum: { totalAmount: true }
    });
    memberGrossIncome += toNum(storeSalesMember._sum.totalAmount);
    nonMemberGrossIncome += toNum(storeSalesNonMember._sum.totalAmount);

    // Bunga Angsuran Pinjaman pasti angggota
    const loanInterest = await prisma.loanPayment.aggregate({
        where: { paymentDate: { gte: startDate, lte: endDate } },
        _sum: { interestPortion: true }
    });
    memberGrossIncome += toNum(loanInterest._sum.interestPortion);

    const unitTxMember = await prisma.unitTransaction.aggregate({
        where: { transactionDate: { gte: startDate, lte: endDate }, isPaid: true, status: "completed", memberId: { not: null } },
        _sum: { amount: true }
    });
    const unitTxNonMember = await prisma.unitTransaction.aggregate({
        where: { transactionDate: { gte: startDate, lte: endDate }, isPaid: true, status: "completed", memberId: null },
        _sum: { amount: true }
    });
    memberGrossIncome += toNum(unitTxMember._sum.amount);
    nonMemberGrossIncome += toNum(unitTxNonMember._sum.amount);

    const totalCalcGross = memberGrossIncome + nonMemberGrossIncome;
    const memberRatio = totalCalcGross > 0 ? memberGrossIncome / totalCalcGross : 0.8;
    const nonMemberRatio = 1 - memberRatio;

    const memberSurplus = Math.round(netSurplus * memberRatio);
    const nonMemberSurplus = netSurplus - memberSurplus;

    const modalAlloc = config.memberAllocations.find(a => a.key === "jasa_modal");
    const usahaAlloc = config.memberAllocations.find(a => a.key === "jasa_usaha");

    // 4. Hitung SHU Per Member
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
                select: { principalPortion: true, interestPortion: true }
            },
            storeSales: {
                where: { createdAt: { gte: startDate, lte: endDate } },
                select: { totalAmount: true, metadata: true }
            },
            unitTransactions: {
                where: { transactionDate: { gte: startDate, lte: endDate }, status: "completed" },
                select: { amount: true, unitType: true }
            }
        }
    });

    let totalSystemSavings = 0;
    let totalSystemTransactions = 0;
    const CARWASH_BONUS_PER_TX = await getCarwashBonusPerTx();

    const memberStats = members.map(m => {
        // Modal: Simpanan Pokok + Wajib — pisahkan untuk transparansi UI
        const simpananPokok = m.savingsAccounts
            .filter(sa => sa.product.type === "pokok")
            .reduce((sum, sa) => sum + toNum(sa.balance), 0);

        // Simpanan Wajib: gunakan MAX(rekening_aktif, legacy_csv) untuk menghindari data hilang
        const wajibFromAccount = m.savingsAccounts
            .filter(sa => sa.product.type === "wajib")
            .reduce((sum, sa) => sum + toNum(sa.balance), 0);
        const wajibFromLegacy = Number(m.tabunganWajib || 0);
        const simpananWajib = Math.max(wajibFromAccount, wajibFromLegacy);

        const savingsBal = simpananPokok + simpananWajib;

        // Usaha: Belanja Toko (Termasuk Kas + Potong Gaji) + Jasa Unit + Bunga Pinjaman Diangsur
        const loanContrib = m.loanPayments.reduce((sum, lp) => sum + toNum(lp.interestPortion), 0);
        const storeContrib = m.storeSales
            .filter(sale => {
                const meta = sale.metadata as any;
                return !meta?.isVoided;
            })
            .reduce((sum, sale) => sum + toNum(sale.totalAmount), 0);
        const unitContrib = m.unitTransactions.reduce((sum, ut) => sum + toNum(ut.amount), 0);

        // SHU Cuci Mobil: Hitung jumlah transaksi cuci_mobil milik anggota ini
        const carwashCount = m.unitTransactions.filter(ut => ut.unitType === "cuci_mobil").length;
        const carwashBonus = carwashCount * CARWASH_BONUS_PER_TX;

        const transactionContrib = loanContrib + storeContrib + unitContrib;

        totalSystemSavings += savingsBal;
        totalSystemTransactions += transactionContrib;

        return {
            id: m.id,
            memberNo: m.memberNo,
            name: m.userAccount?.name || m.name,
            simpananPokok,
            simpananWajib,
            savingsContribution: savingsBal,
            loanContribution: transactionContrib,
            totalContribution: savingsBal + transactionContrib,
            carwashCount,
            carwashBonus,
        };
    });

    // Hitung total beban SHU Cuci Mobil secara nasional (dibebankan ke pendapatan kotor koperasi)
    const totalCarwashBonus = memberStats.reduce((sum, m) => sum + m.carwashBonus, 0);

    // Potong beban SHU Cuci Mobil dari Laba Bersih agar Koperasi tidak tombok
    const adjustedNetSurplus = Math.max(0, netSurplus - totalCarwashBonus);
    const adjustedMemberSurplus = Math.round(adjustedNetSurplus * memberRatio);
    const adjustedNonMemberSurplus = adjustedNetSurplus - adjustedMemberSurplus;
    const adjustedJasaModalPool = Math.round((adjustedMemberSurplus * (modalAlloc?.percentage || 20)) / 100);
    const adjustedJasaUsahaPool = Math.round((adjustedMemberSurplus * (usahaAlloc?.percentage || 25)) / 100);

    // 3. Alokasikan berdasar Konfigurasi AD-ART (using adjusted values)
    const allocationsMember = config.memberAllocations.map((alloc) => ({
        ...alloc,
        amount: Math.round((adjustedMemberSurplus * alloc.percentage) / 100),
    }));

    const allocationsNonMember = config.nonMemberAllocations.map((alloc) => ({
        ...alloc,
        amount: Math.round((adjustedNonMemberSurplus * alloc.percentage) / 100),
    }));

    const memberDistribution = memberStats.map(m => {
        const modalPortion = totalSystemSavings > 0 ? Math.round((m.savingsContribution / totalSystemSavings) * adjustedJasaModalPool) : 0;
        const usahaPortion = totalSystemTransactions > 0 ? Math.round((m.loanContribution / totalSystemTransactions) * adjustedJasaUsahaPool) : 0;
        const totalSHU = modalPortion + usahaPortion + m.carwashBonus;
        const memberDividend = adjustedJasaModalPool + adjustedJasaUsahaPool + totalCarwashBonus;

        return {
            ...m,
            modalPortion,
            usahaPortion,
            shuAmount: totalSHU,
            shuShare: totalSHU,
            percentage: memberDividend > 0 ? Number(((totalSHU / memberDividend) * 100).toFixed(2)) : 0
        };
    });

    const incomeDetails = Object.values(incomeAccounts).sort((a, b) => b.amount - a.amount);
    const expenseDetails = Object.values(expenseAccounts).sort((a, b) => b.amount - a.amount);

    return {
        year,
        month,
        periodLabel,
        totalIncome,
        totalExpense: totalExpense + totalCarwashBonus, // Beban SHU Cuci Mobil masuk ke total pengeluaran
        netSurplus: adjustedNetSurplus,
        memberRatio,
        nonMemberRatio,
        memberSurplus: adjustedMemberSurplus,
        nonMemberSurplus: adjustedNonMemberSurplus,
        jasaModalPool: adjustedJasaModalPool,
        jasaUsahaPool: adjustedJasaUsahaPool,
        memberDividend: adjustedJasaModalPool + adjustedJasaUsahaPool + totalCarwashBonus,
        totalSavingsCapital: totalSystemSavings,
        memberCount: members.length,
        totalCarwashBonus,

        allocationsMember,
        allocationsNonMember,
        
        memberDistribution: memberDistribution.sort((a, b) => b.shuAmount - a.shuAmount),

        incomeDetails,
        expenseDetails: [
            ...Object.values(expenseAccounts).sort((a, b) => b.amount - a.amount),
            ...(totalCarwashBonus > 0 ? [{ code: "CW-SHU", name: "Beban SHU Cuci Mobil (Rp 2.000/transaksi)", amount: totalCarwashBonus }] : [])
        ]
    };
}

