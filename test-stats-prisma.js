import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const unitType = 'cuci_mobil';
    
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);

    console.log("todayStart:", todayStart.toISOString());
    console.log("todayEnd:", todayEnd.toISOString());

    const trxList = await prisma.unitTransaction.findMany({
        where: { unitType }
    });

    console.log(`\nAll Unit Transactions for ${unitType} (${trxList.length}):`);
    trxList.forEach(t => console.log(`  - ${t.transactionNo} | Date: ${t.transactionDate.toISOString()} | Amount: ${t.amount}`));

    const todayTrx = await prisma.unitTransaction.findMany({
        where: {
            unitType,
            transactionDate: { gte: todayStart, lt: todayEnd },
        },
    });

    console.log(`\nToday Unit Transactions for ${unitType} (${todayTrx.length}):`);
    todayTrx.forEach(t => console.log(`  - ${t.transactionNo} | Date: ${t.transactionDate.toISOString()} | Amount: ${t.amount}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
