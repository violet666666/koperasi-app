/**
 * DIAGNOSTIC (read-only): Audit totalExpense SHU 2026 — dua hipotesis:
 * (1) DOBEL journal-expense vs CB non-journaled (pola sama dengan bug income);
 * (2) SALAH KLASIFIKASI data CB expense: transfer/setoran bank, gerak simpanan,
 *     belanja modal (capex konstruksi/aset) yang tercatat sebagai beban operasional.
 *
 * Usage: NODE_ENV=production npx tsx --env-file=.env scripts/diagnose-shu-expense-audit.ts
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const toNum = (d: any) => (d === null || d === undefined ? 0 : typeof d === "number" ? d : Number(d));
const rp = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");

// Mirror NON_EXPENSE_CATEGORIES shu-calculator.ts
const NON_EXPENSE = [
    "pencairan_pinjaman", "transfer", "savings", "simpanan_pokok", "simpanan_wajib",
    "simpanan_sukarela", "angsuran_pokok", "void_penjualan_toko", "void_unit_transaction",
    "pendapatan_unit", "jasa_pinjaman", "penalti_pelunasan", "dana_resiko", "lainnya",
];

const BUCKETS: { name: string; regex: RegExp }[] = [
    { name: "TRANSFER/SETORAN (setor ke bank, terima dari, tarik, ambil kas, sikeu,transfer)", regex: /setor\s*(ke)?\s*bank|terima\s*dari|tarik\s*tunai|ambil\s+(kas|tunai)|sikeu|transfer/i },
    { name: "CAPEX/ASET (konstruksi, bangunan, perabot, kursi, renovasi, pembangunan)", regex: /konstruksi|kontruksi|bangunan|perabot|kursi|renovasi|pembangunan|gedung|tangga/i },
    { name: "SIMPANAN (simpanan pokok/wajib/sukarela anggota)", regex: /simpanan\s+(pokok|wajib|sukarela)|pengembalian\s+simpanan/i },
    { name: "MODAL/INJECT (modal pertama/unit, penanaman)", regex: /modal\s*(pertama|awal|unit)|penanaman\s+modal/i },
];

async function main() {
    const year = 2026;
    const startDate = new Date(Date.UTC(year, 0, 1));
    const endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    // ── Hipotesis 1: journal expense lines vs CB non-journaled expense ──
    const journalExpLines = await prisma.journalLine.findMany({
        where: { journal: { transactionDate: { gte: startDate, lte: endDate }, isPosted: true }, account: { type: "expense" } },
        select: { debit: true, credit: true, account: { select: { code: true, name: true } }, journal: { select: { description: true } } },
    });
    const journalExpTotal = journalExpLines.reduce((s, l) => s + toNum(l.debit) - toNum(l.credit), 0);
    const byAcct: Record<string, number> = {};
    for (const l of journalExpLines) {
        const k = `${l.account.code} ${l.account.name}`;
        byAcct[k] = (byAcct[k] || 0) + toNum(l.debit) - toNum(l.credit);
    }
    console.log("=== HIPOTESIS 1: Journal expense lines ===");
    console.log(`Total: ${rp(journalExpTotal)} (${journalExpLines.length} baris)`);
    for (const [k, v] of Object.entries(byAcct)) console.log(`  ${k}: ${rp(v)}`);

    // CB expense non-journaled — cek apakah ada yang ref/journal-nya tumpang tindih
    const cbExp = await prisma.cashBankTransaction.findMany({
        where: { transactionDate: { gte: startDate, lte: endDate }, type: "out", journalId: null, category: { notIn: NON_EXPENSE } },
        select: { id: true, category: true, amount: true, description: true, unitType: true, transactionDate: true, accountId: true },
        orderBy: { amount: "desc" },
    });
    const cbExpTotal = cbExp.reduce((s, t) => s + toNum(t.amount), 0);
    console.log(`\nCB expense non-journaled (masuk SHU): ${rp(cbExpTotal)} (${cbExp.length} tx)`);
    const cbLinked = await prisma.cashBankTransaction.count({ where: { transactionDate: { gte: startDate, lte: endDate }, type: "out", journalId: { not: null }, category: { notIn: NON_EXPENSE } } });
    console.log(`CB expense SUDAH ber-journalId (ter-exclude dari merge — benar): ${cbLinked} tx`);

    // ── Hipotesis 2: salah klasifikasi kubu per kategori ──
    console.log("\n=== HIPOTESIS 2: Klasifikasi CB expense (kubu sinyal deskripsi) ===");
    const byCat: Record<string, { total: number; n: number }> = {};
    const bucketTotals: Record<string, number> = {};
    const bucketSamples: Record<string, string[]> = {};
    let unmatched = 0;
    for (const t of cbExp) {
        const cat = t.category || "(null)";
        byCat[cat] = byCat[cat] || { total: 0, n: 0 };
        byCat[cat].total += toNum(t.amount); byCat[cat].n++;
        const desc = t.description || "";
        const hit = BUCKETS.find((b) => b.regex.test(desc));
        if (hit) {
            bucketTotals[hit.name] = (bucketTotals[hit.name] || 0) + toNum(t.amount);
            (bucketSamples[hit.name] = bucketSamples[hit.name] || []).push(`${desc.slice(0, 60)} — ${rp(toNum(t.amount))} [${cat}]`);
        } else {
            unmatched += toNum(t.amount);
        }
    }
    console.log("\nPer kategori:");
    for (const [c, v] of Object.entries(byCat).sort((a, b) => b[1].total - a[1].total)) console.log(`  ${c}: ${v.n} tx, ${rp(v.total)}`);
    console.log("\nPer kubu sinyal (patut dicurigai bukan beban riil):");
    for (const [b, v] of Object.entries(bucketTotals).sort((x, y) => y[1] - x[1])) {
        console.log(`  ${b}: ${rp(v)} (${bucketSamples[b].length} tx)`);
    }
    console.log(`  TANPA sinyal (kemungkinan beban riil): ${rp(unmatched)}`);

    // Void reversal ikut? (void_* kategori ter-exclude — cek tak bocor)
    console.log("\nTop 15 CB expense terbesar (semua kategori masuk-SHU):");
    for (const t of cbExp.slice(0, 15)) {
        console.log(`  ${t.transactionDate.toISOString().slice(0, 10)} | ${rp(toNum(t.amount))} | ${t.category} | ${(t.description || "").slice(0, 60)}`);
    }

    // Simulasi: expense "bersih" bila kubu transfer+capex+simpanan+modal dikeluarkan
    const suspect = Object.values(bucketTotals).reduce((a, b) => a + b, 0);
    console.log(`\n=== SIMULASI ===`);
    console.log(`totalExpense saat ini (CB)       : ${rp(cbExpTotal)}`);
    console.log(`Tersangka salah klasifikasi       : ${rp(suspect)}`);
    console.log(`CB expense bersih                 : ${rp(cbExpTotal - suspect)}`);
    console.log(`(belum termasuk ST-COGS & journal expense — lihat output calculator)`);
}
main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
