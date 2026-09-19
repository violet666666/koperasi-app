// Read-only: find a recent completed cuci_mobil transaction by Kasir Cuci Mobil for live void repro.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const kasir = await prisma.user.findUnique({ where: { email: "kasircucimobil@koperasi.com" }, select: { id: true, name: true, isActive: true } });
  console.log("kasir:", kasir);
  const txs = await prisma.unitTransaction.findMany({
    where: { unitType: "cuci_mobil", status: "completed", createdById: kasir?.id },
    orderBy: { transactionDate: "desc" },
    take: 5,
    select: { id: true, transactionNo: true, amount: true, transactionDate: true, status: true },
  });
  console.table(txs);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
