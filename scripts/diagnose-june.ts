// Read-only: identifikasi gap terbesar + profil baris June-created di KAS-JATIM-CMR.
import { prisma } from "../src/lib/prisma";

async function main() {
  const acc = await prisma.cashBankAccount.findFirst({ where: { code: "KAS-JATIM-CMR" }, select: { id: true } });
  if (!acc) return;
  const txs = await prisma.cashBankTransaction.findMany({
    where: { accountId: acc.id },
    orderBy: { id: "asc" },
    select: { id: true, balanceBefore: true, balanceAfter: true, transactionDate: true, createdAt: true, category: true, type: true, amount: true, description: true, transactionNo: true },
  });
  // gap terbesar (|Δ| > 50jt)
  const big: Array<{ at: number; d: number; ctx: string }> = [];
  for (let i = 1; i < txs.length; i++) {
    const d = Number(txs[i].balanceBefore) - Number(txs[i - 1].balanceAfter);
    if (Math.abs(d) > 50_000_000) {
      const nxt = txs[i];
      big.push({ at: nxt.id, d, ctx: `next: id=${nxt.id} ${nxt.type} ${Number(nxt.amount).toFixed(0)} ${nxt.category} txDate=${nxt.transactionDate.toISOString().slice(0,10)} created=${nxt.createdAt.toISOString().slice(0,10)} "${(nxt.description ?? "").slice(0,70)}"` });
    }
  }
  console.log(`=== gap |Δ|>50jt: n=${big.length} Σ=${big.reduce((s, b) => s + b.d, 0).toFixed(2)} ===`);
  for (const b of big) console.log(`  Δ=${b.d.toFixed(2)} @id=${b.at}\n    ${b.ctx}`);

  // profil baris June-created
  const june = txs.filter(t => t.createdAt.toISOString().slice(0, 7) === "2026-06");
  const byCat = new Map<string, { n: number; sum: number }>();
  for (const t of june) {
    const k = `${t.type}/${t.category ?? "-"}`;
    const e = byCat.get(k) ?? { n: 0, sum: 0 };
    e.n++; e.sum += Number(t.amount);
    byCat.set(k, e);
  }
  console.log(`\n=== baris created Juni 2026: n=${june.length} ===`);
  for (const [k, v] of [...byCat.entries()].sort()) console.log(`  ${k.padEnd(40)} n=${String(v.n).padStart(5)} sum=${v.sum.toFixed(2)}`);
  const juneIn = june.filter(t => t.type === "in").reduce((s, t) => s + Number(t.amount), 0);
  const juneOut = june.filter(t => t.type === "out").reduce((s, t) => s + Number(t.amount), 0);
  console.log(`  in=${juneIn.toFixed(2)} out=${juneOut.toFixed(2)} net=${(juneIn - juneOut).toFixed(2)}`);
  // sampel deskripsi Juni
  const samples = june.slice(0, 5).concat(june.slice(-5));
  for (const s of samples) console.log(`  Juni sample: id=${s.id} ${s.type} ${Number(s.amount).toFixed(0)} ${s.category} txDate=${s.transactionDate.toISOString().slice(0,10)} "${(s.description ?? "").slice(0,70)}"`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
