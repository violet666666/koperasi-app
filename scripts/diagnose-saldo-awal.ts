// Read-only: cek baris "Saldo Awal" & run-import besar di KAS-JATIM-CMR.
import { prisma } from "../src/lib/prisma";

async function main() {
  const acc = await prisma.cashBankAccount.findFirst({ where: { code: "KAS-JATIM-CMR" }, select: { id: true } });
  if (!acc) return;
  const saldoAwal = await prisma.cashBankTransaction.findMany({
    where: { accountId: acc.id, description: "Saldo Awal" },
    select: { id: true, type: true, amount: true, transactionDate: true, createdAt: true, balanceBefore: true, balanceAfter: true },
  });
  console.log(`=== baris 'Saldo Awal': n=${saldoAwal.length} ===`);
  for (const s of saldoAwal) console.log(`  id=${s.id} ${s.type} ${Number(s.amount).toFixed(0)} txDate=${s.transactionDate.toISOString().slice(0,10)} created=${s.createdAt.toISOString().slice(0,10)} before=${Number(s.balanceBefore).toFixed(0)} after=${Number(s.balanceAfter).toFixed(0)}`);

  // baris per hari-create (cluster import)
  const rows = await prisma.cashBankTransaction.findMany({ where: { accountId: acc.id }, select: { createdAt: true, type: true, amount: true } });
  const byDay = new Map<string, { n: number; net: number }>();
  for (const r of rows) {
    const k = r.createdAt.toISOString().slice(0, 10);
    const e = byDay.get(k) ?? { n: 0, net: 0 };
    e.n++; e.net += r.type === "in" ? Number(r.amount) : -Number(r.amount);
    byDay.set(k, e);
  }
  const big = [...byDay.entries()].filter(([, v]) => v.n >= 80).sort();
  console.log(`\n=== hari dgn >=80 baris dibuat (indikasi import): ===`);
  for (const [d, v] of big) console.log(`  ${d} n=${v.n} net=${v.net.toFixed(0)}`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
