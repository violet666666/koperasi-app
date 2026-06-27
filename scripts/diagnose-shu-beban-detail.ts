/**
 * Diagnostic mendalam: struktur BEBAN BIAYA SHU + 10 anggota aktif.
 * Memanggil calculateSystemSHU() (kode kanonik aplikasi) + query tambahan
 * untuk merinci beban per bulan, per kategori, dan contoh transaksi.
 *
 * Usage:
 *   NODE_ENV=production npx tsx --env-file=.env scripts/diagnose-shu-beban-detail.ts [year] [memberCount]
 */
import { calculateSystemSHU } from "../src/lib/services/shu-calculator";
import prisma from "../src/lib/prisma";

// HARUS identik dengan NON_EXPENSE_CATEGORIES di src/lib/services/shu-calculator.ts
const NON_EXPENSE_CATEGORIES = [
    "pencairan_pinjaman", "transfer", "savings",
    "simpanan_pokok", "simpanan_wajib", "simpanan_sukarela",
    "angsuran_pokok", "void_penjualan_toko", "void_unit_transaction",
    "pendapatan_unit", "jasa_pinjaman", "penalti_pelunasan", "dana_resiko",
    "lainnya",
];

const rp = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");
const toNum = (d: any): number => (d === null || d === undefined ? 0 : typeof d === "number" ? d : Number(d));

async function main() {
    const year = Number(process.argv[2] || 2026);
    const memberCount = Number(process.argv[3] || 10);
    const startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    console.log(`\n# BEBAN BIAYA SHU — ${year}\n`);
    const shu = await calculateSystemSHU(year);

    console.log("## RINGKASAN");
    console.log(`- Total Pendapatan : ${rp(shu.totalIncome)}`);
    console.log(`- Total Beban     : ${rp(shu.totalExpense)}`);
    console.log(`- SHU Bersih      : ${rp(shu.netSurplus)}`);
    console.log(`- Anggota Aktif   : ${shu.memberCount}\n`);

    // ── Beban per kategori (dengan jumlah transaksi) ──
    console.log("## BEBAN PER KATEGORI (dengan jumlah transaksi)");
    const catBreakdown = await prisma.cashBankTransaction.groupBy({
        by: ["category"],
        where: {
            transactionDate: { gte: startDate, lte: endDate },
            type: "out",
            journalId: null,
            category: { notIn: NON_EXPENSE_CATEGORIES },
        },
        _sum: { amount: true },
        _count: true,
    });
    catBreakdown
        .sort((a, b) => toNum(b._sum.amount) - toNum(a._sum.amount))
        .forEach((c) => {
            console.log(`  ${String(c.category || "(null)").padEnd(22)} ${c._count.toString().padStart(5)} tx  ${rp(toNum(c._sum.amount)).padStart(20)}`);
        });

    // ── Beban per bulan ──
    console.log("\n## BEBAN PER BULAN");
    const allExpTx = await prisma.cashBankTransaction.findMany({
        where: {
            transactionDate: { gte: startDate, lte: endDate },
            type: "out",
            journalId: null,
            category: { notIn: NON_EXPENSE_CATEGORIES },
        },
        select: { transactionDate: true, amount: true, category: true },
    });
    const monthMap = new Map<string, number>();
    allExpTx.forEach((t) => {
        const m = t.transactionDate.toISOString().slice(0, 7);
        monthMap.set(m, (monthMap.get(m) || 0) + toNum(t.amount));
    });
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    Array.from(monthMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([m, amt]) => {
            const label = `${monthNames[parseInt(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
            console.log(`  ${label.padEnd(10)} ${rp(amt).padStart(20)}`);
        });

    // ── 10 transaksi beban terbesar (contoh konkret) ──
    console.log("\n## TOP 10 TRANSAKSI BEBAN TERBESAR (contoh konkret)");
    const topTx = await prisma.cashBankTransaction.findMany({
        where: {
            transactionDate: { gte: startDate, lte: endDate },
            type: "out",
            journalId: null,
            category: { notIn: NON_EXPENSE_CATEGORIES },
        },
        select: { transactionDate: true, amount: true, category: true, description: true, unitType: true },
        orderBy: { amount: "desc" },
        take: 10,
    });
    topTx.forEach((t, i) => {
        const d = t.transactionDate.toISOString().slice(0, 10);
        const desc = (t.description || "").slice(0, 60);
        console.log(`  ${String(i + 1).padStart(2)}. ${d} | ${rp(toNum(t.amount)).padStart(16)} | ${(t.category || "-").padEnd(18)} | ${desc}`);
    });

    // ── Beban per unit ──
    console.log("\n## BEBAN PER UNIT");
    const byUnit = await prisma.cashBankTransaction.groupBy({
        by: ["unitType"],
        where: {
            transactionDate: { gte: startDate, lte: endDate },
            type: "out",
            journalId: null,
            category: { notIn: NON_EXPENSE_CATEGORIES },
        },
        _sum: { amount: true },
        _count: true,
    });
    byUnit
        .sort((a, b) => toNum(b._sum.amount) - toNum(a._sum.amount))
        .forEach((u) => {
            console.log(`  ${String(u.unitType || "(tidak dialokasi/umum)").padEnd(28)} ${u._count.toString().padStart(5)} tx  ${rp(toNum(u._sum.amount)).padStart(20)}`);
        });

    // ── Top N anggota ──
    console.log(`\n## TOP ${memberCount} ANGGOTA AKTIF (SHU terbesar)`);
    const top = shu.memberDistribution.filter((m) => m.shuAmount > 0).slice(0, memberCount);
    console.log("rank|nama|memberNo|simpananPokok|simpananWajib|jasaModal|kontribusiUsaha|jasaUsaha|cuciMobil(tx)|totalSHU");
    top.forEach((m, i) => {
        console.log(`${i + 1}|${m.name}|${m.memberNo}|${Math.round(m.simpananPokok)}|${Math.round(m.simpananWajib)}|${Math.round(m.modalPortion)}|${Math.round(m.loanContribution)}|${Math.round(m.usahaPortion)}|${m.carwashCount}|${Math.round(m.shuAmount)}`);
    });

    await prisma.$disconnect();
}

main().catch((e) => { console.error("ERROR:", e); process.exit(1); });
