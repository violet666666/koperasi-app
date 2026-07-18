// Read-only aggregate snapshot of production Neon for QA baseline.
// Usage: NODE_ENV=production npx tsx --env-file=.env qa/mobile-qa/scripts/baseline-snapshot.ts --label <str>
// Writes JSON to qa/mobile-qa/api/baseline-snapshot.json. Never mutates DB.
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "fs";
import path from "path";

const prisma = new PrismaClient();
const labelIdx = process.argv.indexOf("--label");
const label = labelIdx >= 0 ? process.argv[labelIdx + 1] : "unlabeled";

async function main() {
  const [
    simpananPokok,
    simpananWajib,
    simpananSukarela,
    cbBalances,
    loanReceivables,
    voidedTestRows,
  ] = await Promise.all([
    prisma.savingsAccount.aggregate({
      _sum: { balance: true },
      where: { product: { type: "pokok" }, status: "active" },
    }),
    prisma.savingsAccount.aggregate({
      _sum: { balance: true },
      where: { product: { type: "wajib" }, status: "active" },
    }),
    prisma.savingsAccount.aggregate({
      _sum: { balance: true },
      where: { product: { type: "sukarela" }, status: "active" },
    }),
    prisma.cashBankAccount.findMany({
      where: { isActive: true, deletedAt: null },
      select: { name: true, currentBalance: true },
      orderBy: { name: "asc" },
    }),
    prisma.loan.aggregate({
      _sum: { principalOutstanding: true },
      where: { status: { in: ["active", "overdue"] } },
    }),
    prisma.cashBankTransaction.count({
      where: { description: { contains: "QA-" } },
    }),
  ]);

  const snapshot = {
    label,
    simpanan: {
      pokok: simpananPokok._sum.balance?.toString() ?? "0",
      wajib: simpananWajib._sum.balance?.toString() ?? "0",
      sukarela: simpananSukarela._sum.balance?.toString() ?? "0",
    },
    cashBank: cbBalances.map((a) => ({
      name: a.name,
      balance: a.currentBalance?.toString() ?? "0",
    })),
    loanReceivables: loanReceivables._sum.principalOutstanding?.toString() ?? "0",
    voidedTestRowsBaseline: voidedTestRows,
  };

  const outPath = path.join(process.cwd(), "qa/mobile-qa/api/baseline-snapshot.json");
  writeFileSync(outPath, JSON.stringify(snapshot, null, 2));
  console.log(JSON.stringify(snapshot, null, 2));
  console.log(`[baseline] written to ${outPath}`);
}

main()
  .finally(() => prisma.$disconnect())
  .catch((e) => {
    console.error("[baseline] FAILED:", e);
    process.exit(1);
  });