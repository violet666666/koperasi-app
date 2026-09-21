// Read-only: temukan gap rantai saldo (baris terhapus) — order by id (urutan create).
import { prisma } from "../src/lib/prisma";

async function main() {
  const accs = await prisma.cashBankAccount.findMany({
    where: { code: { in: ["KAS-JATIM-CMR", "KAS-JATIM-FTC"] } },
    select: { id: true, code: true, currentBalance: true },
  });
  for (const acc of accs) {
    const txs = await prisma.cashBankTransaction.findMany({
      where: { accountId: acc.id },
      orderBy: { id: "asc" },
      select: { id: true, balanceBefore: true, balanceAfter: true, transactionDate: true, createdAt: true, category: true, type: true, amount: true },
    });
    console.log(`\n===== ${acc.code} n=${txs.length} currentBalance=${Number(acc.currentBalance).toFixed(2)} =====`);
    let gaps = 0, gapSum = 0;
    const byMonth = new Map<string, number>();
    for (let i = 1; i < txs.length; i++) {
      const prev = Number(txs[i - 1].balanceAfter);
      const cur = Number(txs[i].balanceBefore);
      const d = cur - prev;
      if (Math.abs(d) > 0.01) {
        gaps++; gapSum += d;
        const key = txs[i].createdAt.toISOString().slice(0, 7); // cluster per bulan create
        byMonth.set(key, (byMonth.get(key) ?? 0) + d);
        if (gaps <= 10)
          console.log(`  gap@id=${txs[i].id} txDate=${txs[i].transactionDate.toISOString().slice(0,10)} created=${txs[i].createdAt.toISOString().slice(0,10)} prevAfter=${prev.toFixed(2)} curBefore=${cur.toFixed(2)} Δ=${d.toFixed(2)}`);
      }
    }
    console.log(`  total gap: n=${gaps} ΣΔ=${gapSum.toFixed(2)}`);
    for (const [m, s] of [...byMonth.entries()].sort()) console.log(`    created ${m}: ΣΔ=${s.toFixed(2)}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
