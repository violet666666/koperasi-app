/**
 * DIAGNOSTIC (read-only): Ukur DOUBLE COUNT totalIncome SHU yang sebenarnya —
 * irisan penjualan yang tercatat BERSAMAAN di (a) JournalLine akun income
 * (4201 dsb.) DAN (b) CB type=in journalId=null kategori pendapatan_toko /
 * pendapatan_unit. Kedua deskripsi memuat ref transaksi (saleNo / trxNo),
 * jadi irisan direfleksikan via ref.
 *
 * Usage: NODE_ENV=production npx tsx --env-file=.env scripts/diagnose-shu-journal-cb-doublecount.ts
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const toNum = (d: any) => (d === null || d === undefined ? 0 : typeof d === "number" ? d : Number(d));
const rp = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");

// Ref = token terakhir setelah " - " pada deskripsi jurnal/CB (saleNo TK-…, trxNo UL-…, dll.)
// Sama dengan src/lib/shu-ref-helpers.ts (termasuk strip suffix [SB-groupId] split-bill)
import { extractTrailingRef as extractRef } from "../src/lib/shu-ref-helpers";

async function main() {
    const year = 2026;
    const startDate = new Date(Date.UTC(year, 0, 1));
    const endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    // (a) Journal income lines + ref dari description journal
    const journalLines = await prisma.journalLine.findMany({
        where: {
            journal: { transactionDate: { gte: startDate, lte: endDate }, isPosted: true },
            account: { type: "income" },
        },
        select: { debit: true, credit: true, journal: { select: { description: true } } },
    });
    const journalByRef = new Map<string, number>(); // ref → credit-debit
    let journalNoRef = 0;
    for (const l of journalLines) {
        const amount = toNum(l.credit) - toNum(l.debit);
        const ref = extractRef(l.journal.description);
        if (!ref) { journalNoRef += amount; continue; }
        journalByRef.set(ref, (journalByRef.get(ref) || 0) + amount);
    }

    // (b) CB non-journaled pendapatan_toko/pendapatan_unit + ref dari description
    const cbRows = await prisma.cashBankTransaction.findMany({
        where: {
            transactionDate: { gte: startDate, lte: endDate },
            type: "in",
            journalId: null,
            category: { in: ["pendapatan_toko", "pendapatan_unit"] },
        },
        select: { category: true, amount: true, description: true },
    });
    let cbBoth = 0, cbOnly = 0, cbNoRef = 0;
    const bothByCat: Record<string, number> = {};
    const bothRefs: string[] = [];
    const cbByRef = new Map<string, { amount: number; category: string }>();
    for (const t of cbRows) {
        const ref = extractRef(t.description);
        const amt = toNum(t.amount);
        if (!ref) { cbNoRef += amt; continue; }
        cbByRef.set(ref, { amount: amt, category: t.category || "?" });
    }
    for (const [ref, info] of cbByRef) {
        if (journalByRef.has(ref)) {
            cbBoth += info.amount;
            bothByCat[info.category] = (bothByCat[info.category] || 0) + info.amount;
            if (bothRefs.length < 10) bothRefs.push(ref);
        } else {
            cbOnly += info.amount;
        }
    }
    const journalOnly = [...journalByRef.entries()].filter(([r]) => !cbByRef.has(r)).reduce((s, [, v]) => s + v, 0);

    console.log("=".repeat(80));
    console.log(`DOUBLE COUNT SHU ${year} — irisan ref journal-income vs CB pendapatan_toko/unit`);
    console.log("=".repeat(80));
    console.log(`Journal income lines total          : ${rp([...journalByRef.values()].reduce((a, b) => a + b, 0) + journalNoRef)}`);
    console.log(`  - baris journal TANPA ref di desc : ${rp(journalNoRef)}`);
    console.log(`CB pendapatan_toko/unit (jId=null)  : ${rp(cbBoth + cbOnly + cbNoRef)}`);
    console.log(`  - CB TANPA ref di desc            : ${rp(cbNoRef)}`);
    console.log("");
    console.log(`>>> DOBEL (CB yang ref-nya ADA di journal): ${rp(cbBoth)}`);
    for (const [c, v] of Object.entries(bothByCat)) console.log(`    ${c}: ${rp(v)}`);
    console.log(`>>> CB-only (pendapatan belum dijurnal)   : ${rp(cbOnly)}`);
    console.log(`>>> Journal-only (mis. salary_cut)        : ${rp(journalOnly)}`);
    console.log(`\nContoh ref dobel: ${bothRefs.join(", ")}`);
    console.log(`\nSanity: totalIncome kalkulator berkurang sebesar DOBEL bila CB irisan dikecualikan.`);
}
main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
