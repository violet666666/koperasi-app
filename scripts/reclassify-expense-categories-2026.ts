/**
 * MIGRASI DATA: reclassify CB expense 2026 yang salah kategori (audit bb3d45bc).
 * Kebijakan disetujui user 2026-09-30: SISTEM PERSEDIAAN (pembelian stok → hpp_toko,
 * beban diakui via COGS saat penjualan) + benahi salah klasifikasi (transfer/simpanan/capex).
 *
 * Bucket & target:
 *   transfer   : terima-dari/setor-bank/dipinjam/modal → kategori `transfer`
 *   savings    : bayar/ambil simpanan anggota          → kategori `savings`
 *   belanja_aset: konstruksi/perabot/AC/instalasi dll  → kategori `belanja_aset` (baru)
 *   hpp_toko   : bayar supplier (PT/CV/UD), rokok/beras/LPG, belanja bahan kitchen
 *                unit toko/resto/cafe                  → kategori `hpp_toko` (existing)
 *   KEEP       : listrik/honor/gaji/parkir/kasir — biaya operasional riil, tidak disentuh
 *   UNRESOLVED : tak cocok pola & unit tak dikenal — TIDAK disentuh (dilaporkan)
 *
 * Safety: dry-run default; --execute = tulis dalam 1 $transaction (hanya kolom `category`,
 * deskripsi/tanggal/jumlah tak diubah) + rollback file JSON (id → kategori lama).
 *
 * Usage:
 *   NODE_ENV=production npx tsx --env-file=.env scripts/reclassify-expense-categories-2026.ts            # dry-run
 *   NODE_ENV=production npx tsx --env-file=.env scripts/reclassify-expense-categories-2026.ts --execute  # tulis
 */
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "fs";
const prisma = new PrismaClient();
const EXECUTE = process.argv.includes("--execute");
const toNum = (d: any) => (d === null || d === undefined ? 0 : typeof d === "number" ? d : Number(d));
const rp = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");

// NON_EXPENSE_CATEGORIES shu-calculator.ts (pasca-edit) — rows di kategori ini sudah
// benar dikeluarkan dari SHU, bukan kandidat reclassify.
const SKIP_CATEGORIES = [
    "pencairan_pinjaman", "transfer", "savings", "simpanan_pokok", "simpanan_wajib",
    "simpanan_sukarela", "angsuran_pokok", "void_penjualan_toko", "void_unit_transaction",
    "pendapatan_unit", "jasa_pinjaman", "penalti_pelunasan", "dana_resiko", "lainnya",
    "hpp_toko", "belanja_aset",
];

// ── Classifier (urutan = prioritas; dicek terhadap deskripsi lowercase) ──
// Instalasi/pemasangan dulu — "pemasangan instalasi listrik" adalah capex, BUKAN tagihan listrik.
const RX_INSTALL = /instalasi|pemasangan/;
// Biaya operasional riil — dibiarkan di kategori semula (tetap beban SHU).
const RX_KEEP = /listrik|pln|token\s*listrik|honor|gaji|upah|parkir|kasir|pengurus|telepon|internet|bensin/;
const RX_TRANSFER = /terima\s+dari|setor\s*(ke)?\s*bank|dipinjam|modal\s*(pertama|awal|unit)/;
const RX_SAVINGS = /simpanan|tabungan/;
const RX_CAPEX = /kontruksi|konstruksi|bangun|perabot|kursi|meja|sofa|tangga|neon\s*box|interior|unit\s*ac|inventaris|lighting|lightening|lampu|tukang|bahan\s*bangun|pembuatan|fitur|kaca|\bdp\b|pelunasan/;
const RX_HPP = /bayar\s*(ke)?\s*(pt|cv|ud)[\s.]|rokok|beras|\blpg\b|bola\s*tenis|\bars\b|belanja|beli\s*bahan|bahan\s*baku|kitchen|dapur|bar\s*nota/;
// Unit yang jalannya jual barang/bahan → default non-operasional = pembelian stok.
const RX_STOCK_UNIT = /^(toko|resto|cafe|coffe)/;

type Bucket = "transfer" | "savings" | "belanja_aset" | "hpp_toko";
function classify(desc: string, unitType: string | null): Bucket | "KEEP" | "UNRESOLVED" {
    const d = (desc || "").toLowerCase();
    if (!d) return "UNRESOLVED";
    if (RX_INSTALL.test(d)) return "belanja_aset";
    if (RX_KEEP.test(d)) return "KEEP";
    if (RX_TRANSFER.test(d)) return "transfer";
    if (RX_SAVINGS.test(d)) return "savings";
    if (RX_CAPEX.test(d)) return "belanja_aset";
    if (RX_HPP.test(d)) return "hpp_toko";
    // Non-utility di unit jualan → pembelian stok (mis. "BAYAR KE TRI KARYA")
    if (unitType && RX_STOCK_UNIT.test(unitType)) return "hpp_toko";
    return "UNRESOLVED";
}

