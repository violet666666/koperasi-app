/**
 * Diagnostic: buktikan duplikasi "Potong Gaji" di LAPORAN unit Resto/Cafe LSP.
 *
 * Root cause (dugaan): filter dedup di `api/unit/[slug]/laporan/route.ts` hanya
 * meng-exclude `transactionNo` prefix `TK-UTG-` & `MB-UTG-`. Padahal checkout
 * (`api/toko/sales/route.ts` + `split-bill`) membuat `UnitTransaction` potong
 * gaji dengan prefix PER-UNIT: RS-UTG- (resto), RC-UTG-, CF-UTG- (cafe_lsp),
 * CL-UTG-, PS-UTG-. Prefix itu TIDAK di-exclude → muncul sebagai baris ganda
 * di laporan DAN menggembungkan totalPendapatan/potongGaji/laba.
 *
 * READ-ONLY. Aman dijalankan vs prod.
 *
 * Usage: NODE_ENV=production npx tsx --env-file=.env scripts/diagnose-laporan-potonggaji-duplikasi.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["error"] });
const rp = (n: number) => n.toLocaleString("id-ID");

// Prefix yang saat ini di-exclude laporan (HARDCODED di route.ts).
const EXCLUDED_BY_LAPORAN = new Set(["TK-UTG-", "MB-UTG-"]);

// Semua prefix -UTG- yang DIBUAT checkout (salePrefixMap di toko/sales + split-bill + mobile).
const ALL_UTG_PREFIXES = ["TK-UTG-", "RS-UTG-", "RC-UTG-", "CF-UTG-", "CL-UTG-", "PS-UTG-", "MB-UTG-"];

async function main() {
    const year = 2026;
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
    const range = { transactionDate: { gte: start, lte: end } };

    console.log("=== POTONG GAJI DI LAPORAN — DEDUP LEAK (2026) ===");
    console.log(`  Filter laporan saat ini hanya exclude: ${[...EXCLUDED_BY_LAPORAN].join(", ")}\n`);

    let totalLeakCount = 0;
    let totalLeakSum = 0;

    for (const prefix of ALL_UTG_PREFIXES) {
        const excluded = EXCLUDED_BY_LAPORAN.has(prefix);
        const where = { ...range, paymentMethod: "salary_cut", transactionNo: { startsWith: prefix } };
        const [count, sumAgg, unitTypes] = await Promise.all([
            prisma.unitTransaction.count({ where }),
            prisma.unitTransaction.aggregate({ where, _sum: { amount: true } }),
            prisma.unitTransaction.groupBy({ by: ["unitType"], where, _count: { _all: true } }),
        ]);
        const sum = Number(sumAgg._sum.amount || 0);
        const tag = excluded ? "✓ di-exclude" : "✗ LOLOS (duplikat di laporan)";
        console.log(`${prefix.padEnd(10)} ${count.toString().padStart(5)} tx   Rp ${rp(sum).padStart(14)}   ${tag}`);
        for (const u of unitTypes) {
            console.log(`             └ unitType="${u.unitType}" → ${u._count._all} tx`);
        }
        if (!excluded) {
            totalLeakCount += count;
            totalLeakSum += sum;
        }
    }

    console.log("\n=== RINGKASAN DUA UNIT YANG USER SEBUT ===");
    for (const [label, prefix] of [["Resto", "RS-UTG-"], ["Cafe LSP", "CF-UTG-"]] as const) {
        const where = { ...range, paymentMethod: "salary_cut", transactionNo: { startsWith: prefix } };
        const leaks = await prisma.unitTransaction.findMany({
            where,
            select: { transactionNo: true, saleNo: true, amount: true, memberId: true, unitType: true },
            take: 1000,
        });
        // Cross-check: berapa yang punya StoreSale match (bukti double-count nyata)?
        const saleNos = [...new Set(leaks.map((l) => l.saleNo).filter(Boolean))] as string[];
        const matchedSales = saleNos.length > 0
            ? await prisma.storeSale.count({ where: { saleNo: { in: saleNos } } })
            : 0;
        const leakSum = leaks.reduce((s, l) => s + Number(l.amount || 0), 0);
        console.log(`  ${label} (${prefix})`);
        console.log(`     UTG rows           : ${leaks.length}`);
        console.log(`     Ada StoreSale match : ${matchedSales}/${saleNos.length} (→ double-count nyata)`);
        console.log(`     Nominal duplikat    : Rp ${rp(leakSum)}  ← angka ini TERHITUNG 2× di totalPendapatan/potongGaji/laba`);
    }

    console.log("\n=== TOTAL IMPAK (semua unit F&B + PS) ===");
    console.log(`  ${rp(totalLeakCount)} baris duplikat lolos   |   Rp ${rp(totalLeakSum)} nominal dobel-terhitung`);

    // ── FIX VERIFICATION: target dedup = piutang auto-generated (notes "Auto-generated").
    //    Record cuci_mobil (CM-*/CUC-*) BUKAN target — itu transaksi genuine (usesStoreSales=false,
    //    filter memang tidak diaplikasikan). Yang diukur: di antara record auto-generated,
    //    berapa yang lolos filter LAMA vs BARU.
    console.log("\n=== VERIFIKASI FIX (target: piutang auto-generated) ===");
    const autoGen = await prisma.unitTransaction.findMany({
        where: { ...range, notes: { startsWith: "Auto-generated" } },
        select: { transactionNo: true, notes: true, amount: true, unitType: true },
    });
    const oldExcluded = (t: { transactionNo: string }) =>
        t.transactionNo.startsWith("TK-UTG-") || t.transactionNo.startsWith("MB-UTG-");
    const newExcluded = (t: { notes: string | null }) =>
        !!t.notes && t.notes.startsWith("Auto-generated");

    const leakedOld = autoGen.filter((t) => !oldExcluded(t));
    const leakedNew = autoGen.filter((t) => !newExcluded(t));
    const sumOld = leakedOld.reduce((s, t) => s + Number(t.amount || 0), 0);

    console.log(`  Total piutang auto-generated 2026 : ${rp(autoGen.length)} record (semua HARUS di-exclude dr laporan F&B)`);
    console.log(`  Filter LAMA (prefix TK/MB-UTG)    : ${rp(leakedOld.length)} record LOLOS, Rp ${rp(sumOld)} dobel-terhitung`);
    console.log(`  Filter BARU (notes Auto-generated): ${rp(leakedNew.length)} record lolos`);
    if (leakedNew.length === 0) {
        console.log("  ✓ FIX EFEKTIF: 0 piutang auto-generated lolos. Duplikat Potong Gaji di laporan teratasi.");
    } else {
        console.log("  ✗ MASIH ADA leak — investigasi:");
        for (const t of leakedNew.slice(0, 10)) {
            console.log(`     ${t.transactionNo} | notes="${t.notes}" | unitType=${t.unitType}`);
        }
    }

    // ── KONSOLIDASI SAFETY: apakah prefix broad ("Auto-generated") ≡ specific
    //    ("Auto-generated dari penjualan kasir") untuk data prod? Jika 0 record
    //    yg broad-tapi-bukan-specific → aman menyatukan 5 site specific ke broad.
    console.log("\n=== KONSOLIDASI SAFETY (broad vs specific prefix) ===");
    const broadOnly = await prisma.unitTransaction.findMany({
        where: { notes: { startsWith: "Auto-generated" } },
        select: { transactionNo: true, notes: true, unitType: true },
    });
    const broadNotSpecific = broadOnly.filter(
        (t) => !t.notes!.startsWith("Auto-generated dari penjualan kasir"),
    );
    console.log(`  notes startsWith "Auto-generated" (broad)              : ${rp(broadOnly.length)}`);
    console.log(`  └ di antaranya BUKAN "Auto-generated dari penjualan..." : ${rp(broadNotSpecific.length)}`);
    if (broadNotSpecific.length === 0) {
        console.log("  ✓ EKUIVALEN: broad ≡ specific untuk data prod → konsolidasi 6 site AMAN (behavior-preserving).");
    } else {
        console.log("  ⚠ TIDAK ekuivalen — broad menangkap record extra. Review sebelum konsolidasi:");
        for (const t of broadNotSpecific.slice(0, 10)) {
            console.log(`     ${t.transactionNo} | notes="${t.notes}" | unitType=${t.unitType}`);
        }
    }

    await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
