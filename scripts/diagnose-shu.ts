/**
 * Diagnostic script untuk memeriksa data SHU di database
 * Jalankan: npx tsx scripts/diagnose-shu.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const year = 2026;
    const startDate = new Date(Date.UTC(year, 0, 1));
    const endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    console.log("=== DIAGNOSTIK SHU ===");
    console.log(`Periode: ${startDate.toISOString()} - ${endDate.toISOString()}`);
    console.log("");

    // 1. Cek apakah ada Journal Lines (path journal vs fallback)
    const journalLineCount = await prisma.journalLine.count({
        where: {
            journal: { transactionDate: { gte: startDate, lte: endDate }, isPosted: true },
        },
    });
    console.log(`[1] JOURNAL LINES (posted, tahun ${year}): ${journalLineCount}`);
    console.log(`    → Kalkulator akan gunakan: ${journalLineCount > 0 ? "JOURNAL PATH" : "FALLBACK PATH (CashBankTransaction)"}`);
    console.log("");

    // 2. Cek semua CashBankTransaction kategori expense
    const expenseCategories = ["biaya_operasional", "beban_unit", "hpp_toko", "hutang_mitra"];
    console.log("[2] CASHBANK TRANSACTIONS — EXPENSE CATEGORIES:");

    for (const cat of expenseCategories) {
        const txs = await prisma.cashBankTransaction.findMany({
            where: {
                transactionDate: { gte: startDate, lte: endDate },
                type: "out",
                category: cat,
            },
            select: { id: true, amount: true, unitType: true, description: true, transactionDate: true },
        });
        const total = txs.reduce((sum, tx) => sum + Number(tx.amount), 0);
        console.log(`    [${cat}] → ${txs.length} transaksi, total: Rp ${total.toLocaleString("id-ID")}`);
        if (txs.length > 0 && txs.length <= 5) {
            txs.forEach(tx => {
                console.log(`        - ID ${tx.id}: Rp ${Number(tx.amount).toLocaleString("id-ID")} | unitType: ${tx.unitType ?? "NULL"} | ${tx.description?.slice(0, 50) ?? "-"} | ${tx.transactionDate.toISOString().slice(0, 10)}`);
            });
        } else if (txs.length > 5) {
            txs.slice(0, 3).forEach(tx => {
                console.log(`        - ID ${tx.id}: Rp ${Number(tx.amount).toLocaleString("id-ID")} | unitType: ${tx.unitType ?? "NULL"} | ${tx.description?.slice(0, 50) ?? "-"}`);
            });
            console.log(`        ... dan ${txs.length - 3} lainnya`);
        }
    }
    console.log("");

    // 3. Cek SEMUA CashBankTransaction type=out tanpa filter category
    const allOutTx = await prisma.cashBankTransaction.groupBy({
        by: ["category"],
        where: {
            transactionDate: { gte: startDate, lte: endDate },
            type: "out",
        },
        _count: true,
        _sum: { amount: true },
    });
    console.log("[3] SEMUA CASHBANK type='out' (pengeluaran) — GROUP BY CATEGORY:");
    if (allOutTx.length === 0) {
        console.log("    ❌ TIDAK ADA TRANSAKSI PENGELUARAN SAMA SEKALI!");
    } else {
        allOutTx.forEach(row => {
            console.log(`    [${row.category ?? "NULL"}] → ${row._count} transaksi, total: Rp ${Number(row._sum.amount ?? 0).toLocaleString("id-ID")}`);
        });
    }
    console.log("");

    // 4. Cek CashBankTransaction dengan unitType (untuk breakdown per unit)
    const unitTxGroup = await prisma.cashBankTransaction.groupBy({
        by: ["unitType"],
        where: {
            transactionDate: { gte: startDate, lte: endDate },
            type: "out",
            unitType: { not: null },
        },
        _count: true,
        _sum: { amount: true },
    });
    console.log("[4] PENGELUARAN DENGAN unitType (untuk breakdown per unit):");
    if (unitTxGroup.length === 0) {
        console.log("    ❌ TIDAK ADA TRANSAKSI DENGAN unitType! Semua pengeluaran unitType=NULL");
    } else {
        unitTxGroup.forEach(row => {
            console.log(`    [${row.unitType}] → ${row._count} transaksi, total: Rp ${Number(row._sum.amount ?? 0).toLocaleString("id-ID")}`);
        });
    }
    console.log("");

    // 5. Cek total income (StoreSale + UnitTransaction)
    const [storeSaleTotal, unitTxTotal] = await Promise.all([
        prisma.storeSale.aggregate({
            where: {
                createdAt: { gte: startDate, lte: endDate },
                NOT: { metadata: { path: ["isVoided"], equals: true } } as any,
            },
            _sum: { totalAmount: true },
            _count: true,
        }),
        prisma.unitTransaction.aggregate({
            where: {
                transactionDate: { gte: startDate, lte: endDate },
                isPaid: true,
                status: "completed",
            },
            _sum: { amount: true },
            _count: true,
        }),
    ]);

    console.log("[5] PENDAPATAN:");
    console.log(`    StoreSale: ${storeSaleTotal._count} transaksi, Rp ${Number(storeSaleTotal._sum.totalAmount ?? 0).toLocaleString("id-ID")}`);
    console.log(`    UnitTransaction: ${unitTxTotal._count} transaksi, Rp ${Number(unitTxTotal._sum.amount ?? 0).toLocaleString("id-ID")}`);
    console.log("");

    // 6. Cek apakah ada CashBankTransaction type=out APAPUN categorynya
    const totalOutCount = await prisma.cashBankTransaction.count({
        where: { transactionDate: { gte: startDate, lte: endDate }, type: "out" },
    });
    const totalOutAll = await prisma.cashBankTransaction.count({
        where: { transactionDate: { gte: startDate, lte: endDate } },
    });
    console.log(`[6] TOTAL CASHBANK TRANSACTIONS (${year}):`);
    console.log(`    Total semua: ${totalOutAll}`);
    console.log(`    Total type='out': ${totalOutCount}`);
    console.log(`    Total type='in': ${totalOutAll - totalOutCount}`);
    console.log("");

    // 7. Cek form kas keluar — apakah pernah digunakan
    const recentOut = await prisma.cashBankTransaction.findMany({
        where: { type: "out" },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, category: true, amount: true, unitType: true, description: true, transactionDate: true, createdAt: true },
    });
    console.log("[7] 5 TRANSAKSI KELUAR TERBARU (any year):");
    if (recentOut.length === 0) {
        console.log("    ❌ TIDAK ADA TRANSAKSI KELUAR SAMA SEKALI DI SELURUH DATABASE!");
    } else {
        recentOut.forEach(tx => {
            console.log(`    ID ${tx.id}: cat=${tx.category ?? "NULL"} | Rp ${Number(tx.amount).toLocaleString("id-ID")} | unitType=${tx.unitType ?? "NULL"} | ${tx.transactionDate.toISOString().slice(0, 10)} | ${tx.description?.slice(0, 40) ?? "-"}`);
        });
    }
    console.log("");

    // 8. Simulasikan apa yang dihitung SHU calculator
    console.log("=== SIMULASI KALKULASI SHU ===");
    if (journalLineCount > 0) {
        console.log("Calculator menggunakan JOURNAL PATH:");
        console.log("  Income = sum(journal income accounts credit - debit)");
        console.log("  Expense = sum(journal expense accounts debit - credit) + COGS dari StoreSaleItem");
        console.log("  ⚠️ CashBankTransaction TIDAK DIGUNAKAN karena Journal sudah ada!");
        console.log("  → Jika pengeluaran operasional unit diinput via Kas Keluar tapi BELUM dijurnal,");
        console.log("    maka pengeluaran tersebut TIDAK akan masuk ke kalkulasi SHU!");
    } else {
        console.log("Calculator menggunakan FALLBACK PATH:");
        console.log("  → CashBankTransaction yang dicari: biaya_operasional, beban_unit, hpp_toko, hutang_mitra");
    }

    await prisma.$disconnect();
}

main().catch(console.error);