async function main() {
    const startDate = new Date(Date.UTC(2026, 0, 1));
    const endDate = new Date(Date.UTC(2026, 11, 31, 23, 59, 59, 999));

    const rows = await prisma.cashBankTransaction.findMany({
        where: { transactionDate: { gte: startDate, lte: endDate }, type: "out", journalId: null, category: { notIn: SKIP_CATEGORIES } },
        select: { id: true, transactionNo: true, transactionDate: true, unitType: true, category: true, amount: true, description: true },
        orderBy: { amount: "desc" },
    });
    console.log(`Kandidat (type=out, non-journaled, kategori expense, 2026): ${rows.length} tx, ${rp(rows.reduce((s, r) => s + toNum(r.amount), 0))}`);

    const plan: { id: number; transactionNo: string; date: string; unitType: string | null; oldCategory: string | null; newCategory: Bucket; amount: number; description: string }[] = [];
    const buckets: Record<string, { n: number; total: number; rows: typeof rows }> = {};
    const unresolved: typeof rows = [];
    const kept: typeof rows = [];
    for (const r of rows) {
        const c = classify(r.description || "", r.unitType);
        if (c === "KEEP") { kept.push(r); continue; }
        if (c === "UNRESOLVED") { unresolved.push(r); continue; }
        buckets[c] = buckets[c] || { n: 0, total: 0, rows: [] };
        buckets[c].n++; buckets[c].total += toNum(r.amount); buckets[c].rows.push(r);
        plan.push({ id: r.id, transactionNo: r.transactionNo, date: r.transactionDate.toISOString().slice(0, 10), unitType: r.unitType, oldCategory: r.category, newCategory: c, amount: toNum(r.amount), description: (r.description || "").slice(0, 120) });
    }

    console.log("\n=== PLAN (dry-run) ===");
    for (const [b, v] of Object.entries(buckets).sort((x, y) => y[1].total - x[1].total)) {
        console.log(`${b.padEnd(13)}: ${String(v.n).padStart(4)} tx, ${rp(v.total)}`);
    }
    console.log(`KEEP (biaya operasional riil, tak diubah): ${kept.length} tx, ${rp(kept.reduce((s, r) => s + toNum(r.amount), 0))}`);
    console.log(`UNRESOLVED (tak disentuh): ${unresolved.length} tx, ${rp(unresolved.reduce((s, r) => s + toNum(r.amount), 0))}`);
    for (const u of unresolved) console.log(`  UNRESOLVED: ${(u.description || "").slice(0, 70)} — ${rp(toNum(u.amount))} [${u.unitType || "-"}]`);
    // KEEP terbesar utk sanity (harusnya listrik/honor/gaji)
    console.log("\nKEEP top 8 (sanity — harus utilities/gaji):");
    for (const k of kept.slice(0, 8)) console.log(`  ${(k.description || "").slice(0, 70)} — ${rp(toNum(k.amount))} [${k.unitType || "-"}]`);
    // Capex terbesar utk sanity
    if (buckets.belanja_aset) {
        console.log("\nbelanja_aset top 10 (sanity):");
        for (const r of buckets.belanja_aset.rows.slice(0, 10)) console.log(`  ${(r.description || "").slice(0, 70)} — ${rp(toNum(r.amount))}`);
    }

    writeFileSync("scripts/output/reclassify-plan-2026.json", JSON.stringify(plan, null, 2));
    console.log(`\nPlan lengkap: scripts/output/reclassify-plan-2026.json (${plan.length} baris)`);

    // Laporan pre-2026 (tidak dieksekusi — hanya hitung)
    const pre = await prisma.cashBankTransaction.findMany({
        where: { transactionDate: { lt: startDate }, type: "out", journalId: null, category: { notIn: SKIP_CATEGORIES } },
        select: { unitType: true, category: true, amount: true, description: true },
    });
    const preHits = pre.filter((r) => { const c = classify(r.description || "", r.unitType); return c !== "KEEP" && c !== "UNRESOLVED"; });
    console.log(`PRE-2026 kandidat serupa: ${preHits.length} tx, ${rp(preHits.reduce((s, r) => s + toNum(r.amount), 0))} (TIDAK dieksekusi)`);

    if (!EXECUTE) { console.log("\nDRY-RUN saja — jalankan ulang dengan --execute untuk menulis."); return; }

    // ── EXECUTE: 1 transaction, hanya kolom category, rollback file ditulis dulu ──
    writeFileSync("scripts/output/reclassify-rollback-2026.json", JSON.stringify(
        plan.map((p) => ({ id: p.id, restoreCategory: p.oldCategory, transactionNo: p.transactionNo, wasReclassifiedTo: p.newCategory })), null, 2,
    ));
    console.log(`Rollback file: scripts/output/reclassify-rollback-2026.json`);

    const total = await prisma.$transaction(async (tx) => {
        let n = 0;
        for (const [b, v] of Object.entries(buckets)) {
            const ids = v.rows.map((r) => r.id);
            for (let i = 0; i < ids.length; i += 500) {
                const res = await tx.cashBankTransaction.updateMany({ where: { id: { in: ids.slice(i, i + 500) } }, data: { category: b } });
                n += res.count;
            }
        }
        return n;
    });
    console.log(`\nEXECUTED: ${total} rows di-update (kolom category saja).`);

    // Verifikasi pasca-tulis
    const after = await prisma.cashBankTransaction.groupBy({ by: ["category"], where: { transactionDate: { gte: startDate, lte: endDate }, type: "out" }, _count: true, _sum: { amount: true } });
    console.log("\nKomposisi type=out 2026 pasca-migrasi:");
    for (const a of after.sort((x, y) => toNum(y._sum.amount) - toNum(x._sum.amount))) console.log(`  ${a.category}: ${a._count} tx, ${rp(toNum(a._sum.amount))}`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
