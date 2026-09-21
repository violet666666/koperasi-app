// Read-only: telusuri saldo kas unit — kenapa KAS-JATIM-CMR ~2,6M & KAS-JATIM-FTC minus.
// Agregasi CashBankTransaction per akun (in/out/category/unitType) + sampel setoran.
import { prisma } from "../src/lib/prisma";

async function main() {
  const accounts = await prisma.cashBankAccount.findMany({
    where: { code: { in: ["KAS-JATIM-CMR", "KAS-JATIM-FTC", "BNK-JATIM-CMR", "BNK-JATIM-FTC"] } },
  });
  for (const acc of accounts) {
    const rows = await prisma.cashBankTransaction.findMany({
      where: { accountId: acc.id },
      orderBy: { transactionDate: "asc" },
    });
    console.log(`\n===== ${acc.code} | ${acc.name} | saldo=${acc.balance} | n=${rows.length} =====`);
    const byKey = new Map<string, { n: number; sum: number }>();
    for (const r of rows) {
      const k = `${r.type}/${r.category ?? "-"}/${r.unitType ?? "-"}/${r.paymentMethod ?? "-"}`;
      const e = byKey.get(k) ?? { n: 0, sum: 0 };
      e.n++; e.sum += Number(r.amount);
      byKey.set(k, e);
    }
    for (const [k, v] of [...byKey.entries()].sort()) console.log(`  ${k.padEnd(48)} n=${String(v.n).padStart(5)} sum=${v.sum.toFixed(2)}`);
    const inSum = rows.filter(r => r.type === "in").reduce((s, r) => s + Number(r.amount), 0);
    const outSum = rows.filter(r => r.type === "out").reduce((s, r) => s + Number(r.amount), 0);
    console.log(`  TOTAL in=${inSum.toFixed(2)} out=${outSum.toFixed(2)} => in-out=${(inSum - outSum).toFixed(2)}`);
    // transaksi terakhir per akun
    const last = rows.slice(-3);
    for (const r of last) console.log(`  last: ${r.transactionDate.toISOString().slice(0, 10)} ${r.type} ${Number(r.amount).toFixed(0)} ${r.category} "${(r.description ?? "").slice(0, 60)}"`);
  }

  // Transfer/setoran antar akun: cari tipe transfer & pasangan
  const transfers = await prisma.cashBankTransaction.findMany({
    where: { category: "transfer", accountId: { in: accounts.map(a => a.id) } },
    orderBy: { transactionDate: "desc" },
    take: 10,
  });
  console.log(`\n=== transfer terakhir di akun tsb (n=${transfers.length}) ===`);
  for (const t of transfers) console.log(`  ${t.transactionDate.toISOString().slice(0, 10)} acc=${t.accountId} ${t.type} ${Number(t.amount).toFixed(0)} "${(t.description ?? "").slice(0, 60)}"`);

  // Sebaran pendapatan_unit per akun tujuan (cek double-booking kas vs bank)
  const income = await prisma.cashBankTransaction.findMany({
    where: { category: "pendapatan_unit", type: "in" },
    select: { accountId: true, paymentMethod: true, amount: true },
  });
  const byAcc = new Map<number, { n: number; sum: number }>();
  for (const r of income) {
    const e = byAcc.get(r.accountId) ?? { n: 0, sum: 0 };
    e.n++; e.sum += Number(r.amount);
    byAcc.set(r.accountId, e);
  }
  const allAcc = await prisma.cashBankAccount.findMany({ select: { id: true, code: true } });
  const codeOf = new Map(allAcc.map(a => [a.id, a.code]));
  console.log(`\n=== pendapatan_unit (in) per akun ===`);
  for (const [id, v] of [...byAcc.entries()].sort()) console.log(`  ${String(codeOf.get(id) ?? id).padEnd(16)} n=${String(v.n).padStart(5)} sum=${v.sum.toFixed(2)}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
