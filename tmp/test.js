const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const apps = await prisma.loanApplication.findMany({
    include: {
      member: { select: { id: true, memberNo: true, name: true } },
      branch: { select: { id: true, name: true } },
      product: { select: { id: true, code: true, name: true } },
    }
  });
  console.log("ALL APPS:", JSON.stringify(apps, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
