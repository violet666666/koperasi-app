// Koreksi saldo kas korup akibat race condition (Juni-Juli 2026).
// KAS-JATIM-CMR: ghost +2.500.028.572; KAS-JATIM-FTC: drift -16.635.649.
// Prinsip: saldo sah = balanceBefore baris pertama + Σ(in-out) transaksi.
// Dry-run default; --apply untuk menulis. Backup ke backups/ SEBELUM menulis.
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";
import { prisma } from "../src/lib/prisma";

const APPLY = process.argv.includes("--apply");
const BACKUP = `backups/kas-race-fix-${new Date().toISOString().slice(0, 10)}.json`;
const TARGETS = ["KAS-JATIM-CMR", "KAS-JATIM-FTC"]; // hanya ini yang dikoreksi (disetujui user)

async function main() {
  const accounts = await prisma.cashBankAccount.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true, code: true, name: true, currentBalance: true },
    orderBy: { code: "asc" },
  });

  const report: Array<{
    code: string; name: string; stored: number; backed: number; gap: number; nTx: number; willFix: boolean;
  }> = [];

  for (const acc of accounts) {
    const txs = await prisma.cashBankTransaction.findMany({
      where: { accountId: acc.id },
      orderBy: { id: "asc" },
      select: { type: true, amount: true, balanceBefore: true },
    });
    const stored = Number(acc.currentBalance);
    if (!txs.length) {
      report.push({ code: acc.code, name: acc.name, stored, backed: stored, gap: 0, nTx: 0, willFix: false });
      continue;
    }
    const opening = Number(txs[0].balanceBefore);
    const sumNet = txs.reduce((s, t) => s + (t.type === "in" ? Number(t.amount) : -Number(t.amount)), 0);
    const backed = opening + sumNet;
    const gap = stored - backed;
    report.push({ code: acc.code, name: acc.name, stored, backed, gap, nTx: txs.length, willFix: TARGETS.includes(acc.code) && Math.abs(gap) > 0.01 });
  }

  console.log(`=== AUDIT SALDO vs TRANSAKSI (semua akun aktif) ===`);
  for (const r of report) {
    const mark = Math.abs(r.gap) > 0.01 ? (r.willFix ? " → FIX" : " ??") : " ok";
    console.log(`  ${r.code.padEnd(16)} stored=${r.stored.toFixed(2).padStart(16)} backed=${r.backed.toFixed(2).padStart(16)} gap=${r.gap.toFixed(2).padStart(16)} nTx=${String(r.nTx).padStart(6)}${mark}`);
  }

  const fixes = report.filter((r) => r.willFix);
  const others = report.filter((r) => !r.willFix && Math.abs(r.gap) > 0.01);
  if (others.length) {
    console.log(`\nPERINGATAN: ${others.length} akun lain juga punya gap tapi DI LUAR scope disetujui:`);
    for (const o of others) console.log(`  ${o.code}: gap=${o.gap.toFixed(2)} — tidak disentuh`);
  }
  if (!fixes.length) { console.log("\nTidak ada koreksi perlu (target sudah konsisten)."); return; }

  const backupData = {
    timestamp: new Date().toISOString(),
    reason: "Koreksi ghost saldo akibat race condition penulisan saldo (import backdated + POS paralel, Juni-Juli 2026). Saldo baru = balanceBefore transaksi pertama + Σ(in-out) semua transaksi akun.",
    fixes: fixes.map((f) => ({ code: f.code, name: f.name, oldBalance: f.stored, newBalance: f.backed, gapClosed: f.gap, txCount: f.nTx })),
  };

  if (!APPLY) {
    console.log(`\n[DRY-RUN] akan mengubah:`);
    for (const f of fixes) console.log(`  ${f.code}: ${f.stored.toFixed(2)} → ${f.backed.toFixed(2)} (Δ ${f.gap.toFixed(2)})`);
    console.log(`\nJalankan dengan --apply untuk mengeksekusi. Backup akan ditulis ke ${BACKUP}`);
    return;
  }

  mkdirSync("backups", { recursive: true });
  if (existsSync(BACKUP)) {
    const prev = JSON.parse(readFileSync(BACKUP, "utf8")) as { fixes: unknown[] };
    backupData.fixes = [...prev.fixes, ...backupData.fixes] as typeof backupData.fixes;
  }
  writeFileSync(BACKUP, JSON.stringify(backupData, null, 2));
  console.log(`\nBackup ditulis: ${BACKUP}`);

  await prisma.$transaction(
    fixes.map((f) => prisma.cashBankAccount.update({
      where: { code: f.code },
      data: { currentBalance: f.backed },
    })),
    { timeout: 60000 },
  );

  // post-verify
  const after = await prisma.cashBankAccount.findMany({ where: { code: { in: fixes.map((f) => f.code) } } });
  let ok = true;
  for (const a of after) {
    const f = fixes.find((x) => x.code === a.code)!;
    const match = Math.abs(Number(a.currentBalance) - f.backed) < 0.01;
    if (!match) ok = false;
    console.log(`  VERIFY ${a.code}: ${Number(a.currentBalance).toFixed(2)} (target ${f.backed.toFixed(2)}) ${match ? "OK" : "MISMATCH!"}`);
  }
  console.log(ok ? "\nKoreksi BERHASIL dan terverifikasi." : "\nVERIFIKASI GAGAL — cek manual!");
  if (!ok) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
