// Read-only: audit integritas saldo kas — bandingkan rantai balanceBefore/After
// vs currentBalance vs Σ transaksi. Cari titik saldo "melompat".
import { prisma } from "../src/lib/prisma";

async function main() {
  const accs = await prisma.cashBankAccount.findMany({
    where: { code: { startsWith: "KAS-JATIM" } },
    select: { id: true, code: true, name: true, currentBalance: true, updatedAt: true },
  });
  for (const acc of accs) {
    const txs = await prisma.cashBankTransaction.findMany({
      where: { accountId: acc.id },
      orderBy: [{ transactionDate: "asc" }, { id: "asc" }],
      select: { id: true, type: true, amount: true, balanceBefore: true, balanceAfter: true, transactionDate: true, category: true, description: true, createdAt: true },
    });
    const cb = Number(acc.currentBalance);
    if (!txs.length) { console.log(`\n${acc.code}: TANPA transaksi, currentBalance=${cb}`); continue; }
    const last = txs[txs.length - 1];
    let running = Number(txs[0].balanceBefore);
    const jumps: string[] = [];
    for (const t of txs) {
      const expected = t.type === "in" ? running + Number(t.amount) : running - Number(t.amount);
      if (Math.abs(Number(t.balanceBefore) - running) > 0.01) {
        jumps.push(`  LOMPAT sebelum id=${t.id} (${t.transactionDate.toISOString().slice(0,10)}): chain=${running.toFixed(2)} vs balanceBefore=${Number(t.balanceBefore).toFixed(2)} (Δ=${(Number(t.balanceBefore)-running).toFixed(2)}) cat=${t.category} created=${t.createdAt.toISOString().slice(0,10)}`);
      }
      running = Number(t.balanceAfter);
    }
    console.log(`\n===== ${acc.code} =====`);
    console.log(`  currentBalance=${cb.toFixed(2)} | Σchain(last balanceAfter)=${running.toFixed(2)} | first balanceBefore=${Number(txs[0].balanceBefore).toFixed(2)} | n=${txs.length}`);
    console.log(`  SELISIH currentBalance vs chain = ${(cb - running).toFixed(2)}`);
    console.log(`  acc.updatedAt=${acc.updatedAt.toISOString().slice(0, 10)} | lastTx.date=${last.transactionDate.toISOString().slice(0, 10)} created=${last.createdAt.toISOString().slice(0, 10)}`);
    if (jumps.length) { console.log(`  LOMPATAN (${jumps.length}):`); for (const j of jumps.slice(0, 15)) console.log(j); }
  }
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
