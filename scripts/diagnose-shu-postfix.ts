/**
 * Post-fix diagnostic — verifikasi bahwa CashBankTransaction expense
 * yang journalId=NULL sekarang akan masuk ke SHU
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const NON_EXPENSE_CATEGORIES = [
    "pencairan_pinjaman", "transfer", "savings",
    "simpanan_pokok", "simpanan_wajib", "simpanan_sukarela",
    "angsuran_pokok", "void_penjualan_toko", "void_unit_transaction",
    "pendapatan_unit", "jasa_pinjaman",
];

async function main() {
    const year = 2026;
    const startDate = new Date(Date.UTC(year, 0, 1));
    const endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    console.log("=== POST-FIX DIAGNOSTIK ===");
    console.log("");

    // 1. Cek berapa CashBankTransaction expense yang journalId=NULL (akan masuk ke SHU sekarang)
    const nonJournaledExpenses = await prisma.cashBankTransaction.groupBy({
        by: ["category"],
        where: {
            transactionDate: { gte: startDate, lte: endDate },
            type: "out",
            journalId: null,
            category: { notIn: NON_EXPENSE_CATEGORIES },
        },
        _count: true,
        _sum: { amount: true },
    });

    console.log("[1] CashBankTransaction type=out, journalId=NULL, NOT in blacklist:");
    console.log("    (Ini yang SEKARANG akan masuk ke totalExpense SHU via journal path)");
    let totalNonJournaled = 0;
    if (nonJournaledExpenses.length === 0) {
        console.log("    ❌ TIDAK ADA — semua expense sudah dijurnal!");
    } else {
        nonJournaledExpenses.forEach(row => {
            const amount = Number(row._sum.amount ?? 0);
            totalNonJournaled += amount;
            console.log(`    [${row.category ?? "NULL"}] → ${row._count} tx, Rp ${amount.toLocaleString("id-ID")}`);
        });
        console.log(`    TOTAL: Rp ${totalNonJournaled.toLocaleString("id-ID")}`);
    }
    console.log("");

    // 2. Cek berapa yang SUDAH dijurnal (journalId NOT NULL) — ini sudah dihitung via journal path
    const journaledExpenses = await prisma.cashBankTransaction.groupBy({
        by: ["category"],
        where: {
            transactionDate: { gte: startDate, lte: endDate },
            type: "out",
            journalId: { not: null },
            category: { notIn: NON_EXPENSE_CATEGORIES },
        },
        _count: true,
        _sum: { amount: true },
    });

    console.log("[2] CashBankTransaction type=out, journalId NOT NULL (sudah dijurnal — TIDAK dihitung ulang):");
    let totalJournaled = 0;
    if (journaledExpenses.length === 0) {
        console.log("    Tidak ada expense yang sudah dijurnal");
    } else {
        journaledExpenses.forEach(row => {
            const amount = Number(row._sum.amount ?? 0);
            totalJournaled += amount;
            console.log(`    [${row.category ?? "NULL"}] → ${row._count} tx, Rp ${amount.toLocaleString("id-ID")}`);
        });
        console.log(`    TOTAL: Rp ${totalJournaled.toLocaleString("id-ID")}`);
    }
    console.log("");

    // 3. Unit breakdown — expenses per unit setelah blacklist
    const expenseByUnit = await prisma.cashBankTransaction.groupBy({
        by: ["unitType"],
        where: {
            transactionDate: { gte: startDate, lte: endDate },
            type: "out",
            category: { notIn: NON_EXPENSE_CATEGORIES },
        },
        _sum: { amount: true },
        _count: true,
    });

    console.log("[3] EXPENSE PER UNIT (blacklist filter — semua expense termasuk lainnya):");
    let totalBreakdown = 0;
    expenseByUnit.forEach(row => {
        const amount = Number(row._sum.amount ?? 0);
        totalBreakdown += amount;
        const label = row.unitType || "NULL (Beban Umum)";
        console.log(`    [${label}] → ${row._count} tx, Rp ${amount.toLocaleString("id-ID")}`);
    });
    console.log(`    TOTAL: Rp ${totalBreakdown.toLocaleString("id-ID")}`);
    console.log("");

    // 4. Ringkasan
    console.log("=== RINGKASAN DAMPAK FIX ===");
    console.log(`Expense non-journaled (BARU masuk SHU): Rp ${totalNonJournaled.toLocaleString("id-ID")}`);
    console.log(`Expense sudah dijurnal (sudah masuk):   Rp ${totalJournaled.toLocaleString("id-ID")}`);
    console.log(`Total expense di unit breakdown:        Rp ${totalBreakdown.toLocaleString("id-ID")}`);

    await prisma.$disconnect();
}

main().catch(console.error);
