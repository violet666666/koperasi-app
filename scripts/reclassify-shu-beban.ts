/**
 * REKLASSIFIKASI 5 transaksi CashBankTransaction yang salah kategori → memperbaiki
 * SHU Bersih 2026 dari Rp 0 (karena beban menggelembung Rp 620jt) ke ~Rp +59jt.
 *
 * Investigasi (scripts/investigate-shu-reclassify.ts) MEMBUKTIKAN:
 *  - 5351 "ambil kas bri" Rp 500jt + 5352 "masuk kas bank jatim" Rp 500jt → TRANSFER (BRI→JATIM)
 *  - 7438 "ambil tunai" Rp 100jt + 7437 "tarik tunai" Rp 100jt → TRANSFER (JATIM→Kas)
 *  - 5346 "pinjam SP ZULFAN WASIS" Rp 20jt → PENCAIRAN PINJAMAN (ada Loan id=3130)
 *
 * HANYA mengubah field `category`. Saldo/balance/journal TIDAK diubah (gerak dana RIIL,
 * hanya label kategori yang salah). 3 transaksi OUT (5351/7438/5346) yg memperbaiki SHU;
 * 2 transaksi IN (5352/7437) direklass untuk konsistensi data (sudah diexclude dari income).
 *
 * Usage:
 *   npx tsx scripts/reclassify-shu-beban.ts            # DRY-RUN (default, no writes)
 *   npx tsx scripts/reclassify-shu-beban.ts --apply     # APPLY (backup CSV + 1 transaction)
 */
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "fs";

const prisma = new PrismaClient({ log: ["error"] });
const APPLY = process.argv.includes("--apply");
const rp = (n: any) => "Rp " + Math.round(Number(String(n))).toLocaleString("id-ID");

// Expected state per ID — script ABORT jika ada yang tidak cocok (anti-salah-target)
type Spec = { id: number; mustCat: string; mustAmount: number; mustDesc: string; newCat: string; note: string };
const SPECS: Spec[] = [
    { id: 5351, mustCat: "biaya_operasional", mustAmount: 500_000_000, mustDesc: "ambil kas bri", newCat: "transfer", note: "TRANSFER BRI→JATIM (fixes SHU beban)" },
    { id: 5352, mustCat: "biaya_operasional", mustAmount: 500_000_000, mustDesc: "masuk kas bank jatim", newCat: "transfer", note: "Counterpart transfer (konsistensi)" },
    { id: 7438, mustCat: "biaya_operasional", mustAmount: 100_000_000, mustDesc: "ambil tunai", newCat: "transfer", note: "TRANSFER JATIM→Kas (fixes SHU beban)" },
    { id: 7437, mustCat: "biaya_operasional", mustAmount: 100_000_000, mustDesc: "tarik tunai", newCat: "transfer", note: "Counterpart transfer (konsistensi)" },
    { id: 5346, mustCat: "biaya_operasional", mustAmount: 20_000_000, mustDesc: "pinjam SP ZULFAN", newCat: "pencairan_pinjaman", note: "PENCAIRAN PINJAMAN (fixes SHU beban)" },
];

