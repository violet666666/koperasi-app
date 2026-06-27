/**
 * Diagnostic: Menjawab pertanyaan atasan — "apa saja beban biaya yang masuk
 * ke perhitungan SHU?" — dengan contoh 5 anggota aktif dari data PRODUKSI.
 *
 * Memanggil `calculateSystemSHU()` (kode kanonik yang DIPAKAI aplikasi),
 * jadi angka di sini 100% identik dengan Laporan SHU di /laporan/shu.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/diagnose-shu-beban-biaya.ts [year] [memberCount]
 *   npx tsx --env-file=.env scripts/diagnose-shu-beban-biaya.ts 2026 5
 */
import { calculateSystemSHU } from "../src/lib/services/shu-calculator";
import prisma from "../src/lib/prisma";

const rp = (n: number) =>
    "Rp " + Math.round(n).toLocaleString("id-ID");

async function main() {
    const year = Number(process.argv[2] || 2026);
    const memberCount = Number(process.argv[3] || 5);

    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL tidak ditemukan. Coba: npx tsx --env-file=.env scripts/diagnose-shu-beban-biaya.ts");
    }
    try {
        console.log("DB host:", new URL(process.env.DATABASE_URL).host);
    } catch {
        /* ignore */
    }

    console.log(`\nMenghitung SHU untuk periode: Tahun ${year} ...\n`);
    const shu = await calculateSystemSHU(year);

    // ─────────────────────────────────────────────────────────────
    // BAGIAN 1 — STRUKTUR BEBAN BIAYA KOPERASI (yang mengurangi SHU)
    // ─────────────────────────────────────────────────────────────
    console.log("═".repeat(78));
    console.log(` RINGKASAN SHU KOPERASI — ${shu.periodLabel}`);
    console.log("═".repeat(78));
    console.log(` Total Pendapatan (Income)  : ${rp(shu.totalIncome)}`);
    console.log(` Total Beban (Expense)      : ${rp(shu.totalExpense)}`);
    console.log(` SHU Bersih (Net Surplus)   : ${rp(shu.netSurplus)}`);
    console.log(`   ├─ Rasio Anggota   (${(shu.memberRatio * 100).toFixed(1)}%) : ${rp(shu.memberSurplus)}`);
    console.log(`   └─ Rasio Non-Anggota (${(shu.nonMemberRatio * 100).toFixed(1)}%) : ${rp(shu.nonMemberSurplus)}`);
    console.log(` Jumlah Anggota Aktif       : ${shu.memberCount}`);
    console.log("");

    console.log("─".repeat(78));
    console.log(" BEBAN BIAYA (EXPENSE) YANG MASUK SHU — per kelompok");
    console.log("─".repeat(78));
    for (const g of shu.expenseGroups) {
        if (g.amount === 0 && g.details.length === 0) continue;
        console.log(`\n ■ ${g.label}  →  ${rp(g.amount)}`);
        g.details
            .slice()
            .sort((a, b) => b.amount - a.amount)
            .forEach((d) => {
                const pct = g.amount > 0 ? ((d.amount / g.amount) * 100).toFixed(1) : "0.0";
                console.log(`     • [${d.code}] ${d.name.padEnd(42)} ${rp(d.amount).padStart(18)}  (${pct}%)`);
            });
    }

    console.log("\n" + "-".repeat(78));
    console.log(" KATEGORI PENGELUARAN YANG DIKECUALIKAN (tidak masuk SHU)");
    console.log("-".repeat(78));
    console.log("  pencairan_pinjaman, transfer, savings, simpanan_pokok/wajib/sukarela,");
    console.log("  angsuran_pokok, void_penjualan_toko, void_unit_transaction, pendapatan_unit,");
    console.log("  jasa_pinjaman, penalti_pelunasan, dana_resiko, LAINnya (non-operasional)");
    console.log("  → kategori di atas TIDAK mengurangi SHU (bukan beban riil / dobel-hit)");

    // ─────────────────────────────────────────────────────────────
    // BAGIAN 2 — CONTOH 5 ANGGOTA AKTIF
    // ─────────────────────────────────────────────────────────────
    console.log("\n" + "═".repeat(78));
    console.log(` CONTOH ${memberCount} ANGGOTA AKTIF (SHU TERBESAR)`);
    console.log("═".repeat(78));

    const top = shu.memberDistribution
        .filter((m) => m.shuAmount > 0)
        .slice(0, memberCount);

    // Ambil detail kontribusi usaha per anggota (belanja toko / jasa unit / bunga)
    const memberIds = top.map((m) => m.id);
    const detail = await prisma.member.findMany({
        where: { id: { in: memberIds } },
        select: {
            memberNo: true,
            nrp: true,
            savingsAccounts: {
                where: { status: "active" },
                select: { balance: true, product: { select: { type: true } } },
            },
        },
    });
    const detailMap = new Map(detail.map((d) => [d.id, d]));

    top.forEach((m, i) => {
        const d = detailMap.get(m.id);
        const pokok = d?.savingsAccounts
            .filter((sa) => sa.product.type === "pokok")
            .reduce((s, sa) => s + Number(sa.balance || 0), 0) ?? m.simpananPokok;

        console.log(`\n┌─ #${i + 1}  ${m.name}`);
        console.log(`│  No. Anggota : ${m.memberNo}${d?.nrp ? `   (NRP: ${d.nrp})` : ""}`);
        console.log(`├──────────────────────────────────────────────────────────────────`);
        console.log(`│  A. SIMPANAN (dasar Jasa Modal)`);
        console.log(`│     • Simpanan Pokok            : ${rp(pokok)}`);
        console.log(`│     • Simpanan Wajib            : ${rp(m.simpananWajib)}`);
        console.log(`│     • Total Modal               : ${rp(m.savingsContribution)}`);
        console.log(`│       → Jasa Modal diterima     : ${rp(m.modalPortion)}`);
        console.log(`│  B. KONTRIBUSI USAHA (dasar Jasa Usaha)`);
        console.log(`│     • Total kontribusi usaha    : ${rp(m.loanContribution)}`);
        console.log(`│       → Jasa Usaha diterima     : ${rp(m.usahaPortion)}`);
        console.log(`│  C. SHU CUCI MOBIL (Rp 2.000/transaksi)`);
        console.log(`│     • ${m.carwashCount} transaksi × Rp 2.000      : ${rp(m.carwashBonus)}`);
        console.log(`├──────────────────────────────────────────────────────────────────`);
        console.log(`│  ★ TOTAL SHU ${shu.periodLabel}        : ${rp(m.shuAmount)}`);
        console.log(`└──────────────────────────────────────────────────────────────────`);
    });

    // Penjelasan alur beban → distribusi anggota
    console.log("\n" + "═".repeat(78));
    console.log(" BAGAIMANA BEBAN BIAYA MEMPENGARUHI SHU PER-ANGGOTA");
    console.log("═".repeat(78));
    console.log(`
 1. Beban biaya koperasi (Bagian 1) mengurangi Total Pendapatan
    → SHU Bersih = Pendapatan − Beban = ${rp(shu.netSurplus)}

 2. SHU Bersih dibagi: Anggota ${(shu.memberRatio * 100).toFixed(1)}% : Non-Anggota ${(shu.nonMemberRatio * 100).toFixed(1)}%
    → Bagian Anggota = ${rp(shu.memberSurplus)}

 3. Bagian Anggota dialokasikan per AD/ART:
    • Jasa Simpanan (Modal) pool = ${rp(shu.jasaModalPool)}  → dibagi proporsional SIMPANAN
    • Jasa Anggota (Usaha)  pool = ${rp(shu.jasaUsahaPool)}  → dibagi proporsional KONTRIBUSI USAHA
    • SHU Cuci Mobil                = ${rp(shu.totalCarwashBonus)}  → langsung Rp 2.000/transaksi/anggota

 4. Karena beban biaya adalah KOLEKTIF (mengurangi pool di tingkat koperasi),
    setiap anggota tidak punya baris "beban" sendiri. Beban memperkecil POOL,
    lalu porsi tiap anggota dihitung dari rasio simpanan & kontribusi usahanya.
`);

    await prisma.$disconnect();
}

main().catch((e) => {
    console.error("ERROR:", e);
    process.exit(1);
});
