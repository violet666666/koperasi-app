/**
 * READ-ONLY diagnostic — mendeteksi test residue (E2E Playwright) pada unit Haji & Umrah.
 *
 * TIDAK ADA penulisan / deletion sama sekali. Hanya SELECT / count.
 * Jalankan: npx tsx scripts/diagnose-hu-test-residue.ts
 *
 * Marker yang dicari (berdasarkan mapping E2E specs di e2e/haji-umrah*.spec.ts):
 *   - SavingsProduct code: TEST_COMPREHENSIVE / ADMIN_CRUD_TEST / ADMIN_SETUP_TEST
 *   - User email: adminhajiumrah@koperasi.com
 *   - SavingsTransaction.notes mengandung: "E2E" / "Test setoran" / "Playwright"
 *   - SavingsTransaction.transactionNo prefix "BH-" (bagi hasil interest)
 *   - LoanApplication.notes mengandung: "E2E" / "Playwright"
 *   - BagiHasilDistribution.periodLabel mengandung: "E2E" / "TEST" atau status voided
 *   - CashBankTransaction.transactionNo prefix "CBT-BH-" atau description mengandung marker,
 *     dengan unitType = "haji_umrah"
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const rupiah = (n: unknown): string => {
    const num = typeof n === "number" ? n : Number(String(n));
    if (!isFinite(num)) return String(n);
    return "Rp " + num.toLocaleString("id-ID", { maximumFractionDigits: 0 });
};

const maskUrl = (url: string): string => {
    try {
        return url.replace(/(:\/\/[^:]+:)[^@]+@/, "$1****@");
    } catch {
        return "(unable to parse)";
    }
};

const sep = "═".repeat(78);

async function main() {
    console.log(sep);
    console.log("  DETEKSI TEST RESIDUE — UNIT HAJI & UMRAH  (READ-ONLY, no writes)");
    console.log(sep);
    console.log("  DATABASE_URL:", maskUrl(process.env.DATABASE_URL || "(unset)"));
    console.log("");

    // -------------------------------------------------------------------
    // 0. Resolve product IDs untuk H&U (tabungan_haji/umrah) & talangan
    // -------------------------------------------------------------------
    const huSavingsProducts = await prisma.savingsProduct.findMany({
        where: { type: { in: ["tabungan_haji", "tabungan_umrah"] } },
        select: { id: true, code: true, name: true, type: true, targetAmount: true, isActive: true },
    });
    const huSavingsProductIds = huSavingsProducts.map((p) => p.id);

    const talanganProducts = await prisma.loanProduct.findMany({
        where: { type: { in: ["talangan_haji", "talangan_umrah"] } },
        select: { id: true, code: true, name: true, type: true },
    });
    const talanganProductIds = talanganProducts.map((p) => p.id);

    console.log("[0] Produk H&U & Talangan terdaftar:");
    console.log("    SavingsProducts (tabungan_haji/umrah):");
    for (const p of huSavingsProducts) {
        console.log(`       id=${p.id}  code=${p.code}  type=${p.type}  target=${rupiah(p.targetAmount)}  active=${p.isActive}`);
    }
    console.log("    LoanProducts (talangan_*):");
    for (const p of talanganProducts) {
        console.log(`       id=${p.id}  code=${p.code}  type=${p.type}`);
    }
    if (huSavingsProductIds.length === 0) {
        console.log("\n    ⚠️  Tidak ada produk tabungan_haji/umrah sama sekali → belum pernah di-seed/aktif.");
    }
    console.log("");

    // -------------------------------------------------------------------
    // A. Test SavingsProduct (kode test eksplisit)
    // -------------------------------------------------------------------
    console.log(sep);
    console.log("[A] TEST SAVINGS PRODUCTS  (code = TEST_* / *_TEST)");
    console.log(sep);
    const testProducts = await prisma.savingsProduct.findMany({
        where: {
            OR: [
                { code: { in: ["TEST_COMPREHENSIVE", "ADMIN_CRUD_TEST", "ADMIN_SETUP_TEST"] } },
                { code: { contains: "TEST", mode: "insensitive" } },
            ],
        },
        select: { id: true, code: true, name: true, type: true, isActive: true, createdAt: true },
    });
    if (testProducts.length === 0) console.log("    (tidak ada)");
    for (const p of testProducts) {
        console.log(`    id=${p.id}  code=${p.code}  name="${p.name}"  type=${p.type}  active=${p.isActive}  created=${p.createdAt.toISOString().slice(0, 10)}`);
    }
    console.log("");

    // -------------------------------------------------------------------
    // B. Test User (admin haji umrah)
    // -------------------------------------------------------------------
    console.log(sep);
    console.log("[B] TEST USER  (adminhajiumrah@koperasi.com)");
    console.log(sep);
    const testUser = await prisma.user.findFirst({
        where: { email: "adminhajiumrah@koperasi.com" },
        select: { id: true, name: true, email: true, roleId: true, branchId: true, unitType: true, isActive: true, deletedAt: true, createdAt: true },
    });
    if (!testUser) {
        console.log("    (tidak ada user adminhajiumrah@koperasi.com)");
    } else {
        console.log(`    id=${testUser.id}  name="${testUser.name}"  roleId=${testUser.roleId}  branchId=${testUser.branchId}  unitType=${testUser.unitType}  active=${testUser.isActive}  deleted=${testUser.deletedAt ? "yes" : "no"}  created=${testUser.createdAt.toISOString().slice(0, 10)}`);
    }
    console.log("");

    // -------------------------------------------------------------------
    // C. Semua SavingsAccount H&U (untuk lihat mana test vs real)
    // -------------------------------------------------------------------
    console.log(sep);
    console.log("[C] SEMUA SAVINGS ACCOUNT H&U  (tabungan_haji/umrah)");
    console.log(sep);
    const huAccounts = huSavingsProductIds.length
        ? await prisma.savingsAccount.findMany({
              where: { productId: { in: huSavingsProductIds } },
              include: {
                  member: { select: { id: true, name: true, nrp: true } },
                  product: { select: { code: true, type: true } },
                  transactions: { select: { id: true, notes: true, transactionNo: true, amount: true, type: true, status: true } },
              },
              orderBy: { createdAt: "asc" },
          })
        : [];
    console.log(`    Total H&U accounts: ${huAccounts.length}`);
    for (const a of huAccounts) {
        const txns = a.transactions;
        const testTxns = txns.filter((t) => {
            const n = (t.notes || "").toLowerCase();
            return n.includes("e2e") || n.includes("test setoran") || n.includes("playwright") || (t.transactionNo || "").startsWith("BH-");
        });
        const looksTestOnly = txns.length > 0 && testTxns.length === txns.length;
        const flag = looksTestOnly ? "🔴 TEST-ONLY" : testTxns.length > 0 ? "🟡 MIXED" : "🟢 CLEAN/real";
        console.log(
            `    id=${a.id}  ${a.accountNo}  member=${a.member?.name} (id=${a.memberId}, nrp=${a.member?.nrp})  ` +
                `prod=${a.product?.code}  balance=${rupiah(a.balance)}  status=${a.status}  created=${a.createdAt.toISOString().slice(0, 10)}  ` +
                `txns=${txns.length} (test=${testTxns.length})  ${flag}`
        );
    }
    console.log("");

    // -------------------------------------------------------------------
    // D. Test SavingsTransactions (H&U) — marker notes / BH- / voided
    // -------------------------------------------------------------------
    console.log(sep);
    console.log("[D] TEST SAVINGS TRANSACTIONS (H&U)  — marker: E2E / Test setoran / Playwright / BH- / voided");
    console.log(sep);
    const testSavingsTxns = huSavingsProductIds.length
        ? await prisma.savingsTransaction.findMany({
              where: {
                  productId: { in: huSavingsProductIds },
                  OR: [
                      { notes: { contains: "E2E", mode: "insensitive" } },
                      { notes: { contains: "Test setoran", mode: "insensitive" } },
                      { notes: { contains: "Playwright", mode: "insensitive" } },
                      { transactionNo: { startsWith: "BH-" } },
                      { status: "voided" },
                  ],
              },
              select: { id: true, transactionNo: true, type: true, amount: true, notes: true, status: true, accountId: true, memberId: true, createdAt: true },
              orderBy: { createdAt: "asc" },
          })
        : [];
    console.log(`    Total: ${testSavingsTxns.length}`);
    for (const t of testSavingsTxns.slice(0, 50)) {
        console.log(`    id=${t.id}  ${t.transactionNo}  type=${t.type}  amt=${rupiah(t.amount)}  status=${t.status}  acct=${t.accountId}  member=${t.memberId}  notes="${t.notes || ""}"`);
    }
    if (testSavingsTxns.length > 50) console.log(`    ... (${testSavingsTxns.length - 50} more)`);
    console.log("");

    // -------------------------------------------------------------------
    // E. Test Talangan (LoanApplication + Loan)
    // -------------------------------------------------------------------
    console.log(sep);
    console.log("[E] TEST TALANGAN  (product talangan_* + notes E2E/Playwright)");
    console.log(sep);
    const testLoanApps = talanganProductIds.length
        ? await prisma.loanApplication.findMany({
              where: {
                  productId: { in: talanganProductIds },
                  OR: [
                      { notes: { contains: "E2E", mode: "insensitive" } },
                      { notes: { contains: "Playwright", mode: "insensitive" } },
                  ],
              },
              include: { loan: { select: { id: true, loanNo: true, status: true } }, member: { select: { name: true } } },
              orderBy: { createdAt: "asc" },
          })
        : [];
    // Tambahan: semua talangan application (tanpa filter notes) untuk lihat gambaran utuh
    const allTalanganApps = talanganProductIds.length
        ? await prisma.loanApplication.findMany({
              where: { productId: { in: talanganProductIds } },
              select: { id: true, applicationNo: true, notes: true, status: true, linkedSavingsAccountId: true, createdAt: true },
              orderBy: { createdAt: "asc" },
          })
        : [];
    console.log(`    Total talangan applications (semua): ${allTalanganApps.length}`);
    console.log(`    Talangan applications dengan marker E2E/Playwright: ${testLoanApps.length}`);
    for (const app of testLoanApps) {
        console.log(`    app=${app.id} (${app.applicationNo})  status=${app.status}  member=${app.member?.name}  linkedAcct=${app.linkedSavingsAccountId}  loan=${app.loan ? app.loan.loanNo + "(" + app.loan.status + ")" : "none"}  notes="${app.notes || ""}"`);
    }
    if (allTalanganApps.length > testLoanApps.length) {
        console.log(`    — Talangan applications TANPA marker (perlu review manual):`);
        for (const app of allTalanganApps.filter((a) => !testLoanApps.some((t) => t.id === a.id))) {
            console.log(`       app=${app.id} (${app.applicationNo})  status=${app.status}  linkedAcct=${app.linkedSavingsAccountId}  notes="${app.notes || ""}"  created=${app.createdAt.toISOString().slice(0, 10)}`);
        }
    }
    console.log("");

    // -------------------------------------------------------------------
    // F. Bagi Hasil residue (periodLabel E2E/TEST atau voided)
    // -------------------------------------------------------------------
    console.log(sep);
    console.log("[F] BAGI HASIL RESIDUE  (periodLabel E2E/TEST atau status voided)");
    console.log(sep);
    const bagiResidue = await prisma.bagiHasilDistribution.findMany({
        where: {
            OR: [
                { periodLabel: { contains: "E2E", mode: "insensitive" } },
                { periodLabel: { contains: "TEST", mode: "insensitive" } },
                { status: "voided" },
            ],
        },
        select: {
            id: true,
            distributionNo: true,
            periodLabel: true,
            status: true,
            memberCount: true,
            spreadAmount: true,
            memberPoolAmount: true,
            createdAt: true,
            items: { select: { id: true, savingsTransactionId: true } },
        },
        orderBy: { createdAt: "asc" },
    });
    console.log(`    Total: ${bagiResidue.length}`);
    for (const d of bagiResidue) {
        const nulledItems = d.items.filter((i) => i.savingsTransactionId === null).length;
        console.log(
            `    id=${d.id}  ${d.distributionNo}  period="${d.periodLabel}"  status=${d.status}  ` +
                `members=${d.memberCount}  spread=${rupiah(d.spreadAmount)}  pool=${rupiah(d.memberPoolAmount)}  ` +
                `items=${d.items.length} (nulledTxn=${nulledItems})  created=${d.createdAt.toISOString().slice(0, 10)}`
        );
    }
    // Semua distribusi (untuk konteks — apakah ada distribusi "real"?)
    const allBagi = await prisma.bagiHasilDistribution.count();
    console.log(`    (Total seluruh BagiHasilDistribution di DB: ${allBagi})`);
    console.log("");

    // -------------------------------------------------------------------
    // G. CashBankTransaction side-effects (unitType = haji_umrah)
    // -------------------------------------------------------------------
    console.log(sep);
    console.log("[G] CASH BANK TRANSACTIONS  (unitType = haji_umrah)");
    console.log(sep);
    const allHuCb = await prisma.cashBankTransaction.count({ where: { unitType: "haji_umrah" } });
    const testCb = await prisma.cashBankTransaction.findMany({
        where: {
            unitType: "haji_umrah",
            OR: [
                { description: { contains: "E2E", mode: "insensitive" } },
                { description: { contains: "Playwright", mode: "insensitive" } },
                { description: { contains: "Test setoran", mode: "insensitive" } },
                { transactionNo: { startsWith: "CBT-BH-" } },
            ],
        },
        select: { id: true, transactionNo: true, type: true, category: true, amount: true, description: true, createdAt: true },
        orderBy: { createdAt: "asc" },
    });
    console.log(`    Total CB txns unitType=haji_umrah: ${allHuCb}`);
    console.log(`    CB txns dengan marker E2E/Playwright/CBT-BH-: ${testCb.length}`);
    for (const c of testCb.slice(0, 50)) {
        console.log(`    id=${c.id}  ${c.transactionNo}  type=${c.type}  cat=${c.category}  amt=${rupiah(c.amount)}  desc="${c.description || ""}"`);
    }
    if (testCb.length > 50) console.log(`    ... (${testCb.length - 50} more)`);
    console.log("");

    // -------------------------------------------------------------------
    // RINGKASAN
    // -------------------------------------------------------------------
    console.log(sep);
    console.log("  RINGKASAN RESIDUE (hit-list kandidat cleanup)");
    console.log(sep);
    console.log(`    A. Test SavingsProducts          : ${testProducts.length}`);
    console.log(`    B. Test User adminhajiumrah       : ${testUser ? 1 : 0}`);
    console.log(`    C. H&U SavingsAccounts (total)    : ${huAccounts.length}`);
    console.log(`         → TEST-ONLY (semua txn test) : ${huAccounts.filter((a) => a.transactions.length > 0 && a.transactions.every((t) => { const n=(t.notes||"").toLowerCase(); return n.includes("e2e")||n.includes("test setoran")||n.includes("playwright")||(t.transactionNo||"").startsWith("BH-"); })).length}`);
    console.log(`         → MIXED (sebagian test)      : ${huAccounts.filter((a) => { const tx=a.transactions; const tt=tx.filter((t)=>{const n=(t.notes||"").toLowerCase();return n.includes("e2e")||n.includes("test setoran")||n.includes("playwright")||(t.transactionNo||"").startsWith("BH-");}); return tt.length>0 && tt.length<tx.length; }).length}`);
    console.log(`         → CLEAN/real                 : ${huAccounts.filter((a) => { const tx=a.transactions; const tt=tx.filter((t)=>{const n=(t.notes||"").toLowerCase();return n.includes("e2e")||n.includes("test setoran")||n.includes("playwright")||(t.transactionNo||"").startsWith("BH-");}); return tt.length===0; }).length}`);
    console.log(`    D. Test SavingsTransactions       : ${testSavingsTxns.length}`);
    console.log(`    E. Test Talangan (apps+loans)     : ${testLoanApps.length}`);
    console.log(`    F. Bagi Hasil residue             : ${bagiResidue.length}`);
    console.log(`    G. CashBank test side-effects     : ${testCb.length}  (dari total ${allHuCb} H&U CB txns)`);
    console.log("");
    console.log("    ⚠  Item ambigu yang TIDAK boleh auto-delete tanpa konfirmasi:");
    console.log("       - Account HU-776-10-1715 (member 776 A'AN ANDRIONO) — fixture real");
    console.log("       - User adminhajiumrah@koperasi.com — mungkin dipakai sebagai admin");
    console.log("       - Talangan applications TANPA marker E2E — bisa pinjaman real");
    console.log("");
    console.log("  ✅ Selesai. Tidak ada data diubah / dihapus.");
}

main()
    .catch((e) => {
        console.error("❌ Error:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
