import prisma from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { getCarwashBonusPerTx } from "./shu-settings";
import { UNIT_TYPES, STORE_SALE_ALIASES, canonicalStoreUnitType } from "@/lib/constants/units";
import type { SPMonthlyItem, ExpenseGroup } from "@/app/(protected)/laporan/shu/_types";

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

// Void reversal categories — CB income dengan kategori ini atau yang memiliki
// void reversal terkait harus dikecualikan dari SHU income
const VOID_CATEGORIES = ["void_penjualan_toko", "void_unit_transaction"];

// Kategori CB income yg adalah MIRROR dari StoreSale/UnitTransaction (sudah terwakili di revenue).
// Harus di-exclude dari unitBreakdown revenue supaya tidak dobel-hitung.
const MIRROR_INCOME_CATEGORIES = ["pendapatan_unit", "pendapatan_toko"];

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
    "penalti_pelunasan",      // Income bukan expense
    "dana_resiko",            // Income bukan expense
    // --- Dikecualikan dari SHU ---
    "lainnya",                // Pengeluaran non-operasional → tidak relevan untuk SHU per-anggota
];

// Kategori CashBankTransaction type=in yang BUKAN pendapatan riil (blacklist approach)
// Semua kategori selain ini dianggap sebagai pendapatan untuk SHU
const NON_INCOME_CATEGORIES = [
    "savings",              // Penarikan simpanan
    "simpanan_pokok",       // Setoran simpanan pokok (modal, bukan revenue)
    "simpanan_wajib",       // Setoran simpanan wajib (modal, bukan revenue)
    "simpanan_sukarela",    // Setoran simpanan sukarela (modal, bukan revenue)
    "setoran_simpanan",     // Setoran simpanan (mobile)
    "transfer",             // Transfer antar rekening (bukan revenue)
    "pencairan_pinjaman",   // Pencairan pinjaman (bukan revenue)
    "angsuran_pokok",       // Pembayaran pokok pinjaman (hutang, bukan revenue)
    "loan",                 // Generic loan reference (member portal)
    // --- Dikecualikan dari SHU (tidak dari unit/SP) ---
    "lainnya",              // Pendapatan non-operasional → memperbesar SHU tidak wajar
    "biaya_operasional",    // Pendapatan operasional lain (type=in, non-core) → memperbesar SHU
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

// Label mapping untuk CashBankTransaction income categories
const CB_INCOME_LABELS: Record<string, { code: string; name: string }> = {
    jasa_pinjaman: { code: "SP-JASA", name: "Jasa Pinjaman (Bunga)" },
    dana_resiko: { code: "SP-RESIKO", name: "Dana Resiko (Admin Fee)" },
    pendapatan_unit: { code: "UNT-REV", name: "Pendapatan Unit Layanan" },
    pendapatan_toko: { code: "TOKO-REV", name: "Pendapatan Toko" },
    operational: { code: "OPS-REV", name: "Pemasukan Operasional" },
    lainnya: { code: "INC-LAIN", name: "Pendapatan Lainnya" },
    biaya_operasional: { code: "OPS-MISC", name: "Pendapatan Operasional Lain" },
    penalti_pelunasan: { code: "SP-PENALTI", name: "Penalti Pelunasan Dipercepat" },
};

// Mapping CB income categories → income group
const INCOME_GROUP_MAP: Record<string, "unit" | "sp" | "lainnya"> = {
    pendapatan_unit: "unit",
    pendapatan_toko: "unit",
    operational: "unit",
    jasa_pinjaman: "sp",
    dana_resiko: "sp",
    penalti_pelunasan: "sp",
    biaya_operasional: "lainnya",
    lainnya: "lainnya",
};

// SP categories untuk kategorisasi income dari CB
const SP_CATEGORIES = new Set(["jasa_pinjaman", "dana_resiko", "penalti_pelunasan"]);
const UNIT_CATEGORIES = new Set(["pendapatan_unit", "pendapatan_toko", "operational"]);

// Mapping expense account codes → expense group
const EXPENSE_GROUP_MAP: Record<string, string> = {
    "CB-OP": "operasional",
    "CB-OPS": "operasional",
    "CW-SHU": "operasional",
    "CB-UNIT": "unit_beban",
    "ST-COGS": "unit_beban",
    "CB-HPP": "unit_beban",
    "CB-MITRA": "unit_beban",
    "CB-LAIN": "lainnya",
};

// Mapping expense account codes → expense group (for detail-transactions API)
export const GROUP_EXPENSE_CATEGORIES: Record<string, string[]> = {
    operasional: ["biaya_operasional", "operational"],
    unit_beban: ["beban_unit", "hpp_toko", "hutang_mitra"],
    lainnya: ["lainnya"],
};

interface IncomeGroup {
    key: string;
    label: string;
    amount: number;
    details: { code: string; name: string; amount: number }[];
}

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
                // Skip "Pendapatan Lain-lain" (accounts 43xx-45xx) — tidak relevan untuk SHU
                const code = line.account.code || "";
                if (code.startsWith("43") || code.startsWith("44") || code.startsWith("45")) continue;
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

        // === VOID EXCLUSION: CB income yang sudah di-void harus dikecualikan ===
        // Saat transaksi di-void, sistem membuat CB reversal (void_penjualan_toko/
        // void_unit_transaction) tapi TIDAK update CB income asli. Void reversal masuk
        // NON_EXPENSE_CATEGORIES (bukan expense riil), jadi income asli tetap terhitung
        // sebagai phantom income. Fix: query void reversal, extract sale refs, exclude.
        const voidedCbRefs = await prisma.cashBankTransaction.findMany({
            where: {
                transactionDate: { gte: startDate, lte: endDate },
                category: { in: VOID_CATEGORIES },
            },
            select: { description: true },
        });
        const voidedSaleRefSet = new Set<string>();
        const SALE_REF_REGEX = /\b([A-Z]{2}-\d{8}-\d{4}|CM\d{12})\b/g;
        voidedCbRefs.forEach(v => {
            let m;
            while ((m = SALE_REF_REGEX.exec(v.description)) !== null) {
                voidedSaleRefSet.add(m[1]);
            }
        });

        // === INCOME MERGE: CB type=in non-journaled ===
        // Simetris dengan expense merge: tambahkan pendapatan dari CashBankTransaction
        // yang belum dijurnal (journalId=NULL). Ini mencakup: jasa_pinjaman,
        // pendapatan_unit, pendapatan_toko, operational, dana_resiko, lainnya, dll.
        const nonJournaledIncome = await prisma.cashBankTransaction.findMany({
            where: {
                transactionDate: { gte: startDate, lte: endDate },
                type: "in",
                journalId: null, // Hanya yang belum dijurnal (hindari double counting)
                category: { notIn: NON_INCOME_CATEGORIES },
            },
        });

        const cbIncomeByCategory: Record<string, number> = {};
        nonJournaledIncome.forEach(tx => {
            // Skip null category entries (dianggap "lainnya" — bukan income inti SHU)
            if (!tx.category) return;
            // Skip income CB yang memiliki void reversal (phantom income)
            const desc = tx.description || "";
            let isVoided = false;
            for (const ref of voidedSaleRefSet) {
                if (desc.includes(ref)) { isVoided = true; break; }
            }
            if (isVoided) return;
            const cat = tx.category;
            cbIncomeByCategory[cat] = (cbIncomeByCategory[cat] || 0) + toNum(tx.amount);
        });

        for (const [cat, amount] of Object.entries(cbIncomeByCategory)) {
            totalIncome += amount;
            const meta = CB_INCOME_LABELS[cat] || {
                code: `INC-${cat.toUpperCase().slice(0, 8)}`,
                name: `Pendapatan: ${cat.replace(/_/g, " ")}`,
            };
            if (incomeAccounts[meta.code]) {
                incomeAccounts[meta.code].amount += amount;
            } else {
                incomeAccounts[meta.code] = { code: meta.code, name: meta.name, amount };
            }
        }

        // === DANA RESIKO: Query langsung dari Loan.adminFee ===
        // Dana Resiko = 2% admin fee dari pencairan pinjaman. Tidak tercatat sebagai CB
        // karena dikurangi dari pencairan (member terima principal - adminFee).
        // Untuk SHU, query langsung dari tabel Loan.
        const danaResikoAgg = await prisma.loan.aggregate({
            where: {
                disbursementDate: { gte: startDate, lte: endDate },
                status: { in: ["active", "paid_off"] },
            },
            _sum: { adminFee: true },
        });
        const danaResikoTotal = toNum(danaResikoAgg._sum.adminFee);
        if (danaResikoTotal > 0) {
            totalIncome += danaResikoTotal;
            if (incomeAccounts["SP-RESIKO"]) {
                incomeAccounts["SP-RESIKO"].amount += danaResikoTotal;
            } else {
                incomeAccounts["SP-RESIKO"] = { code: "SP-RESIKO", name: "Dana Resiko (Admin Fee)", amount: danaResikoTotal };
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
                where: { transactionDate: { gte: startDate, lte: endDate }, type: "in", category: { notIn: [...NON_INCOME_CATEGORIES, "operational"] } }
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

        // === DANA RESIKO (Fallback Path) ===
        // Query langsung dari Loan.adminFee — tidak tercatat sebagai CB
        const danaResikoFallback = await prisma.loan.aggregate({
            where: {
                disbursementDate: { gte: startDate, lte: endDate },
                status: { in: ["active", "paid_off"] },
            },
            _sum: { adminFee: true },
        });
        const danaResikoAmount = toNum(danaResikoFallback._sum.adminFee);
        if (danaResikoAmount > 0) {
            totalIncome += danaResikoAmount;
            incomeAccounts["SP-RESIKO"] = { code: "SP-RESIKO", name: "Dana Resiko (Admin Fee)", amount: danaResikoAmount };
        }
    }

    const netSurplus = Math.max(0, totalIncome - totalExpense);

    // 1.5 Hitung Breakdown Per Unit (baik journal maupun fallback path)
    // Menggunakan blacklist untuk menangkap SEMUA expense operasional
    const [storeSalesRaw, unitTxByUnit, expenseByUnit, unitTxByMethod, nonMirrorIncomeByUnit] = await Promise.all([
        // StoreSale via findMany — HINDARI groupBy + filter void Prisma JSON NULL bug.
        // Satu findMany melayani aggregasi by-unit DAN by-method.
        prisma.storeSale.findMany({
            where: { createdAt: { gte: startDate, lte: endDate } },
            select: { unitType: true, totalAmount: true, paymentMethod: true, metadata: true },
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
        prisma.unitTransaction.groupBy({
            by: ['unitType', 'paymentMethod'],
            where: {
                transactionDate: { gte: startDate, lte: endDate },
                isPaid: true,
                status: "completed",
            },
            _sum: { amount: true },
            _count: true,
        }),
        // CB income NON-MIRROR (operational, jasa_pinjaman, dana_resiko, dll) — masuk revenue per unit.
        // EXCLUDE mirror POS + NON_INCOME + VOID supaya tidak dobel dgn StoreSale/UnitTransaction.
        prisma.cashBankTransaction.groupBy({
            by: ['unitType'],
            where: {
                transactionDate: { gte: startDate, lte: endDate },
                type: "in",
                journalId: null,
                category: { notIn: [...NON_INCOME_CATEGORIES, ...VOID_CATEGORIES, ...MIRROR_INCOME_CATEGORIES] },
            },
            _sum: { amount: true },
            _count: true,
        }),
    ]);

    // Agregasi StoreSale di JS: saring voided (filter benar), roll-up alias, by-unit + by-method
    const activeStoreSales = storeSalesRaw.filter(s => !((s.metadata as any)?.isVoided));
    const storeUnitAgg: Record<string, { revenue: number; count: number }> = {};
    const storeMethodAgg: Record<string, Record<string, { amount: number; count: number }>> = {};
    for (const s of activeStoreSales) {
        const ut = canonicalStoreUnitType(s.unitType);
        const amt = toNum(s.totalAmount);
        if (!storeUnitAgg[ut]) storeUnitAgg[ut] = { revenue: 0, count: 0 };
        storeUnitAgg[ut].revenue += amt;
        storeUnitAgg[ut].count += 1;
        const m = s.paymentMethod || "cash";
        if (!storeMethodAgg[ut]) storeMethodAgg[ut] = {};
        if (!storeMethodAgg[ut][m]) storeMethodAgg[ut][m] = { amount: 0, count: 0 };
        storeMethodAgg[ut][m].amount += amt;
        storeMethodAgg[ut][m].count += 1;
    }

    // === Build payment method breakdown per unit ===
    // Normalize: salary_cut → Potong Gaji, qris → QRIS, cash → Tunai
    const METHOD_LABELS: Record<string, string> = {
        cash: "Tunai",
        qris: "QRIS",
        salary_cut: "Potong Gaji",
        bank_transfer: "Transfer Bank",
        credit: "Potong Gaji",
    };
    type MethodBreakdown = { method: string; label: string; amount: number; count: number };
    const unitMethodMap: Record<string, Record<string, MethodBreakdown>> = {};

    function addMethodEntry(unitKey: string, method: string | null, amount: number, count: number) {
        const m = method || "cash";
        if (!unitMethodMap[unitKey]) unitMethodMap[unitKey] = {};
        if (!unitMethodMap[unitKey][m]) {
            unitMethodMap[unitKey][m] = { method: m, label: METHOD_LABELS[m] || m, amount: 0, count: 0 };
        }
        unitMethodMap[unitKey][m].amount += amount;
        unitMethodMap[unitKey][m].count += count;
    }

    for (const [ut, methods] of Object.entries(storeMethodAgg)) {
        for (const [m, v] of Object.entries(methods)) {
            addMethodEntry(ut, m, v.amount, v.count);
        }
    }
    for (const u of unitTxByMethod) {
        addMethodEntry(u.unitType, u.paymentMethod, toNum(u._sum.amount), u._count);
    }

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

    // Revenue per unit: StoreSale (source of truth utk store) + UnitTransaction (service).
    // CB pendapatan_toko/pendapatan_unit DIHAPUS — itu mirror dari StoreSale/UnitTransaction
    // (dobel-hitung, lihat docs/superpowers/specs/2026-06-30-laba-kotor-per-unit-design.md Bug A).
    const unitRevenueMap: Record<string, { revenue: number; txCount: number }> = {};
    for (const [ut, v] of Object.entries(storeUnitAgg)) {
        unitRevenueMap[ut] = { revenue: v.revenue, txCount: v.count };
    }
    for (const u of unitTxByUnit) {
        const ut = u.unitType;
        if (!unitRevenueMap[ut]) unitRevenueMap[ut] = { revenue: 0, txCount: 0 };
        unitRevenueMap[ut].revenue += toNum(u._sum.amount);
        unitRevenueMap[ut].txCount += u._count;
    }
    // Merge CB income NON-MIRROR per canonical unit (operational dll — restore fix Task 5 yg terlalu radikal).
    // Mirror POS (pendapatan_unit/pendapatan_toko) sengaja di-exclude (sudah via StoreSale/UT di atas).
    for (const i of nonMirrorIncomeByUnit) {
        const ut = i.unitType || "simpan_pinjam";
        if (!unitRevenueMap[ut]) unitRevenueMap[ut] = { revenue: 0, txCount: 0 };
        unitRevenueMap[ut].revenue += toNum(i._sum.amount);
        unitRevenueMap[ut].txCount += i._count;
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
            paymentMethodBreakdown: Object.values(unitMethodMap[ut] || {})
                .sort((a, b) => b.amount - a.amount),
        })),
        // Tambahkan baris "Beban Umum" untuk expense yang unitType=NULL/none
        ...(unallocatedExpense > 0 ? [{
            unitType: "_umum",
            label: "Beban Umum (Belum Dialokasi)",
            category: "service" as const,
            revenue: 0,
            expense: unallocatedExpense,
            transactionCount: unallocatedExpenseCount,
            paymentMethodBreakdown: [] as MethodBreakdown[],
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
        // KNOWN BUG (deferred): NOT+path void filter drops key-less sales — same Prisma JSON NULL
        // bug fixed in unitBreakdown above. memberRatio understated until separate spec. See
        // docs/superpowers/specs/2026-06-30-laba-kotor-per-unit-design.md §2 (non-goals).
        prisma.storeSale.aggregate({
            where: { createdAt: { gte: startDate, lte: endDate }, memberId: { not: null }, NOT: { metadata: { path: ["isVoided"], equals: true } } as any },
            _sum: { totalAmount: true }
        }),
        // KNOWN BUG (deferred): NOT+path void filter drops key-less sales — same Prisma JSON NULL
        // bug fixed in unitBreakdown above. memberRatio understated until separate spec. See
        // docs/superpowers/specs/2026-06-30-laba-kotor-per-unit-design.md §2 (non-goals).
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

    // === KATEGORISASI INCOME KE 3 GRUP ===
    // Pendapatan Unit Usaha, Pendapatan SimpanPinjam (SP), Pendapatan Lainnya
    const incomeGroups: IncomeGroup[] = [
        { key: "unit", label: "Pendapatan Unit Usaha", amount: 0, details: [] },
        { key: "sp", label: "Pendapatan SimpanPinjam (SP)", amount: 0, details: [] },
        { key: "lainnya", label: "Pendapatan Lainnya", amount: 0, details: [] },
    ];

    for (const detail of incomeDetails) {
        // Cari group berdasarkan code pattern
        let groupKey: "unit" | "sp" | "lainnya" = "lainnya";

        if (detail.code.startsWith("41")) {
            // Chart of accounts 41xx = Pendapatan Usaha Simpan Pinjam → SP
            // (4101 Bunga Pinjaman, 4102 Admin Pinjaman, 4103 Denda)
            groupKey = "sp";
        } else if (detail.code.startsWith("42")) {
            // Chart of accounts 42xx = Pendapatan Usaha Unit → Unit
            // (4201 Pendapatan Toko, 4202-4204 Unit layanan lainnya)
            groupKey = "unit";
        } else if (detail.code.startsWith("43") || detail.code.startsWith("44") || detail.code.startsWith("45")) {
            // Chart of accounts 43xx-45xx = Pendapatan Lain-lain → Lainnya
            groupKey = "lainnya";
        } else if (detail.code === "UNT-REV" || detail.code === "TOKO-REV" || detail.code === "OPS-REV" || detail.code === "UT-INC" || detail.code === "ST-INC") {
            groupKey = "unit";
        } else if (detail.code === "SP-JASA" || detail.code === "SP-RESIKO" || detail.code === "SP-PENALTI" || detail.code === "LN-INC") {
            groupKey = "sp";
        } else if (detail.code === "CB-INC" || detail.code === "INC-LAIN" || detail.code === "OPS-MISC") {
            groupKey = "lainnya";
        } else if (detail.code.startsWith("INC-")) {
            // Unknown income category → lainnya
            groupKey = "lainnya";
        }

        const group = incomeGroups.find(g => g.key === groupKey)!;
        group.amount += detail.amount;
        group.details.push({ code: detail.code, name: detail.name, amount: detail.amount });
    }

    // === SP MONTHLY BREAKDOWN ===
    // Rincian bulanan Pendapatan SimpanPinjam (Jasa Pinjaman, Dana Resiko, Penalti)
    const [spPaymentsByMonth, spLoansByMonth, spPenaltiByMonth] = await Promise.all([
        // Jasa Pinjaman per bulan (dari LoanPayment.interestPortion)
        prisma.loanPayment.findMany({
            where: { paymentDate: { gte: startDate, lte: endDate }, status: { not: "voided" } },
            select: { paymentDate: true, interestPortion: true },
        }),
        // Dana Resiko per bulan (dari Loan.adminFee, berdasarkan tanggal pencairan)
        prisma.loan.findMany({
            where: { disbursementDate: { gte: startDate, lte: endDate }, status: { in: ["active", "paid_off"] }, adminFee: { gt: 0 } },
            select: { disbursementDate: true, adminFee: true },
        }),
        // Penalti Pelunasan per bulan (dari CB category penalti_pelunasan)
        prisma.cashBankTransaction.findMany({
            where: { transactionDate: { gte: startDate, lte: endDate }, type: "in", category: "penalti_pelunasan", journalId: null },
            select: { transactionDate: true, amount: true },
        }),
    ]);

    // Group each by YYYY-MM
    const monthMap = new Map<string, { jasa: number; danaResiko: number; penalti: number }>();
    const ensureMonth = (m: string) => {
        if (!monthMap.has(m)) monthMap.set(m, { jasa: 0, danaResiko: 0, penalti: 0 });
        return monthMap.get(m)!;
    };

    spPaymentsByMonth.forEach(lp => {
        const m = lp.paymentDate.toISOString().slice(0, 7);
        ensureMonth(m).jasa += toNum(lp.interestPortion);
    });
    spLoansByMonth.forEach(loan => {
        const m = loan.disbursementDate.toISOString().slice(0, 7);
        ensureMonth(m).danaResiko += toNum(loan.adminFee);
    });
    spPenaltiByMonth.forEach(tx => {
        const m = tx.transactionDate.toISOString().slice(0, 7);
        ensureMonth(m).penalti += toNum(tx.amount);
    });

    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const spMonthlyBreakdown: SPMonthlyItem[] = Array.from(monthMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([m, d]) => ({
            month: m,
            monthLabel: `${monthNames[parseInt(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`,
            jasaPinjaman: d.jasa,
            danaResiko: d.danaResiko,
            penalti: d.penalti,
            total: d.jasa + d.danaResiko + d.penalti,
        }));

    // === EXPENSE GROUPS ===
    // Kategorisasi expense ke 3 grup (mirip income groups)
    const expenseGroups: ExpenseGroup[] = [
        { key: "operasional", label: "Beban Operasional Umum", amount: 0, details: [] },
        { key: "unit_beban", label: "Beban Unit Usaha", amount: 0, details: [] },
        { key: "lainnya", label: "Beban Lainnya", amount: 0, details: [] },
    ];

    // Include CW-SHU in the expense details for grouping
    const allExpenseDetails = [
        ...Object.values(expenseAccounts).sort((a, b) => b.amount - a.amount),
        ...(totalCarwashBonus > 0 ? [{ code: "CW-SHU", name: "Beban SHU Cuci Mobil (Rp 2.000/transaksi)", amount: totalCarwashBonus }] : []),
    ];

    for (const detail of allExpenseDetails) {
        const groupKey = EXPENSE_GROUP_MAP[detail.code] || "lainnya";
        const group = expenseGroups.find(g => g.key === groupKey)!;
        group.amount += detail.amount;
        group.details.push({ code: detail.code, name: detail.name, amount: detail.amount });
    }

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
        incomeGroups, // 3-group income breakdown
        spMonthlyBreakdown, // SP monthly breakdown (Jasa, Dana Resiko, Penalti per bulan)
        expenseDetails: allExpenseDetails,
        expenseGroups, // 3-group expense breakdown

        unitBreakdown,
    };
}