async function main() {
    const url = process.env.DATABASE_URL || "";
    if (!url.includes("neon.tech")) {
        console.error("ABORT: DATABASE_URL bukan host neon.tech. Tidak akan run.");
        process.exit(1);
    }

    console.log("═".repeat(80));
    console.log(` REKLASSIFIKASI SHU BEBAN — MODE: ${APPLY ? "⚡ APPLY" : "🔍 DRY-RUN (no writes)"}`);
    console.log("═".repeat(80));
    console.log(" DB:", url.replace(/:[^:@]+@/, ":****@"), "\n");

    // ── GUARD: verifikasi setiap ID cocok expected state ──
    console.log(" GUARD — verifikasi state setiap transaksi:");
    const verified: Spec[] = [];
    for (const spec of SPECS) {
        const tx = await prisma.cashBankTransaction.findUnique({
            where: { id: spec.id },
            select: { id: true, category: true, amount: true, description: true, type: true },
        });
        if (!tx) {
            console.error(`  ❌ id=${spec.id} TIDAK DITEMUKAN — ABORT`);
            process.exit(1);
        }
        const amt = Number(tx.amount);
        const catOk = tx.category === spec.mustCat;
        const amtOk = amt === spec.mustAmount;
        const descOk = (tx.description || "").toLowerCase().includes(spec.mustDesc.toLowerCase());
        const ok = catOk && amtOk && descOk;
        console.log(`  ${ok ? "✅" : "❌"} id=${spec.id} cat=${tx.category} amt=${rp(amt)} desc="${(tx.description || "").slice(0, 30)}" | expect cat=${spec.mustCat} amt=${rp(spec.mustAmount)} → ${spec.newCat}`);
        if (!ok) {
            console.error(`     MISMATCH — ABORT. Transaksi ini sudah berubah? Jangan dipaksakan.`);
            process.exit(1);
        }
        verified.push(spec);
    }

    // ── BACKUP CSV (selalu, bahkan dry-run untuk transparansi) ──
    const all = await prisma.cashBankTransaction.findMany({
        where: { id: { in: verified.map((s) => s.id) } },
    });
    const header = "id,transactionNo,date,type,category_old,amount,description,balanceBefore,balanceAfter,accountId";
    const lines = all.map((t) =>
        [t.id, t.transactionNo, t.transactionDate.toISOString().slice(0, 10), t.type, t.category, t.amount, `"${(t.description || "").replace(/"/g, '""')}"`, t.balanceBefore, t.balanceAfter, t.accountId].join(",")
    );
    const csv = [header, ...lines].join("\n");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const backupPath = `backup-shu-reclassify-${stamp}.csv`;
    if (APPLY) {
        writeFileSync(backupPath, csv);
        console.log(`\n 💾 Backup CSV tertulis: ${backupPath} (${all.length} rows)`);
    } else {
        console.log(`\n 💾 Backup CSV AKAN ditulis ke: ${backupPath} (saat --apply)`);
    }

    // ── RINGKASAN perubahan ──
    console.log(`\n Perubahan kategori (${verified.length} transaksi):`);
    verified.forEach((s) => console.log(`   id=${s.id}  ${s.mustCat} → ${s.newCat}  | ${rp(s.mustAmount).padStart(18)} | ${s.note}`));

    if (!APPLY) {
        console.log("\n 🔍 DRY-RUN selesai. Tidak ada perubahan. Jalankan dengan --apply untuk eksekusi.");
        await prisma.$disconnect();
        return;
    }

    // ── APPLY: 1 transaction ──
    console.log("\n ⚡ APPLY — mengubah dalam satu $transaction...");
    const result = await prisma.$transaction(
        verified.map((s) =>
            prisma.cashBankTransaction.update({
                where: { id: s.id },
                data: { category: s.newCat },
                select: { id: true, category: true },
            })
        )
    );
    console.log(` ✅ ${result.length} transaksi diubah.`);

    // ── VERIFY: re-read & assert ──
    console.log("\n VERIFY — re-read setiap transaksi:");
    for (const s of verified) {
        const t = await prisma.cashBankTransaction.findUnique({ where: { id: s.id }, select: { category: true } });
        const ok = t?.category === s.newCat;
        console.log(`  ${ok ? "✅" : "❌"} id=${s.id} category=${t?.category} (expect ${s.newCat})`);
        if (!ok) { console.error("     VERIFICATION FAILED — ABORT tanpa rollback otomatis. Cek backup CSV."); process.exit(1); }
    }

    console.log("\n ✅ Semua verifikasi lulus. Jalankan scripts/diagnose-shu-beban-detail.ts untuk konfirmasi SHU baru.");
    await prisma.$disconnect();
}

main().catch((e) => { console.error("ERROR:", e); process.exit(1); });
