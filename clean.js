const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const loans = await prisma.loan.findMany({ select: { id: true, memberId: true, applicationId: true }, orderBy: { id: 'asc' } });
    
    const memberLoanMap = {};
    for (const l of loans) {
        if (!memberLoanMap[l.memberId]) memberLoanMap[l.memberId] = [];
        memberLoanMap[l.memberId].push(l);
    }
    
    let loanIdsToDelete = [];
    let appIdsToDelete = [];
    for (const [memberId, memberLoans] of Object.entries(memberLoanMap)) {
        if (memberLoans.length > 1) {
            // Keep the first one imported, delete the rest
            const toDelete = memberLoans.slice(1);
            loanIdsToDelete.push(...toDelete.map(l => l.id));
            appIdsToDelete.push(...toDelete.map(l => l.applicationId).filter(id => id != null));
        }
    }
    
    console.log(`Deleting ${loanIdsToDelete.length} duplicate loans...`);
    if (loanIdsToDelete.length > 0) {
        // Since we didn't inject Journal transactions for Migrasi loans (they bypassed journal hook in my implementation),
        // we can just delete the Loan and LoanApplication directly. If there are LoanPayment, we can't, but migrans shouldn't have payments yet.
        await prisma.loan.deleteMany({ where: { id: { in: loanIdsToDelete } } });
        await prisma.loanApplication.deleteMany({ where: { id: { in: appIdsToDelete } } });
        console.log("Cleanup success!");
    }
}
main().catch(console.error).finally(() => prisma.$disconnect());
