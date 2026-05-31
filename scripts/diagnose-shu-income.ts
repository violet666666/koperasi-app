/**
 * Quick diagnostic: Compare journal income vs direct revenue sources
 */
import prisma from "../src/lib/prisma";

function toNum(d: any): number {
    if (d === null || d === undefined) return 0;
    return typeof d === "number" ? d : Number(d);
}

async function main() {
    const year = 2026;
    const startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    // Journal income
    const journalLines = await prisma.journalLine.findMany({
        where: {
            journal: { transactionDate: { gte: startDate, lte: endDate }, isPosted: true },
        },
        include: { account: { select: { code: true, name: true, type: true } } },
    });
    let jIncome = 0;
    for (const line of journalLines) {
        if (line.account.type === "income") {
            jIncome += toNum(line.credit) - toNum(line.debit);
        }
    }

    // Direct revenue
    const [storeSales, unitTx, loanInterest, cbIncome] = await Promise.all([
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
                isPaid: true, status: "completed",
            },
            _sum: { amount: true },
            _count: true,
        }),
        prisma.loanPayment.aggregate({
            where: {
                paymentDate: { gte: startDate, lte: endDate },
                status: { not: "voided" },
            },
            _sum: { interestPortion: true },
        }),
        prisma.cashBankTransaction.aggregate({
            where: {
                transactionDate: { gte: startDate, lte: endDate },
                type: "in",
                category: { notIn: ["savings", "loan", "transfer", "operational"] },
            },
            _sum: { amount: true },
            _count: true,
        }),
    ]);

    const storeRev = toNum(storeSales._sum.totalAmount);
    const unitRev = toNum(unitTx._sum.amount);
    const loanRev = toNum(loanInterest._sum.interestPortion);
    const cbIncRev = toNum(cbIncome._sum.amount);

    console.log("=== INCOME COMPARISON ===\n");
    console.log(`Journal income (type=income):   Rp ${jIncome.toLocaleString("id-ID")}`);
    console.log(`\nDirect Revenue Sources:`);
    console.log(`  StoreSale:         ${storeSales._count} tx → Rp ${storeRev.toLocaleString("id-ID")}`);
    console.log(`  UnitTransaction:   ${unitTx._count} tx → Rp ${unitRev.toLocaleString("id-ID")}`);
    console.log(`  LoanPayment int:   Rp ${loanRev.toLocaleString("id-ID")}`);
    console.log(`  CB type=in:        ${cbIncome._count} tx → Rp ${cbIncRev.toLocaleString("id-ID")}`);
    console.log(`  TOTAL DIRECT:      Rp ${(storeRev + unitRev + loanRev + cbIncRev).toLocaleString("id-ID")}`);

    // Check: is journal income a SUBSET of these? Or does journal already include them?
    const missingIncome = (storeRev + unitRev + loanRev) - jIncome;
    console.log(`\n  Missing from journal: Rp ${missingIncome.toLocaleString("id-ID")}`);

    // Check if StoreSales create journals
    const salesWithJournal = await prisma.storeSale.count({
        where: {
            createdAt: { gte: startDate, lte: endDate },
            journalId: { not: null },
        }
    });
    const salesTotal = await prisma.storeSale.count({
        where: { createdAt: { gte: startDate, lte: endDate } }
    });
    console.log(`\n  StoreSales with journalId: ${salesWithJournal} / ${salesTotal}`);

    // Check CB type=in with journalId=null  
    const cbInNoJournal = await prisma.cashBankTransaction.aggregate({
        where: {
            transactionDate: { gte: startDate, lte: endDate },
            type: "in",
            journalId: null,
            category: { notIn: ["savings", "loan", "transfer", "operational",
                "pencairan_pinjaman", "simpanan_pokok", "simpanan_wajib", "simpanan_sukarela",
                "angsuran_pokok"] },
        },
        _sum: { amount: true },
        _count: true,
    });
    console.log(`\n  CB type=in (non-journaled, revenue categories): ${cbInNoJournal._count} tx → Rp ${toNum(cbInNoJournal._sum.amount).toLocaleString("id-ID")}`);

    // What ARE the income categories in CashBankTransaction type=in?
    const cbInByCategory = await prisma.cashBankTransaction.groupBy({
        by: ["category"],
        where: {
            transactionDate: { gte: startDate, lte: endDate },
            type: "in",
        },
        _sum: { amount: true },
        _count: true,
    });
    console.log(`\n  CB type=in by category:`);
    cbInByCategory
        .sort((a, b) => toNum(b._sum.amount) - toNum(a._sum.amount))
        .forEach(c => console.log(`    ${c.category || "(null)"}: ${c._count} tx → Rp ${toNum(c._sum.amount).toLocaleString("id-ID")}`));

    await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
