/**
 * Diagnostic: quantify the regression gaps introduced by commit ec44b21.
 *   - D4 gap: how many txs have a NON-NULL category that is NOT in KNOWN_CATEGORIES
 *             (typo/garbage rot that null-only detection now misses)?
 *   - D3 context: amount distribution (median, percentiles) so we can pick a SANE
 *             relative-outlier threshold instead of the noisy 10× median that was removed.
 *
 * READ-ONLY. Safe to run against prod.
 *
 * Usage: NODE_ENV=production npx tsx --env-file=.env scripts/diagnose-anomali-breakdown.ts
 */
import { PrismaClient } from "@prisma/client";
import { KNOWN_CATEGORIES, VALID_CB_CATEGORIES } from "../src/lib/services/anomaly-detector";

const prisma = new PrismaClient({ log: ["error"] });
const rp = (n: number) => n.toLocaleString("id-ID");

function percentile(sortedAsc: number[], p: number): number {
    if (sortedAsc.length === 0) return 0;
    const idx = Math.min(sortedAsc.length - 1, Math.floor((p / 100) * sortedAsc.length));
    return sortedAsc[idx];
}

async function main() {
    const year = 2026;
    const startDate = new Date(Date.UTC(year, 0, 1));
    const endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
    const range = { transactionDate: { gte: startDate, lte: endDate } };

    // ── D4 EVIDENCE ──────────────────────────────────────────────────────
    const [nullCount, allCats] = await Promise.all([
        prisma.cashBankTransaction.count({ where: { ...range, category: null } }),
        prisma.cashBankTransaction.groupBy({
            by: ["category"],
            where: range,
            _count: { _all: true },
            orderBy: { _count: { category: "desc" } },
        }),
    ]);

    console.log("=== D4 — KATEGORI TIDAK DIKENAL (2026) ===");
    console.log(`  Total tx 2026             : ${rp(allCats.reduce((s, c) => s + c._count._all, 0))}`);
    console.log(`  category = null           : ${rp(nullCount)}  ← D4 tangkap (tidak dikategorikan)`);
    // Bar baru: pakai superset VALID_CB_CATEGORIES (UI enum ∪ sistem/legacy) = definisi "valid" D4.
    const nonNullInvalid = allCats.filter((c) => c.category !== null && !VALID_CB_CATEGORIES.has(c.category!));
    const nonNullInvalidCount = nonNullInvalid.reduce((s, c) => s + c._count._all, 0);
    console.log(`  non-null INVALID (superset): ${rp(nonNullInvalidCount)}  ← D4 JUGA tangkap (typo/garbage)`);
    // Konteks: kategori legit di luar UI enum 13-key (dulu keliru di-flag saat pakai KNOWN_CATEGORIES).
    const legitOutsideEnum = allCats.filter((c) => c.category !== null && !KNOWN_CATEGORIES.has(c.category!) && VALID_CB_CATEGORIES.has(c.category!));
    const legitOutsideEnumCount = legitOutsideEnum.reduce((s, c) => s + c._count._all, 0);
    console.log(`  legit di luar enum UI     : ${rp(legitOutsideEnumCount)}  ← BENAR tidak di-flag (mis. pendapatan_toko) ✓`);
    if (nonNullInvalid.length) {
        console.log("\n  Breakdown nilai non-null invalid (typo/garbage):");
        for (const c of nonNullInvalid.slice(0, 25)) {
            console.log(`    "${c.category}"`.padEnd(34) + `→ ${rp(c._count._all)} tx`);
        }
    } else {
        console.log("  ✓ Tidak ada typo/garbage non-null — D4 cuma flag null (+ future typo otomatis)");
    }

    // ── D3 EVIDENCE ──────────────────────────────────────────────────────
    const amounts = (await prisma.cashBankTransaction.findMany({
        where: range,
        select: { amount: true },
    })).map((t) => Number(t.amount ?? 0)).filter((n) => Number.isFinite(n));
    const sorted = [...amounts].sort((a, b) => a - b);
    const n = sorted.length;
    const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;

    console.log("\n=== D3 — DISTRIBUSI AMOUNT (2026) ===");
    console.log(`  N tx                    : ${rp(n)}`);
    console.log(`  median                  : Rp ${rp(median)}`);
    console.log(`  p90                     : Rp ${rp(percentile(sorted, 90))}`);
    console.log(`  p95                     : Rp ${rp(percentile(sorted, 95))}`);
    console.log(`  p99                     : Rp ${rp(percentile(sorted, 99))}`);
    const FLOOR = 50_000_000;
    const geFloor = sorted.filter((a) => a >= FLOOR).length;
    console.log(`  ≥ Rp50jt floor (D3 now) : ${rp(geFloor)}  ← yang D3 tangkap saat ini`);
    const tenXmedian = median > 0 ? sorted.filter((a) => a > 10 * median && a < FLOOR).length : 0;
    console.log(`  >10×median & <floor     : ${rp(tenXmedian)}  ← yang logika LAMA tangkap (buktikan noise)`);
    // Candidate sane relative thresholds (absolute floor + relative):
    for (const [mult, absFloor] of [[100, 5_000_000], [100, 10_000_000], [50, 10_000_000]] as const) {
        const cnt = sorted.filter((a) => a >= absFloor && median > 0 && a > mult * median).length;
        console.log(`  ≥Rp${rp(absFloor)} & >${mult}×median : ${rp(cnt)}  (kandidat threshold adaptif)`);
    }

    await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
