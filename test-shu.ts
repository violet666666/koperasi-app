import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        const jc = await prisma.journalLine.count().catch(() => 0);
        const cbt = await prisma.cashBankTransaction.count().catch(() => 0);
        const j = await prisma.journal.count().catch(() => 0);
        const ms = await prisma.savingsTransaction.count().catch(() => 0);
        const lp = await prisma.loanPayment.count().catch(() => 0);
        const l = await prisma.loan.count().catch(() => 0);
        const mm = await prisma.member.count().catch(() => 0);
        // check tables 
        try {
            const st = await prisma.storeSale.count();
            console.log('storeSales:', st);
        } catch(e) {}
        try {
            const ut = await prisma.unitTransaction.count();
            console.log('unitTx:', ut);
        } catch(e) {}

        console.log({
            journalLines: jc,
            cashBankTx: cbt,
            journals: j,
            savingsTx: ms,
            loanPayments: lp,
            loans: l,
            members: mm
        });

        // Also check if any journals exist for 2026
        const jc2026 = await prisma.journalLine.count({
            where: {
                journal: {
                    transactionDate: { gte: new Date('2026-01-01'), lte: new Date('2026-12-31') }
                }
            }
        });
        console.log('JournalLines 2026:', jc2026);
    } catch (e) {
        console.error("DB Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
