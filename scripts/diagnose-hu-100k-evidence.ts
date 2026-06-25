/**
 * READ-ONLY — evidence untuk 3 deposit "Setoran Tabungan Haji" @ Rp100k (5285/5288/5290)
 * vs 14 deposit test bermarker. Tujuan: tentukan apakah 100k itu test residue atau nyata.
 * Jalankan: npx tsx scripts/diagnose-hu-100k-evidence.ts
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const rupiah = (n: unknown) => "Rp " + Number(String(n)).toLocaleString("id-ID", { maximumFractionDigits: 0 });
const sep = "═".repeat(98);

async function main() {
    console.log(sep + "\n TIMELINE LENGKAP account 4336 — dengan creator & timestamp presisi\n" + sep);
    const txns = await prisma.savingsTransaction.findMany({
        where: { accountId: 4336 },
        orderBy: { id: "asc" },
        select: { id: true, transactionNo: true, type: true, amount: true, status: true, notes: true, balanceBefore: true, balanceAfter: true, paymentMethod: true, cashBankAccountId: true, createdById: true, createdAt: true, transactionDate: true },
    });

    // Cache creator users
    const creatorIds = [...new Set(txns.map((t) => t.createdById))];
    const users = await prisma.user.findMany({ where: { id: { in: creatorIds } }, select: { id: true, name: true, email: true, unitType: true } });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const isTest = (t: (typeof txns)[number]) => {
        const n = (t.notes || "").toLowerCase();
        return n.includes("e2e") || n.includes("test setoran") || n.includes("playwright") || (t.transactionNo || "").startsWith("BH-");
    };

    for (const t of txns) {
        const u = userMap.get(t.createdById);
        const tag = isTest(t) ? "🔴TEST-MARKED" : t.notes === "Setoran Tabungan Haji" ? "🟡100k-GENERIC" : "❓OTHER";
        console.log(
            `  id=${t.id}  ${t.transactionNo}\n` +
                `     ${t.type} ${rupiah(t.amount)}  ${t.status}  bal ${rupiah(t.balanceBefore)} → ${rupiah(t.balanceAfter)}  ` +
                `pay=${t.paymentMethod || "-"}  cbAcct=${t.cashBankAccountId}\n` +
                `     created=${t.createdAt.toISOString()}  by userId=${t.createdById} (${u?.email || "?"} / ${u?.unitType || "?"})  ` +
                `tDate=${t.transactionDate.toISOString().slice(0, 10)}\n` +
                `     notes="${t.notes}"  ${tag}`
        );
    }

    console.log("\n" + sep + "\n CREATOR SUMMARY\n" + sep);
    for (const uid of creatorIds) {
        const u = userMap.get(uid);
        const theirs = txns.filter((t) => t.createdById === uid);
        const testCnt = theirs.filter(isTest).length;
        const generic100k = theirs.filter((t) => t.notes === "Setoran Tabungan Haji").length;
        console.log(`  userId=${uid} ${u?.email} (${u?.name}, unitType=${u?.unitType}): total ${theirs.length} txn | test-marked=${testCnt} | generic-100k=${generic100k}`);
    }

    console.log("\n" + sep + "\n DETAIL CB TXNS untuk 3 deposit generic 100k (5285/5288/5290)\n" + sep);
    for (const tid of [5285, 5288, 5290]) {
        const cbs = await prisma.cashBankTransaction.findMany({
            where: { referenceType: { contains: "savings", mode: "insensitive" }, referenceId: tid },
            select: { id: true, transactionNo: true, type: true, category: true, unitType: true, amount: true, accountId: true, description: true, createdById: true, createdAt: true },
        });
        console.log(`  SavingsTxn ${tid}:`);
        for (const c of cbs) {
            console.log(`     CB id=${c.id} ${c.transactionNo}  ${c.type} cat=${c.category} unitType=${c.unitType}  ${rupiah(c.amount)}  cbAcct=${c.accountId}  by=${c.createdById}  desc="${c.description}"`);
        }
    }

    console.log("\n" + sep + "\n KONTEKS: deposit test-marked pertama & terakhir (timing window)\n" + sep);
    const testTxns = txns.filter(isTest);
    if (testTxns.length) {
        const min = testTxns.reduce((a, b) => (a.createdAt < b.createdAt ? a : b));
        const max = testTxns.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
        console.log(`  Test-marked window: ${min.createdAt.toISOString()}  →  ${max.createdAt.toISOString()}`);
    }
    const g = txns.filter((t) => t.notes === "Setoran Tabungan Haji");
    if (g.length) {
        const min = g.reduce((a, b) => (a.createdAt < b.createdAt ? a : b));
        const max = g.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
        console.log(`  Generic-100k window: ${min.createdAt.toISOString()}  →  ${max.createdAt.toISOString()}`);
    }
    console.log("");
}
main().catch((e) => { console.error("❌", e); process.exit(1); }).finally(() => prisma.$disconnect());
