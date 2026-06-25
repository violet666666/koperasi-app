/**
 * READ-ONLY — tutup 2 gap linkage untuk spec:
 *  (1) CB pair talangan loan 3438 (pencairan + reversal)
 *  (2) SETTLE CB 10799 + BillingItem haji_umrah
 * Plus identitas CashBankAccount 9 + konfirmasi loan 3438 tanpa payment.
 * Jalankan: npx tsx scripts/diagnose-hu-final-gaps.ts
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const rupiah = (n: unknown) => "Rp " + Number(String(n)).toLocaleString("id-ID", { maximumFractionDigits: 0 });
const sep = "═".repeat(90);

async function main() {
    // CashBankAccount 9
    console.log(sep + "\n[1] CASH BANK ACCOUNT 9 (target semua setoran H&U)\n" + sep);
    const acct9 = await prisma.cashBankAccount.findUnique({ where: { id: 9 }, select: { id: true, code: true, name: true, type: true, bankName: true, unitType: true, unitTypes: true, currentBalance: true, isActive: true } });
    console.log("  ", acct9);
    console.log("");

    // (a) Talangan loan 3438 CB pair
    console.log(sep + "\n[2] TALANGAN loan 3438 (PJM-2026-9304) — cari CB pair pencairan/reversal\n" + sep);
    const loan3438 = await prisma.loan.findUnique({
        where: { id: 3438 },
        include: { _count: { select: { schedules: true, payments: true } } },
    });
    console.log(`  loan: status=${loan3438?.status} disbursedCB acct=${loan3438?.disbursementCashBankId} schedules=${loan3438?._count.schedules} payments=${loan3438?._count.payments}`);
    // Precise: CB yang betul-betul menunjuk loan 3438 / talangan ini
    const talanganCb = await prisma.cashBankTransaction.findMany({
        where: {
            OR: [
                { referenceType: { contains: "loan", mode: "insensitive" }, referenceId: 3438 },
                { transactionNo: { contains: "9304", mode: "insensitive" } },
                { transactionNo: { contains: "TAL-2026-203056938", mode: "insensitive" } },
                { description: { contains: "PJM-2026-9304", mode: "insensitive" } },
                { description: { contains: "TAL-2026-203056938", mode: "insensitive" } },
            ],
        },
        select: { id: true, transactionNo: true, type: true, category: true, unitType: true, amount: true, accountId: true, referenceType: true, referenceId: true, description: true },
        orderBy: { id: "asc" },
    });
    console.log(`  CB yang menunjuk loan 3438 / talangan (${talanganCb.length}):`);
    for (const c of talanganCb) console.log(`    id=${c.id}  ${c.transactionNo}  ${c.type} cat=${c.category} unit=${c.unitType}  ${rupiah(c.amount)}  acct=${c.accountId}  ref=${c.referenceType}:${c.referenceId ?? "-"}  desc="${c.description}"`);
    if (talanganCb.length === 0) console.log("    → Tidak ada CB menunjuk loan 3438. Talangan apply route mungkin tak membuat CB diskursus (sudah void bersih).");
    console.log("");

    // (b) SETTLE CB 10799 + BillingItem haji_umrah
    console.log(sep + "\n[3] SETTLE CB 10799 + BillingItem unitType=haji_umrah\n" + sep);
    const settle = await prisma.cashBankTransaction.findUnique({ where: { id: 10799 }, select: { id: true, transactionNo: true, type: true, category: true, unitType: true, amount: true, accountId: true, referenceType: true, referenceId: true, description: true, createdAt: true } });
    console.log("  CB 10799:", settle);
    const huBilling = await prisma.billingItem.findMany({
        where: { unitType: "haji_umrah" },
        select: { id: true, transactionSource: true, amount: true, isMarkedPaid: true, paidAt: true, memberId: true, billingPeriodId: true, memberName: true, description: true, createdAt: true },
        orderBy: { id: "asc" },
    });
    console.log(`  BillingItem unitType=haji_umrah: ${huBilling.length}`);
    for (const b of huBilling) console.log("   ", b);
    // Apakah settle 10799 linked ke SavingsTransaction?
    const settleLinked = await prisma.savingsTransaction.findFirst({ where: { notes: { contains: "Mei-Juni 2026", mode: "insensitive" } }, select: { id: true, transactionNo: true, amount: true, notes: true } });
    console.log("  SavingsTransaction dgn notes 'Mei-Juni 2026':", settleLinked || "(tidak ada)");
    console.log("");

    // (c) Full manifest CB H&U yang akan dihapus (semua sumber)
    console.log(sep + "\n[4] MANIFEST CB YANG AKAN DIHAPUS (gabungan: unit haji_umrah + ref SavingsTxn account 4336 + talangan)\n" + sep);
    const acctTxns = await prisma.savingsTransaction.findMany({ where: { accountId: 4336 }, select: { id: true } });
    const acctTxnIds = acctTxns.map((t) => t.id);
    const manifestCb = await prisma.cashBankTransaction.findMany({
        where: {
            OR: [
                { unitType: "haji_umrah" },
                { referenceType: { contains: "savings", mode: "insensitive" }, referenceId: { in: acctTxnIds } },
                { referenceId: 3438 },
            ],
        },
        select: { id: true, transactionNo: true, type: true, amount: true, accountId: true, category: true, unitType: true },
        orderBy: { id: "asc" },
    });
    console.log(`  Total CB manifest: ${manifestCb.length}`);
    let totalIn = 0, totalOut = 0;
    const byAccount = new Map<number, { in: number; out: number }>();
    for (const c of manifestCb) {
        const amt = Number(c.amount);
        const slot = byAccount.get(c.accountId) || { in: 0, out: 0 };
        if (c.type === "in") { totalIn += amt; slot.in += amt; }
        else { totalOut += amt; slot.out += amt; }
        byAccount.set(c.accountId, slot);
    }
    console.log(`  Sum type=in : ${rupiah(totalIn)}`);
    console.log(`  Sum type=out: ${rupiah(totalOut)}`);
    console.log(`  Net delta per CashBankAccount (yang harus direverse: in→kurang, out→tambah):`);
    for (const [aid, s] of byAccount) {
        const net = s.in - s.out;
        console.log(`    acct ${aid}: in=${rupiah(s.in)}  out=${rupiah(s.out)}  net balance adjustment = ${net > 0 ? "-" : "+"}${rupiah(Math.abs(net))}  (jumlah ini dihapus dari inflasi)`);
    }
    console.log("");
}
main().catch((e) => { console.error("❌", e); process.exit(1); }).finally(() => prisma.$disconnect());
