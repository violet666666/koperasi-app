const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const apps = await prisma.loanApplication.findMany();
    const count = apps.reduce((acc, curr) => {
        acc[curr.status] = (acc[curr.status] || 0) + 1;
        return acc;
    }, {});
    console.log("STATUS COUNTS:", count);
}
main().finally(() => prisma.$disconnect());
