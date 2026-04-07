import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Checking LoanApplications in staging DB ===");
  
  const apps = await prisma.loanApplication.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      member: { select: { id: true, memberNo: true, name: true } },
      branch: { select: { id: true, name: true } },
    },
  });

  console.log(`Total LoanApplications found: ${apps.length}`);
  for (const app of apps) {
    console.log(`  ID: ${app.id}, No: ${app.applicationNo}, Status: ${app.status}, Member: ${app.member?.name} (${app.member?.memberNo}), Branch: ${app.branch?.name}`);
  }

  console.log("\n=== Checking Loans (active/disbursed) ===");
  const loans = await prisma.loan.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      member: { select: { id: true, memberNo: true, name: true } },
    },
  });

  console.log(`Total Loans found: ${loans.length}`);
  for (const loan of loans) {
    console.log(`  ID: ${loan.id}, No: ${loan.loanNo}, Status: ${loan.status}, Member: ${loan.member?.name}, Principal: ${loan.principalAmount}`);
  }

  console.log("\n=== Checking UAT Members ===");
  const members = await prisma.member.findMany({
    where: { memberNo: { startsWith: "UAT-" } },
    select: { id: true, memberNo: true, name: true, branchId: true },
  });
  for (const m of members) {
    console.log(`  ID: ${m.id}, No: ${m.memberNo}, Name: ${m.name}, BranchId: ${m.branchId}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
