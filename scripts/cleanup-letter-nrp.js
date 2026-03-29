// Script to find and delete members whose NRP contains letters
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Find members whose memberNo contains any letter (a-z, A-Z)
    const allMembers = await prisma.member.findMany({
        select: { id: true, memberNo: true, name: true }
    });
    
    const membersWithLetters = allMembers.filter(m => /[a-zA-Z]/.test(m.memberNo));
    
    console.log(`Found ${membersWithLetters.length} members with letters in NRP:`);
    membersWithLetters.forEach(m => {
        console.log(`  ID: ${m.id} | NRP: ${m.memberNo} | Name: ${m.name}`);
    });
    
    if (membersWithLetters.length === 0) {
        console.log('No members found with letters in NRP. Nothing to delete.');
        return;
    }
    
    const ids = membersWithLetters.map(m => m.id);
    
    // Delete related records first (cascading won't handle all relations)
    console.log('\nDeleting related records...');
    
    // Delete savings transactions for these members' savings accounts
    const savingsAccounts = await prisma.savingsAccount.findMany({
        where: { memberId: { in: ids } }, select: { id: true }
    });
    const saIds = savingsAccounts.map(a => a.id);
    if (saIds.length > 0) {
        const txDel = await prisma.savingsTransaction.deleteMany({ where: { accountId: { in: saIds } } });
        console.log(`  Deleted ${txDel.count} savings transactions`);
        const saDel = await prisma.savingsAccount.deleteMany({ where: { memberId: { in: ids } } });
        console.log(`  Deleted ${saDel.count} savings accounts`);
    }
    
    // Delete loan payments for these members' loans
    const loans = await prisma.loan.findMany({
        where: { memberId: { in: ids } }, select: { id: true }
    });
    const loanIds = loans.map(l => l.id);
    if (loanIds.length > 0) {
        const lpDel = await prisma.loanPayment.deleteMany({ where: { loanId: { in: loanIds } } });
        console.log(`  Deleted ${lpDel.count} loan payments`);
        const laDel = await prisma.loan.deleteMany({ where: { memberId: { in: ids } } });
        console.log(`  Deleted ${laDel.count} loans`);
    }
    
    // Delete store sales items and store sales
    const storeSales = await prisma.storeSale.findMany({
        where: { memberId: { in: ids } }, select: { id: true }
    });
    const ssIds = storeSales.map(s => s.id);
    if (ssIds.length > 0) {
        const siDel = await prisma.storeSaleItem.deleteMany({ where: { saleId: { in: ssIds } } });
        console.log(`  Deleted ${siDel.count} store sale items`);
        const ssDel = await prisma.storeSale.deleteMany({ where: { memberId: { in: ids } } });
        console.log(`  Deleted ${ssDel.count} store sales`);
    }
    
    // Delete unit transactions
    const utDel = await prisma.unitTransaction.deleteMany({ where: { memberId: { in: ids } } });
    console.log(`  Deleted ${utDel.count} unit transactions`);
    
    // Delete the user accounts linked to these members
    const memberRecords = await prisma.member.findMany({
        where: { id: { in: ids } }, select: { id: true, userAccount: { select: { id: true } } }
    });
    
    // Soft-delete or real delete members
    const mDel = await prisma.member.deleteMany({ where: { id: { in: ids } } });
    console.log(`  Deleted ${mDel.count} members`);
    
    // Delete user accounts
    const userIds = memberRecords.map(m => m.userAccount?.id).filter(Boolean);
    if (userIds.length > 0) {
        const uDel = await prisma.user.deleteMany({ where: { id: { in: userIds } } });
        console.log(`  Deleted ${uDel.count} user accounts`);
    }
    
    console.log('\n✅ Cleanup complete!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
