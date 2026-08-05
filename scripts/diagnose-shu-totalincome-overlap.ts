/**
 * DIAGNOSTIK (follow-up): Apakah TOTAL PENDAPATAN (summary card) juga dobel?
 * ------------------------------------------------------------------
 * Kalkulator JOURNAL PATH: totalIncome = (a) JournalLine income accounts
 * + (b) CB type=in non-journaled (jId=null) + (c) Dana Resiko.
 *
 * Pertanyaan: apakah akun 4201 (Pendapatan Toko/Unit) ber-type "income"?
 * Jika YA, dan CB pendapatan_toko/pendapatan_unit juga dihitung di (b),
 * maka penjualan yg sama terhitung 2× di totalIncome.
 *
 * Jalankan:
 *   NODE_ENV=production npx tsx --env-file=.env scripts/diagnose-shu-totalincome-overlap.ts
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const toNum = (d: any) => (d === null || d === undefined ? 0 : typeof d === "number" ? d : Number(d));
const rp = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");

async function main() {
    const year = 2026;
    const startDate = new Date(Date.UTC(year, 0, 1));
    const endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
    console.log("=".repeat(80));
    console.log(`DIAGNOSTIK: Overlap TOTAL INCOME — Laporan SHU ${year}`);
    console.log("=".repeat(80) + "\n");

    // 1. Tipe akun 4201 (dan income accounts lainnya)
    const acc4201 = await prisma.account.findFirst({ where: { code: "4201" }, select: { code: true, name: true, type: true } });
    console.log(`[1] Akun 4201: name="${acc4201?.name}" type="${acc4201?.type}"`);
    console.log(`    → masuk loop journal income (line.account.type === "income")? ${acc4201?.type === "income" ? "YA ⚠️" : "TIDAK"}\n`);

    // 2. Komponen (a): JournalLine income accounts (mimik kalkulator baris 183-200, skip 43-45)
    const journalIncomeLines = await prisma.journalLine.findMany({
        where: { journal: { transactionDate: { gte: startDate, lte: endDate }, isPosted: true }, account: { type: "income" } },
        include: { account: { select: { code: true, name: true, type: true } } },
    });
    let journalIncomeTotal = 0;
    const byCode: Record<string, { name: string; amount: number }> = {};
    for (const l of journalIncomeLines) {
        const code = l.account.code || "";
        if (code.startsWith("43") || code.startsWith("44") || code.startsWith("45")) continue;
        const amt = toNum(l.credit) - toNum(l.debit);
        journalIncomeTotal += amt;
        if (!byCode[code]) byCode[code] = { name: l.account.name, amount: 0 };
        byCode[code].amount += amt;
    }
    console.log(`[2] (a) JournalLine income (type=income, excl 43-45): ${rp(journalIncomeTotal)}`);
    console.log("    Per akun:");
    for (const [code, v] of Object.entries(byCode).sort((a, b) => b[1].amount - a[1].amount)) {
        console.log(`       ${code.padEnd(8)} ${v.name.slice(0, 35).padEnd(36)} ${rp(v.amount)}`);
    }
    console.log("");

    // 3. Komponen (b): CB type=in non-journaled (mimik kalkulator baris 227-262, notIn NON_INCOME)
    const NON_INCOME = ["savings","simpanan_pokok","simpanan_wajib","simpanan_sukarela","setoran_simpanan","transfer","pencairan_pinjaman","angsuran_pokok","loan","lainnya","biaya_operasional"];
    const cbIncome = await prisma.cashBankTransaction.findMany({
        where: { transactionDate: { gte: startDate, lte: endDate }, type: "in", journalId: null, category: { notIn: NON_INCOME } },
        select: { amount: true, category: true },
    });
    const cbByCat: Record<string, number> = {};
    let cbIncomeTotal = 0;
    for (const c of cbIncome) {
        if (!c.category) continue;
        cbByCat[c.category] = (cbByCat[c.category] || 0) + toNum(c.amount);
        cbIncomeTotal += toNum(c.amount);
    }
    console.log(`[3] (b) CB income non-journaled (jId=null, notIn NON_INCOME): ${rp(cbIncomeTotal)}`);
    console.log("    Per kategori:");
    for (const [cat, amt] of Object.entries(cbByCat).sort((a, b) => b[1] - a[1])) {
        console.log(`       ${cat.padEnd(22)} ${rp(amt)}`);
    }
    console.log("");

    // 4. Komponen (c): Dana Resiko (Loan.adminFee)
    const dr = await prisma.loan.aggregate({
        where: { disbursementDate: { gte: startDate, lte: endDate }, status: { in: ["active", "paid_off"] } },
        _sum: { adminFee: true },
    });
    const danaResiko = toNum(dr._sum.adminFee);
    console.log(`[4] (c) Dana Resiko (Loan.adminFee): ${rp(danaResiko)}\n`);

    // 5. TOTAL per kalkulator & overlap
    const totalIncomeCalc = journalIncomeTotal + cbIncomeTotal + danaResiko;
    console.log("=".repeat(80));
    console.log(`[HASIL] totalIncome (per kalkulator) = (a) ${rp(journalIncomeTotal)} + (b) ${rp(cbIncomeTotal)} + (c) ${rp(danaResiko)}`);
    console.log(`         = ${rp(totalIncomeCalc)}`);
    console.log("");
    const income4201 = byCode["4201"]?.amount || 0;
    const cbPendapatanTokoUnit = (cbByCat["pendapatan_toko"] || 0) + (cbByCat["pendapatan_unit"] || 0);
    console.log(`[OVERLAP CHECK] Akun 4201 di journal: ${rp(income4201)}  |  CB pendapatan_toko+unit: ${rp(cbPendapatanTokoUnit)}`);
    if (acc4201?.type === "income" && income4201 > 0 && cbPendapatanTokoUnit > 0) {
        const overlap = Math.min(income4201, cbPendapatanTokoUnit);
        console.log(`  ⚠️  KEDUANYA terhitung di totalIncome. Penjualan toko/unit kemungkinan dobel ~${rp(overlap)}`);
        console.log(`  → "Total Pendapatan" card di summary juga INFLATED.`);
    } else {
        console.log(`  ✓ Tidak ada overlap di totalIncome (akun 4201 type="${acc4201?.type}" tidak masuk loop income, atau salah satu sumber 0).`);
    }
    console.log("=".repeat(80));

    await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
