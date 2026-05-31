/**
 * Diagnostic script: Why is SHU Bersih = 0?
 * Run: npx tsx scripts/diagnose-shu-zero.ts
 */
import prisma from "../src/lib/prisma";

function toNum(d: any): number {
    if (d === null || d === undefined) return 0;
    return typeof d === "number" ? d : Number(d);
}

const NON_EXPENSE_CATEGORIES = [
    "pencairan_pinjaman", "transfer", "savings",
    "simpanan_pokok", "simpanan_wajib", "simpanan_sukarela",
    "angsuran_pokok", "void_penjualan_toko", "void_unit_transaction",
    "pendapatan_unit", "jasa_pinjaman",
];

async function main() {
    const year = 2026;
    const startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    console.log("=== DIAGNOSA SHU BERSIH = 0 ===");
    console.log(`Periode: ${startDate.toISOString()} → ${endDate.toISOString()}\n`);

    // 1. Check journal lines
    const journalLines = await prisma.journalLine.findMany({
        where: {
            journal: { transactionDate: { gte: startDate, lte: endDate }, isPosted: true },
        },
        include: { account: { select: { code: true, name: true, type: true } } },
    });
    console.log(`[1] JournalLine count: ${journalLines.length}`);

    let jIncome = 0;
    let jExpense = 0;
    const incomeByAcct: Record<string, number> = {};
    const expenseByAcct: Record<string, number> = {};

    for (const line of journalLines) {
        const debit = toNum(line.debit);
        const credit = toNum(line.credit);
        if (line.account.type === "income") {
            const amount = credit - debit;
            jIncome += amount;
            incomeByAcct[`${line.account.code} ${line.account.name}`] = (incomeByAcct[`${line.account.code} ${line.account.name}`] || 0) + amount;
        } else if (line.account.type === "expense") {
            const amount = debit - credit;
            jExpense += amount;
            expenseByAcct[`${line.account.code} ${line.account.name}`] = (expenseByAcct[`${line.account.code} ${line.account.name}`] || 0) + amount;
        }
    }
    console.log(`    Journal Income: Rp ${jIncome.toLocaleString("id-ID")}`);
    console.log(`    Journal Expense: Rp ${jExpense.toLocaleString("id-ID")}`);
    console.log(`    Journal Net: Rp ${(jIncome - jExpense).toLocaleString("id-ID")}`);

    // Top income accounts
    console.log("\n    Top Income Accounts (Journal):");
    Object.entries(incomeByAcct)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .forEach(([name, amt]) => console.log(`      ${name}: Rp ${amt.toLocaleString("id-ID")}`));

    // Top expense accounts
    console.log("\n    Top Expense Accounts (Journal):");
    Object.entries(expenseByAcct)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .forEach(([name, amt]) => console.log(`      ${name}: Rp ${amt.toLocaleString("id-ID")}`));

    // 2. Non-journaled CashBankTransaction expenses (journal path merge)
    const nonJournaledExpenses = await prisma.cashBankTransaction.findMany({
        where: {
            transactionDate: { gte: startDate, lte: endDate },
            type: "out",
            journalId: null,
            category: { notIn: NON_EXPENSE_CATEGORIES },
        },
    });
    let cbExpenseTotal = 0;
    const cbByCat: Record<string, { count: number; total: number }> = {};
    nonJournaledExpenses.forEach(tx => {
        const cat = tx.category || "lainnya";
        const amt = toNum(tx.amount);
        cbExpenseTotal += amt;
        if (!cbByCat[cat]) cbByCat[cat] = { count: 0, total: 0 };
        cbByCat[cat].count++;
        cbByCat[cat].total += amt;
    });
    console.log(`\n[2] Non-journaled CashBank Expenses (journalId=NULL, type=out):`);
    console.log(`    Count: ${nonJournaledExpenses.length}`);
    console.log(`    Total: Rp ${cbExpenseTotal.toLocaleString("id-ID")}`);
    console.log("    By category:");
    Object.entries(cbByCat)
        .sort(([, a], [, b]) => b.total - a.total)
        .forEach(([cat, data]) => console.log(`      ${cat}: ${data.count} tx, Rp ${data.total.toLocaleString("id-ID")}`));

    // 3. COGS
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
    console.log(`\n[3] COGS (StoreSaleItem):`);
    console.log(`    Items: ${soldItems.length}`);
    console.log(`    Total: Rp ${cogsTotal.toLocaleString("id-ID")}`);

    // 4. Calculate totals
    const totalIncome = jIncome;
    const totalExpense = jExpense + cbExpenseTotal + cogsTotal;
    const netSurplus = totalIncome - totalExpense;
    const clampedNetSurplus = Math.max(0, netSurplus);

    console.log(`\n${"=".repeat(60)}`);
    console.log(`TOTAL INCOME:  Rp ${totalIncome.toLocaleString("id-ID")}`);
    console.log(`TOTAL EXPENSE: Rp ${totalExpense.toLocaleString("id-ID")}`);
    console.log(`  Journal expense:     Rp ${jExpense.toLocaleString("id-ID")}`);
    console.log(`  CB non-journaled:    Rp ${cbExpenseTotal.toLocaleString("id-ID")}`);
    console.log(`  COGS:                Rp ${cogsTotal.toLocaleString("id-ID")}`);
    console.log(`NET SURPLUS (raw):     Rp ${netSurplus.toLocaleString("id-ID")}`);
    console.log(`NET SURPLUS (clamped): Rp ${clampedNetSurplus.toLocaleString("id-ID")}`);
    console.log(`${"=".repeat(60)}`);

    if (netSurplus <= 0) {
        console.log(`\n🔴 PROBLEM FOUND: totalExpense (${totalExpense.toLocaleString("id-ID")}) > totalIncome (${totalIncome.toLocaleString("id-ID")})`);
        console.log(`   Math.max(0, income - expense) = 0 → SHU Bersih = 0`);
        console.log(`\n   POSSIBLE CAUSES:`);
        
        if (cbExpenseTotal > totalIncome) {
            console.log(`   → CB non-journaled expenses (Rp ${cbExpenseTotal.toLocaleString("id-ID")}) alone exceeds total income`);
        }
        
        // Check if CB expenses include items already counted in journal expense
        const journaledCB = await prisma.cashBankTransaction.findMany({
            where: {
                transactionDate: { gte: startDate, lte: endDate },
                type: "out",
                journalId: { not: null },
                category: { notIn: NON_EXPENSE_CATEGORIES },
            },
        });
        let journaledCBTotal = 0;
        journaledCB.forEach(tx => journaledCBTotal += toNum(tx.amount));
        console.log(`\n[5] CB expenses WITH journalId (already in journal):`);
        console.log(`    Count: ${journaledCB.length}`);
        console.log(`    Total: Rp ${journaledCBTotal.toLocaleString("id-ID")}`);

        // Check: are journal expense accounts possibly ALSO counting the same CB transactions?
        // Look for journal expense lines that have CashBankTransaction linkage
        const expenseJournals = await prisma.journal.findMany({
            where: {
                transactionDate: { gte: startDate, lte: endDate },
                isPosted: true,
            },
            select: { id: true, referenceNo: true, description: true },
            take: 5
        });
        console.log(`\n[6] Sample posted journals:`);
        expenseJournals.forEach(j => console.log(`    ${j.id}: ref=${j.referenceNo}, desc=${j.description?.slice(0, 80)}`));

        // Check ALL CashBankTransaction type=out total (regardless of journalId)
        const allCBOut = await prisma.cashBankTransaction.aggregate({
            where: {
                transactionDate: { gte: startDate, lte: endDate },
                type: "out",
                category: { notIn: NON_EXPENSE_CATEGORIES },
            },
            _sum: { amount: true },
            _count: true,
        });
        console.log(`\n[7] ALL CB type=out (expense categories):`);
        console.log(`    Count: ${allCBOut._count}`);
        console.log(`    Total: Rp ${toNum(allCBOut._sum.amount).toLocaleString("id-ID")}`);

        // Check if journal expense lines are double-counting CB transactions
        // by looking at journal lines from type=expense accounts
        console.log(`\n[8] Journal expense total vs CB expense total comparison:`);
        console.log(`    Journal expense (from accounts type=expense): Rp ${jExpense.toLocaleString("id-ID")}`);
        console.log(`    CB non-journaled expense:                     Rp ${cbExpenseTotal.toLocaleString("id-ID")}`);
        console.log(`    Combined:                                     Rp ${(jExpense + cbExpenseTotal).toLocaleString("id-ID")}`);
        console.log(`    Total income:                                 Rp ${totalIncome.toLocaleString("id-ID")}`);
        console.log(`    Deficit:                                      Rp ${(totalIncome - jExpense - cbExpenseTotal).toLocaleString("id-ID")}`);
        
        // Check if income from journal is missing revenue sources
        // StoreSale income
        const storeIncome = await prisma.storeSale.aggregate({
            where: {
                createdAt: { gte: startDate, lte: endDate },
                NOT: { metadata: { path: ["isVoided"], equals: true } } as any,
            },
            _sum: { totalAmount: true },
            _count: true,
        });
        console.log(`\n[9] StoreSale revenue (direct):`);
        console.log(`    Count: ${storeIncome._count}`);
        console.log(`    Total: Rp ${toNum(storeIncome._sum.totalAmount).toLocaleString("id-ID")}`);

        // UnitTransaction income
        const unitIncome = await prisma.unitTransaction.aggregate({
            where: {
                transactionDate: { gte: startDate, lte: endDate },
                isPaid: true,
                status: "completed",
            },
            _sum: { amount: true },
            _count: true,
        });
        console.log(`\n[10] UnitTransaction revenue (direct):`);
        console.log(`    Count: ${unitIncome._count}`);
        console.log(`    Total: Rp ${toNum(unitIncome._sum.amount).toLocaleString("id-ID")}`);

        // LoanPayment interest income
        const loanInterest = await prisma.loanPayment.aggregate({
            where: {
                paymentDate: { gte: startDate, lte: endDate },
                status: { not: "voided" },
            },
            _sum: { interestPortion: true },
        });
        console.log(`\n[11] LoanPayment interest (direct):`);
        console.log(`    Total: Rp ${toNum(loanInterest._sum.interestPortion).toLocaleString("id-ID")}`);

        // CB type=in income
        const cbIncome = await prisma.cashBankTransaction.aggregate({
            where: {
                transactionDate: { gte: startDate, lte: endDate },
                type: "in",
                category: { notIn: ["savings", "loan", "transfer", "operational"] },
            },
            _sum: { amount: true },
            _count: true,
        });
        console.log(`\n[12] CashBankTransaction type=in (non-savings/loan/transfer):`);
        console.log(`    Count: ${cbIncome._count}`);
        console.log(`    Total: Rp ${toNum(cbIncome._sum.amount).toLocaleString("id-ID")}`);

        // Check if journal INCOME accounts are actually capturing all revenue
        console.log(`\n[13] KEY QUESTION: Is journal income capturing StoreSale + UnitTx + LoanInterest?`);
        const directRevenue = toNum(storeIncome._sum.totalAmount) + toNum(unitIncome._sum.amount) + toNum(loanInterest._sum.interestPortion);
        console.log(`    Direct revenue (Store+Unit+Loan):  Rp ${directRevenue.toLocaleString("id-ID")}`);
        console.log(`    Journal income:                    Rp ${jIncome.toLocaleString("id-ID")}`);
        console.log(`    Difference:                        Rp ${(directRevenue - jIncome).toLocaleString("id-ID")}`);
        
        if (jIncome < directRevenue * 0.5) {
            console.log(`\n   ⚠️  JOURNAL INCOME IS MUCH LESS THAN DIRECT REVENUE`);
            console.log(`      This suggests the journal path is NOT capturing all income sources.`);
            console.log(`      The journal only has accounting entries, but StoreSale/UnitTx/LoanPayment`);
            console.log(`      may NOT create journal entries automatically.`);
            console.log(`\n   🔧 FIX NEEDED: When in journal path, also add income from`);
            console.log(`      StoreSale, UnitTransaction, LoanPayment (similar to fallback path)`);
        }
    }

    await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
