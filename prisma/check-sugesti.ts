import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config({ path: ".env.local" });

const prisma = new PrismaClient();

async function main() {
    const members = await prisma.member.findMany({
        where: { name: { contains: "sugesti", mode: "insensitive" } },
        include: { loans: true }
    });

    console.dir(members, { depth: null });

    const tx = await prisma.cashBankTransaction.findMany({
        where: { description: { contains: "sugesti", mode: "insensitive" } }
    });

    console.dir(tx, { depth: null });
}

main().catch(console.error).finally(() => prisma.$disconnect());
