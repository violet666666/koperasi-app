import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function count() {
    const c = await prisma.member.count({ where: { category: "PNS" } });
    console.log("PNS Members count in DB:", c);
}
count().finally(() => prisma.$disconnect());
