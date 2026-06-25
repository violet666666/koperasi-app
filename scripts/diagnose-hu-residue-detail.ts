/**
 * READ-ONLY detail probe — melengkapi diagnose-hu-test-residue.ts.
 * Menampilkan: (1) semua 20 txn account 4336, (2) semua 24 CB H&U,
 * (3) detail talangan voided + schedules/payments, (4) cek FK test products.
 * TIDAK ADA writes. Jalankan: npx tsx scripts/diagnose-hu-residue-detail.ts
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const rupiah = (n: unknown) => "Rp " + Number(String(n)).toLocaleString("id-ID", { maximumFractionDigits: 0 });
const sep = "═".repeat(78);

async function main() {
    const ACCT = 4336;

    // (1) Semua 20 txn account 4336
    console.log(sep + "\n[1] SEMUA TRANSAKSI ACCOUNT 4336 (HU-776-10-1715, member 776)\n" + sep);
    const txns = await prisma.savingsTransaction.findMany({
        where: { accountId: ACCT },
        orderBy: { id: "asc" },
        select: { id: true, transactionNo: true, type: true, amount: true, status: true, notes: true, transactionDate: true, createdAt: true },
    });
    for (const t of txns) {
        const n = (t.notes || "").toLowerCase();
        const isTest = n.includes("e2e") || n.includes("test setoran") || n.includes("playwright") || (t.transactionNo || "").startsWith("BH-");
        console.log(`  id=${t.id}  ${t.transactionNo}  ${t.type}  ${rupiah(t.amount)}  ${t.status}  ${isTest ? "🔴TEST" : "🟢REAL?"}  date=${t.transactionDate.toISOString().slice(0, 10)}  notes="${t.notes || ""}"`);
    }
    const completedDeposits = txns.filter((t) => t.type === "deposit" && t.status === "completed");
    const testCompletedDeposits = completedDeposits.filter((t) => { const n=(t.notes||"").toLowerCase(); return n.includes("e2e")||n.includes("test setoran")||n.includes("playwright"); });
    const sumTest = testCompletedDeposits.reduce((s, t) => s + Number(t.amount), 0);
    const sumAll = completedDeposits.reduce((s, t) => s + Number(t.amount), 0);
    const acct = await prisma.savingsAccount.findUnique({ where: { id: ACCT }, select: { balance: true } });
    console.log(`\n  Account balance sekarang      : ${rupiah(acct?.balance)}`);
    console.log(`  Sum deposit completed (semua)  : ${rupiah(sumAll)}`);
    console.log(`  Sum deposit TEST completed     : ${rupiah(sumTest)}  (${testCompletedDeposits.length} txn)`);
    console.log(`  Sum deposit NON-TEST completed : ${rupiah(sumAll - sumTest)}  (${completedDeposits.length - testCompletedDeposits.length} txn)`);
    console.log("");

    // (2) Semua 24 CB H&U
    console.log(sep + "\n[2] SEMUA CASH BANK TXNS unitType=haji_umrah (24)\n" + sep);
    const cbs = await prisma.cashBankTransaction.findMany({
        where: { unitType: "haji_umrah" },
        orderBy: { id: "asc" },
        select: { id: true, transactionNo: true, type: true, category: true, amount: true, description: true, referenceType: true, referenceId: true, transactionDate: true },
    });
    for (const c of cbs) {
        console.log(`  id=${c.id}  ${c.transactionNo}  ${c.type}  cat=${c.category}  ${rupiah(c.amount)}  ref=${c.referenceType}:${c.referenceId ?? "-"}  desc="${c.description || ""}"`);
    }
    console.log("");

    // (3) Talangan voided
    console.log(sep + "\n[3] TALANGAN app=3452 / loan=PJM-2026-9304\n" + sep);
    const loan = await prisma.loan.findFirst({
        where: { loanNo: "PJM-2026-9304" },
        include: { _count: { select: { schedules: true, payments: true } }, application: { select: { id: true, applicationNo: true, status: true, notes: true } } },
    });
    if (loan) {
        console.log(`  loan id=${loan.id} ${loan.loanNo} status=${loan.status} principal=${rupiah(loan.principalAmount)} disbursedCB=${loan.disbursementCashBankId} schedules=${loan._count.schedules} payments=${loan._count.payments}`);
        console.log(`  application id=${loan.application.id} ${loan.application.applicationNo} status=${loan.application.status} notes="${loan.application.notes}"`);
    }
    const talanganCb = await prisma.cashBankTransaction.findMany({
        where: { OR: [{ description: { contains: "9304", mode: "insensitive" } }, { description: { contains: "talangan", mode: "insensitive" } }, { description: { contains: "TAL-2026-203056938", mode: "insensitive" } }] },
        select: { id: true, transactionNo: true, type: true, amount: true, description: true },
    });
    console.log("  CB txns terkait talangan (search desc):");
    for (const c of talanganCb) console.log(`    id=${c.id}  ${c.transactionNo}  ${c.type}  ${rupiah(c.amount)}  desc="${c.description}"`);
    console.log("");

    // (4) Test products FK check
    console.log(sep + "\n[4] TEST PRODUCTS — cek apakah punya accounts/txns\n" + sep);
    for (const pid of [12, 13, 14, 15]) {
        const ac = await prisma.savingsAccount.count({ where: { productId: pid } });
        const tc = await prisma.savingsTransaction.count({ where: { productId: pid } });
        const p = await prisma.savingsProduct.findUnique({ where: { id: pid }, select: { code: true } });
        console.log(`  product id=${pid} (${p?.code}): accounts=${ac}, transactions=${tc}`);
    }
    console.log("");

    // (5) Reference id linkage: CB txns yang referenceId menunjuk ke test savings txn
    console.log(sep + "\n[5] CB TXNS dengan referenceType menunjuk SavingsTransaction test\n" + sep);
    const testTxnIds = txns.filter((t) => { const n=(t.notes||"").toLowerCase(); return n.includes("e2e")||n.includes("test setoran")||n.includes("playwright")||(t.transactionNo||"").startsWith("BH-"); }).map((t) => t.id);
    const linkedCb = await prisma.cashBankTransaction.findMany({
        where: { referenceType: { contains: "savings", mode: "insensitive" }, referenceId: { in: testTxnIds } },
        select: { id: true, transactionNo: true, type: true, amount: true, referenceId: true, description: true },
    });
    console.log(`  CB txns linked via referenceId ke ${testTxnIds.length} test savings txn: ${linkedCb.length} rows`);
    for (const c of linkedCb.slice(0, 40)) console.log(`    id=${c.id}  ${c.transactionNo}  ${c.type}  ${rupiah(c.amount)}  refId=${c.referenceId}  desc="${c.description || ""}"`);
    if (linkedCb.length > 40) console.log(`    ... (${linkedCb.length - 40} more)`);
    console.log("");
}
main().catch((e) => { console.error("❌", e); process.exit(1); }).finally(() => prisma.$disconnect());
