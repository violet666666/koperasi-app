import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function fixSuharto() {
    const mem = await prisma.member.findFirst({ where: { nrp: "73040054" }, include: { loans: true } });
    if (!mem) return console.log("No Suharto");
    
    for (const loan of mem.loans) {
        if (loan.applicationId) {
            await prisma.loanApplication.delete({ where: { id: loan.applicationId } }).catch(() => {});
        }
        await prisma.loan.delete({ where: { id: loan.id } });
    }
    console.log("Deleted all Suharto loans");
}
fixSuharto();
