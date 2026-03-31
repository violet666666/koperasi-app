const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkOrphan() {
    const users = await prisma.user.findMany({
        where: { email: { contains: '@koperasi.com' } },
        include: { member: true }
    });
    console.log("Users created by auto-creation:", users.length);
    for (const u of users) {
        if (!u.member) console.log(`User ${u.email} has no member!`);
    }

    const members = await prisma.member.findMany({
        where: { nrp: { startsWith: 'NEW-' } },
        include: { user: true, Loan: true }
    });
    console.log("Members with NEW- nrp:", members.length);
    
    // Check if any have loans
    let totalLoans = 0;
    for (const m of members) {
        totalLoans += m.Loan.length;
    }
    console.log("Total loans attached to these NEW members:", totalLoans);
}

checkOrphan().finally(() => prisma.$disconnect());
