/**
 * DIAGNOSTIK: Duplikasi Pendapatan/Beban Per-Unit di Laporan SHU
 * ------------------------------------------------------------------
 * Menguji apakah angka "Pendapatan / Pengeluaran / Laba-Rugi" per unit
 * yang ditampilkan di /laporan/shu (tabel unitBreakdown) sudah benar.
 *
 * HIPOTESIS: Kalkulator menjumlahkan StoreSale + UnitTransaction + CB income
 * tanpa dedup. Karena alur POS cash/QRIS menciptakan DUA record untuk 1 penjualan
 * (StoreSale/UnitTransaction DAN CashBankTransaction pendapatan_toko/pendapatan_unit),
 * maka revenue per-unit bisa TERHITUNG 2× lipat.
 *
 * Sumber: src/lib/services/shu-calculator.ts (unitBreakdown, baris ~542-590)
 *
 * Jalankan:
 *   NODE_ENV=production npx tsx --env-file=.env scripts/diagnose-shu-unit-revenue-duplikasi.ts
 *
 * READ-ONLY terhadap database.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const toNum = (d: any): number => {
    if (d === null || d === undefined) return 0;
    return typeof d === "number" ? d : Number(d);
};

const rp = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");

async function main() {
    const year = 2026;
    const startDate = new Date(Date.UTC(year, 0, 1));
    const endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    console.log("=".repeat(80));
    console.log(`DIAGNOSTIK: Duplikasi Pendapatan/Beban Per-Unit — Laporan SHU ${year}`);
    console.log("=".repeat(80));
    console.log(`Periode: ${startDate.toISOString().slice(0, 10)} → ${endDate.toISOString().slice(0, 10)}\n`);

    // ── 1. PATH DETECTION ────────────────────────────────────────────
    const journalLineCount = await prisma.journalLine.count({
        where: { journal: { transactionDate: { gte: startDate, lte: endDate }, isPosted: true } },
    });
    console.log(`[PATH] JournalLine posted ${year}: ${journalLineCount}`);
    console.log(`       → Kalkulator memakai: ${journalLineCount > 0 ? "JOURNAL PATH" : "FALLBACK PATH"}\n`);

    // ── 2. REKONSTRUKSI unitBreakdown kalkulator (3 sumber revenue) ──
    // storeSalesByUnit: StoreSale non-voided, semua metode
    const storeSalesByUnit = await prisma.storeSale.groupBy({
        by: ["unitType"],
        where: {
            createdAt: { gte: startDate, lte: endDate },
            NOT: { metadata: { path: ["isVoided"], equals: true } } as any,
        },
        _sum: { totalAmount: true }, _count: true,
    });
    // unitTxByUnit: UnitTransaction isPaid + completed (cash/QRIS saja — salary_cut isPaid=false)
    const unitTxByUnit = await prisma.unitTransaction.groupBy({
        by: ["unitType"],
        where: { transactionDate: { gte: startDate, lte: endDate }, isPaid: true, status: "completed" },
        _sum: { amount: true }, _count: true,
    });
    // incomeByUnit: CB type=in, journalId=null, kategori income unit (mirror dari penjualan cash/QRIS)
    const cbIncomeByUnit = await prisma.cashBankTransaction.groupBy({
        by: ["unitType"],
        where: {
            transactionDate: { gte: startDate, lte: endDate },
            type: "in",
            journalId: null,
            category: { in: ["pendapatan_toko", "pendapatan_unit"] },
        },
        _sum: { amount: true }, _count: true,
    });
    // expenseByUnit: CB type=out non-blacklist
    const NON_EXPENSE = [
        "pencairan_pinjaman", "transfer", "savings", "simpanan_pokok", "simpanan_wajib",
        "simpanan_sukarela", "angsuran_pokok", "void_penjualan_toko", "void_unit_transaction",
        "pendapatan_unit", "jasa_pinjaman", "penalti_pelunasan", "dana_resiko", "lainnya",
    ];
    const expenseByUnit = await prisma.cashBankTransaction.groupBy({
        by: ["unitType"],
        where: {
            transactionDate: { gte: startDate, lte: endDate },
            type: "out",
            category: { notIn: NON_EXPENSE },
        },
        _sum: { amount: true }, _count: true,
    });

    // Gabungkan ke map per-unit (mimik kalkulator baris 542-590)
    const revenueMap: Record<string, { store: number; unitTx: number; cb: number; txCount: number }> = {};
    const ensure = (ut: string) => {
        if (!revenueMap[ut]) revenueMap[ut] = { store: 0, unitTx: 0, cb: 0, txCount: 0 };
        return revenueMap[ut];
    };
    for (const s of storeSalesByUnit) { const e = ensure(s.unitType || "toko"); e.store += toNum(s._sum.totalAmount); e.txCount += s._count; }
    for (const u of unitTxByUnit) { const e = ensure(u.unitType); e.unitTx += toNum(u._sum.amount); e.txCount += u._count; }
    for (const c of cbIncomeByUnit) { const e = ensure(c.unitType || "simpan_pinjam"); e.cb += toNum(c._sum.amount); e.txCount += c._count; }
    const expenseMap: Record<string, number> = {};
    for (const e of expenseByUnit) {
        const ut = e.unitType && e.unitType !== "none" && e.unitType !== "simpan_pinjam" ? e.unitType : "_umum";
        expenseMap[ut] = toNum(e._sum.amount);
    }

    console.log("=".repeat(80));
    console.log("[A] REVENUE PER UNIT — DEKOMPOSISI 3 SUMBER");
    console.log("=".repeat(80));
    console.log("Unit".padEnd(20) + "StoreSale".padStart(16) + "UnitTx".padStart(16) + "CB-income".padStart(16) + " | " + "DITAMPILKAN".padStart(16) + " | " + "INFLASI".padStart(10));
    console.log("-".repeat(100));
    let totalDisplayed = 0, totalCbMirror = 0;
    for (const [ut, d] of Object.entries(revenueMap).sort((a, b) => (b[1].store + b[1].unitTx + b[1].cb) - (a[1].store + a[1].unitTx + a[1].cb))) {
        const displayed = d.store + d.unitTx + d.cb;
        const inflasi = d.cb > 0 ? Math.round((d.cb / displayed) * 100) : 0;
        totalDisplayed += displayed;
        totalCbMirror += d.cb;
        console.log(
            ut.padEnd(20) +
            rp(d.store).padStart(16) +
            rp(d.unitTx).padStart(16) +
            rp(d.cb).padStart(16) +
            " | " + rp(displayed).padStart(16) +
            " | " + (inflasi + "%").padStart(10)
        );
    }
    console.log("-".repeat(100));
    console.log("TOTAL DITAMPILKAN: " + rp(totalDisplayed) + "   |   CB-mirror (potensi dobel): " + rp(totalCbMirror));
    console.log("");

    // ── 3. BUKTI TUMPANG-TINDIH (join via description) ──────────────
    // Toko: CB pendapatan_toko description mengandung saleNo (mis. "Penjualan toko Tunai - TK-...").
    // Unit: CB pendapatan_unit description mengandung trxNo (mis. "Pendapatan cuci_mobil Tunai - CM...").
    console.log("=".repeat(80));
    console.log("[B] BUKTI TUMPANG-TINDIH: Apakah CB-mirror benar2 = record StoreSale/UnitTransaction yg sama?");
    console.log("=".repeat(80));

    // 3a. TOKO — cek setiap CB pendapatan_toko: apakah saleNo-nya ada di StoreSale?
    const cbToko = await prisma.cashBankTransaction.findMany({
        where: { transactionDate: { gte: startDate, lte: endDate }, type: "in", category: "pendapatan_toko", journalId: null },
        select: { amount: true, description: true },
    });
    const tokoSaleNos = new Set((await prisma.storeSale.findMany({
        where: { createdAt: { gte: startDate, lte: endDate } },
        select: { saleNo: true, totalAmount: true, paymentMethod: true },
    })).map(s => s.saleNo));
    let cbTokoMatched = 0, cbTokoMatchedRp = 0, cbTokoUnmatchedRp = 0;
    for (const cb of cbToko) {
        // ekstrak ref (pattern: - TK-DDMMYYYY-NNNN atau prefix lain)
        const m = cb.description?.match(/-\s*([A-Z]{2}-\d{8}-\d{4})/);
        const ref = m ? m[1] : null;
        if (ref && tokoSaleNos.has(ref)) { cbTokoMatched++; cbTokoMatchedRp += toNum(cb.amount); }
        else cbTokoUnmatchedRp += toNum(cb.amount);
    }
    console.log(`\n  [TOKO] CB pendapatan_toko (journalId=null): ${cbToko.length} baris, total ${rp(cbToko.reduce((s, c) => s + toNum(c.amount), 0))}`);
    console.log(`         → punya StoreSale match : ${cbTokoMatched} baris, ${rp(cbTokoMatchedRp)}  ← INI DOBEL-HITUNG`);
    console.log(`         → tanpa match            : ${rp(cbTokoUnmatchedRp)}`);

    // 3b. UNIT-LAYANAN — cek setiap CB pendapatan_unit: apakah trxNo-nya ada di UnitTransaction?
    const cbUnit = await prisma.cashBankTransaction.findMany({
        where: { transactionDate: { gte: startDate, lte: endDate }, type: "in", category: "pendapatan_unit", journalId: null },
        select: { amount: true, description: true, unitType: true },
    });
    const unitTxNos = new Set((await prisma.unitTransaction.findMany({
        where: { transactionDate: { gte: startDate, lte: endDate } },
        select: { transactionNo: true },
    })).map(u => u.transactionNo));
    let cbUnitMatched = 0, cbUnitMatchedRp = 0, cbUnitUnmatchedRp = 0;
    const cbUnitByUnitType: Record<string, { matched: number; matchedRp: number; total: number }> = {};
    for (const cb of cbUnit) {
        const m = cb.description?.match(/-\s*([A-Z]{2}\d{12})/);
        const ref = m ? m[1] : null;
        const ut = cb.unitType || "(null)";
        if (!cbUnitByUnitType[ut]) cbUnitByUnitType[ut] = { matched: 0, matchedRp: 0, total: 0 };
        cbUnitByUnitType[ut].total += toNum(cb.amount);
        if (ref && unitTxNos.has(ref)) {
            cbUnitMatched++; cbUnitMatchedRp += toNum(cb.amount);
            cbUnitByUnitType[ut].matched++; cbUnitByUnitType[ut].matchedRp += toNum(cb.amount);
        } else cbUnitUnmatchedRp += toNum(cb.amount);
    }
    console.log(`\n  [UNIT-LAYANAN] CB pendapatan_unit (journalId=null): ${cbUnit.length} baris, total ${rp(cbUnit.reduce((s, c) => s + toNum(c.amount), 0))}`);
    console.log(`         → punya UnitTransaction match : ${cbUnitMatched} baris, ${rp(cbUnitMatchedRp)}  ← INI DOBEL-HITUNG`);
    console.log(`         → tanpa match                  : ${rp(cbUnitUnmatchedRp)}`);
    console.log("\n         Rincian per unitType:");
    for (const [ut, v] of Object.entries(cbUnitByUnitType).sort((a, b) => b[1].matchedRp - a[1].matchedRp)) {
        console.log(`           ${ut.padEnd(18)} matched ${rp(v.matchedRp).padStart(14)} / total ${rp(v.total).padStart(14)} (${v.matched} baris)`);
    }

    // ── 4. LABA/RUGI PER UNIT: DITAMPILKAN vs DEDUP ─────────────────
    console.log("\n" + "=".repeat(80));
    console.log("[C] LABA/RUGI PER UNIT — DITAMPILKAN vs SEHARUSNYA (dedup CB-mirror)");
    console.log("=".repeat(80));
    console.log("Unit".padEnd(20) + "Expense".padStart(14) + " | " + "Laba DITAMPILKAN".padStart(18) + " | " + "Laba SEHARUSNYA".padStart(18) + " | " + "Selisih".padStart(14));
    console.log("-".repeat(95));
    for (const [ut, d] of Object.entries(revenueMap).sort((a, b) => (b[1].store + b[1].unitTx + b[1].cb) - (a[1].store + a[1].unitTx + a[1].cb))) {
        const expRaw = expenseMap[ut] || 0;
        const displayedRev = d.store + d.unitTx + d.cb;
        const trueRev = d.store + d.unitTx; // CB-mirror dibuang
        const labaDisplayed = displayedRev - expRaw;
        const labaTrue = trueRev - expRaw;
        const label = ut === "_umum" ? "Beban Umum" : ut;
        console.log(
            label.padEnd(20) +
            rp(expRaw).padStart(14) +
            " | " + rp(labaDisplayed).padStart(18) +
            " | " + rp(labaTrue).padStart(18) +
            " | " + rp(labaDisplayed - labaTrue).padStart(14)
        );
    }

    // ── 5. CROSS-CHECK TOTAL PENDAPATAN (apakah totalIncome jg dobel?) ─
    console.log("\n" + "=".repeat(80));
    console.log("[D] CROSS-CHECK: Apakah TOTAL PENDAPATAN (summary card) juga terdampak?");
    console.log("=".repeat(80));
    const cbIncomeTotal = cbToko.reduce((s, c) => s + toNum(c.amount), 0) + cbUnit.reduce((s, c) => s + toNum(c.amount), 0);
    const journal4201 = await prisma.journalLine.aggregate({
        where: {
            journal: { transactionDate: { gte: startDate, lte: endDate }, isPosted: true },
            account: { code: "4201" },
        },
        _sum: { credit: true, debit: true },
    });
    const net4201 = toNum(journal4201._sum.credit) - toNum(journal4201._sum.debit);
    console.log(`  JournalLine akun 4201 (Pendapatan Toko/Unit)  : ${rp(net4201)}`);
    console.log(`  CB pendapatan_toko + pendapatan_unit (jId=null): ${rp(cbIncomeTotal)}`);
    if (journalLineCount > 0) {
        console.log(`  → JOURNAL PATH aktif: totalIncome = JournalLine + CB-non-journaled`);
        console.log(`    Jika keduanya > 0 untuk penjualan yang sama → TOTAL INCOME JUGA DOBEL.`);
    }

    console.log("\n" + "=".repeat(80));
    console.log("KESIMPULAN PRELIMINER:");
    console.log(`  Potensi pendapatan dobel-hitung di tabel per-unit: ${rp(cbTokoMatchedRp + cbUnitMatchedRp)}`);
    console.log(`  (CB-mirror yg terbukti punya pasangan StoreSale/UnitTransaction)`);
    console.log("=".repeat(80));

    await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
