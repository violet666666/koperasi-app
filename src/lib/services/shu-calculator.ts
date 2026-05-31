import prisma from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { getCarwashBonusPerTx } from "./shu-settings";
import { UNIT_TYPES } from "@/lib/constants/units";

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

// Kategori CashBankTransaction yang BUKAN expense operasional (blacklist approach)
// Semua kategori selain ini dianggap sebagai pengeluaran operasional untuk SHU
const NON_EXPENSE_CATEGORIES = [
    "pencairan_pinjaman",    // Disbursement pinjaman, bukan expense
    "transfer",               // Transfer antar rekening
    "savings",                // Penarikan simpanan
    "simpanan_pokok",         // Pengembalian simpanan
    "simpanan_wajib",         // Pengembalian simpanan
    "simpanan_sukarela",      // Penarikan simpanan
    "angsuran_pokok",         // Bagian pokok angsuran, bukan expense
    "void_penjualan_toko",    // Void/pembatalan, bukan real expense
    "void_unit_transaction",  // Void/pembatalan, bukan real expense
    "pendapatan_unit",        // Income bukan expense
    "jasa_pinjaman",          // Income bukan expense
];

// Label mapping untuk CashBankTransaction expense categories
const CB_EXPENSE_LABELS: Record<string, { code: string; name: string }> = {
    biaya_operasional: { code: "CB-OP", name: "Biaya Operasional Umum" },
    beban_unit: { code: "CB-UNIT", name: "Beban Operasional Unit Usaha" },
    hpp_toko: { code: "CB-HPP", name: "HPP / Pembelian Barang (Restocking)" },
    hutang_mitra: { code: "CB-MITRA", name: "Kewajiban Bagi Hasil Mitra" },
    operational: { code: "CB-OPS", name: "Biaya Operasional (Legacy)" },
    lainnya: { code: "CB-LAIN", name: "Pengeluaran Lainnya" },
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

    let interestTotal = 0;

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
        // Income/expense dari posting jurnal akuntansi
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

        // COGS tidak dijurnal oleh store sales — hitung langsung dari StoreSaleItems
        const soldItems = await prisma.storeSaleItem.findMany({
            where: {
                sale: {
                    createdAt: { gte: startDate, lte: endDate },
                    NOT: { metadata: { path: ["isVoided"], equals: true } } as any,
                },
            },
            include: { product: { select: { costPrice: true } } },
        });
        let cogsTotal = 0;
        soldItems.forEach(item => {
            const cp = toNum(item.costPrice);
            cogsTotal += item.quantity * (cp > 0 ? cp : toNum(item.product?.costPrice));
        });
        if (cogsTotal > 0) {
            totalExpense += cogsTotal;
            expenseAccounts["ST-COGS"] = { code: "ST-COGS", name: "HPP (Modal Barang)", amount: cogsTotal };
        }

        // PENTING: CashBankTransaction yang BELUM dijurnal (journalId=NULL) juga harus
        // masuk ke expense — ini adalah pengeluaran operasional unit (Kas Keluar) yang
        // diinput operator tapi belum membentuk jurnal otomatis.
        const nonJournaledExpenses = await prisma.cashBankTransaction.findMany({
            where: {
                transactionDate: { gte: startDate, lte: endDate },
                type: "out",
                journalId: null, // Hanya yang belum dijurnal (hindari double counting)
                category: { notIn: NON_EXPENSE_CATEGORIES },
            },
        });

        // Group by category dan tambahkan ke expense
        const cbExpenseByCategory: Record<string, number> = {};
        nonJournaledExpenses.forEach(tx => {
            const cat = tx.category || "lainnya";
            cbExpenseByCategory[cat] = (cbExpenseByCategory[cat] || 0) + toNum(tx.amount);
        });

        for (const [cat, amount] of Object.entries(cbExpenseByCategory)) {
            totalExpense += amount;
            const meta = CB_EXPENSE_LABELS[cat] || { code: `CB-${cat.toUpperCase().slice(0, 8)}`, name: `Kas Keluar: ${cat.replace(/_/g, " ")}` };
            if (expenseAccounts[meta.code]) {
                expenseAccounts[meta.code].amount += amount;
            } else {
                expenseAccounts[meta.code] = { code: meta.code, name: meta.name, amount };
            }
        }
    } else {
        // FALLBACK: Bila Jurnal belum terbentuk utuh, hitung langsung dari CashBankTransaction
        // Menggunakan blacklist approach — semua type='out' dianggap expense KECUALI yang di-exclude
        const [expensesTx, incomeTx, loanInterestAgg, unitTx, storeSalesInc, soldItems] = await Promise.all([
            prisma.cashBankTransaction.findMany({
                where: {
                    transactionDate: { gte: startDate, lte: endDate },
                    type: "out",
                    category: { notIn: NON_EXPENSE_CATEGORIES },
                }
            }),
            prisma.cashBankTransaction.findMany({
                where: { transactionDate: { gte: startDate, lte: endDate }, type: "in", category: { notIn: ["savings", "loan", "transfer", "operational"] } }
            }),
            prisma.loanPayment.aggregate({
                where: { paymentDate: { gte: startDate, lte: endDate }, status: { not: "voided" } },
                _sum: { interestPortion: true }
            }),
            prisma.unitTransaction.aggregate({
                where: { transactionDate: { gte: startDate, lte: endDate }, isPaid: true, status: "completed" },
                _sum: { amount: true }
            }),
            prisma.storeSale.aggregate({
                where: { createdAt: { gte: startDate, lte: endDate }, NOT: { metadata: { path: ["isVoided"], equals: true } } as any },
                _sum: { totalAmount: true }
            }),
            prisma.storeSaleItem.findMany({
                where: { sale: { createdAt: { gte: startDate, lte: endDate }, NOT: { metadata: { path: ["isVoided"], equals: true } } as any } },
                include: { product: { select: { costPrice: true } } }
            }),
        ]);

        // Breakdown pengeluaran per kategori untuk transparansi
        const expenseByCategory: Record<string, number> = {};
        expensesTx.forEach(tx => {
            const cat = tx.category || "lainnya";
            expenseByCategory[cat] = (expenseByCategory[cat] || 0) + toNum(tx.amount);
        });

        for (const [cat, amount] of Object.entries(expenseByCategory)) {
            totalExpense += amount;
            const meta = CB_EXPENSE_LABELS[cat] || { code: `CB-${cat.toUpperCase().slice(0, 8)}`, name: `Kas Keluar: ${cat.replace(/_/g, " ")}` };
            expenseAccounts[meta.code] = { code: meta.code, name: meta.name, amount };
        }

        const cbIncomeTotal = incomeTx.reduce((sum, tx) => sum + toNum(tx.amount), 0);
        totalIncome += cbIncomeTotal;
        if (cbIncomeTotal > 0) incomeAccounts["CB-INC"] = { code: "CB-INC", name: "Pendapatan Lainnya (Kas)", amount: cbIncomeTotal };

        interestTotal = toNum(loanInterestAgg._sum.interestPortion);
        if (interestTotal > 0) {
            totalIncome += interestTotal;
            incomeAccounts["LN-INC"] = { code: "LN-INC", name: "Pendapatan Jasa Pinjaman", amount: interestTotal };
        }

        const unitTxTotal = toNum(unitTx._sum.amount);
        if (unitTxTotal > 0) {
            totalIncome += unitTxTotal;
            incomeAccounts["UT-INC"] = { code: "UT-INC", name: "Pendapatan Usaha Jasa Unit", amount: unitTxTotal };
        }

        const storeIncTotal = toNum(storeSalesInc._sum.totalAmount);
        if (storeIncTotal > 0) {
            totalIncome += storeIncTotal;
            incomeAccounts["ST-INC"] = { code: "ST-INC", name: "Omzet Bruto Toko", amount: storeIncTotal };
        }

        let cogsTotal = 0;
        soldItems.forEach(item => {
            const cp = toNum(item.costPrice);
            cogsTotal += item.quantity * (cp > 0 ? cp : toNum(item.product?.costPrice));
        });
        if (cogsTotal > 0) {
            totalExpense += cogsTotal;
            expenseAccounts["ST-COGS"] = { code: "ST-COGS", name: "HPP Toko (Modal Barang)", amount: cogsTotal };
        }
    }

    const netSurplus = Math.max(0, totalIncome - totalExpense);

    // 1.5 Hitung Breakdown Per Unit (baik journal maupun fallback path)
    // Menggunakan blacklist untuk menangkap SEMUA expense operasional
    const [storeSalesByUnit, unitTxByUnit, expenseByUnit] = await Promise.all([
        prisma.storeSale.groupBy({
            by: ['unitType'],
            where: {
                createdAt: { gte: startDate, lte: endDate },
                NOT: { metadata: { path: ["isVoided"], equals: true } } as any,
            },
            _sum: { totalAmount: true },
            _count: true,
        }),
        prisma.unitTransaction.groupBy({
            by: ['unitType'],
            where: {
                transactionDate: { gte: startDate, lte: endDate },
                isPaid: true,
                status: "completed",
            },
            _sum: { amount: true },
            _count: true,
        }),
        // Pengeluaran per unit dari Kas & Bank — blacklist approach (termasuk NULL unitType)
        prisma.cashBankTransaction.groupBy({
            by: ['unitType'],
            where: {
                transactionDate: { gte: startDate, lte: endDate },
                type: "out",
                category: { notIn: NON_EXPENSE_CATEGORIES },
            },
            _sum: { amount: true },
            _count: true,
        }),
    ]);

    // Build expense map per unitType (termasuk NULL sebagai 'umum')
    const unitExpenseMap: Record<string, number> = {};
    let unallocatedExpense = 0;
    let unallocatedExpenseCount = 0;
    expenseByUnit.forEach(e => {
        if (e.unitType && e.unitType !== "none" && e.unitType !== "simpan_pinjam") {
            unitExpenseMap[e.unitType] = toNum(e._sum.amount);
        } else {
            // unitType=NULL, 'none', atau 'simpan_pinjam' → beban umum
            unallocatedExpense += toNum(e._sum.amount);
            unallocatedExpenseCount += (e as any)._count || 0;
        }
    });

    // Merge revenue dari StoreSale dan UnitTransaction ke satu map (hindari duplikat unit)
    const unitRevenueMap: Record<string, { revenue: number; txCount: number }> = {};
    for (const s of storeSalesByUnit) {
        const ut = s.unitType || "toko";
        if (!unitRevenueMap[ut]) unitRevenueMap[ut] = { revenue: 0, txCount: 0 };
        unitRevenueMap[ut].revenue += toNum(s._sum.totalAmount);
        unitRevenueMap[ut].txCount += s._count;
    }
    for (const u of unitTxByUnit) {
        const ut = u.unitType;
        if (!unitRevenueMap[ut]) unitRevenueMap[ut] = { revenue: 0, txCount: 0 };
        unitRevenueMap[ut].revenue += toNum(u._sum.amount);
        unitRevenueMap[ut].txCount += u._count;
    }

    // Gabungkan juga unit yang hanya punya expense tapi tidak punya revenue
    for (const ut of Object.keys(unitExpenseMap)) {
        if (!unitRevenueMap[ut]) unitRevenueMap[ut] = { revenue: 0, txCount: 0 };
    }

    const unitBreakdown = [
        ...Object.entries(unitRevenueMap).map(([ut, data]) => ({
            unitType: ut,
            label: (UNIT_TYPES as Record<string, any>)[ut]?.label || ut.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
            category: (UNIT_TYPES as Record<string, any>)[ut]?.category === "store" ? "store" as const : "service" as const,
            revenue: data.revenue,
            expense: unitExpenseMap[ut] || 0,
            transactionCount: data.txCount,
        })),
        // Tambahkan baris "Beban Umum" untuk expense yang unitType=NULL/none
        ...(unallocatedExpense > 0 ? [{
            unitType: "_umum",
            label: "Beban Umum (Belum Dialokasi)",
            category: "service" as const,
            revenue: 0,
            expense: unallocatedExpense,
            transactionCount: unallocatedExpenseCount,
        }] : []),
    ];

    // 2. Hitung Rasio Member vs Non-Member berdasarkan Omzet (parallel)
    let memberGrossIncome = 0;
    let nonMemberGrossIncome = 0;

    const [
        storeSalesMember,
        storeSalesNonMember,
        loanInterestRatio,
        unitTxMember,
        unitTxNonMember,
    ] = await Promise.all([
        prisma.storeSale.aggregate({
            where: { createdAt: { gte: startDate, lte: endDate }, memberId: { not: null }, NOT: { metadata: { path: ["isVoided"], equals: true } } as any },
            _sum: { totalAmount: true }
        }),
        prisma.storeSale.aggregate({
            where: { createdAt: { gte: startDate, lte: endDate }, memberId: null, NOT: { metadata: { path: ["isVoided"], equals: true } } as any },
            _sum: { totalAmount: true }
        }),
        Promise.resolve({ _sum: { interestPortion: interestTotal } }),
        prisma.unitTransaction.aggregate({
            where: { transactionDate: { gte: startDate, lte: endDate }, isPaid: true, status: "completed", memberId: { not: null } },
            _sum: { amount: true }
        }),
        prisma.unitTransaction.aggregate({
            where: { transactionDate: { gte: startDate, lte: endDate }, isPaid: true, status: "completed", memberId: null },
            _sum: { amount: true }
        }),
    ]);

    memberGrossIncome += toNum(storeSalesMember._sum.totalAmount);
    nonMemberGrossIncome += toNum(storeSalesNonMember._sum.totalAmount);
    memberGrossIncome += toNum(loanInterestRatio._sum.interestPortion);
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
                where: { paymentDate: { gte: startDate, lte: endDate }, status: { not: "voided" } },
                select: { principalPortion: true, interestPortion: true }
            },
            storeSales: {
                where: { createdAt: { gte: startDate, lte: endDate } },
                select: { totalAmount: true, metadata: true }
            },
            unitTransactions: {
                where: { transactionDate: { gte: startDate, lte: endDate }, status: "completed", isPaid: true },
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
        ],

        unitBreakdown,
    };
}

