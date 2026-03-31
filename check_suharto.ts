import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkSuharto() {
    const mem = await prisma.member.findFirst({ where: { nrp: "73040054" }, include: { loans: true } });
    if (!mem) return console.log("No Suharto");
    console.log(mem.name);
    console.log(mem.loans);
}
checkSuharto();
