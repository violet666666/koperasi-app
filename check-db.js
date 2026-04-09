const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const dFrom = new Date();
    dFrom.setUTCHours(0,0,0,0);
    const count = await prisma.storeSale.count({where: {unitType: 'toko'}});
    console.log("Total StoreSale for toko:", count);
    
    // Check if there are any StoreSales AT ALL
    const firstSale = await prisma.storeSale.findFirst({where: {unitType: 'toko'}, orderBy: {createdAt: 'desc'}});
    console.log("Last StoreSale:", firstSale);
}

check().catch(console.error).finally(() => prisma.$disconnect());
