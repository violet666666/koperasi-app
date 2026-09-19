// Read-only: dump chart of accounts + data sources to design neraca format mapping.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // 1. Chart of accounts: asset/liability/equity with posted balances
  const accounts = await prisma.$queryRaw<any[]>`
    SELECT a.code, a.name, a.type, a.category, a.level, a.is_detail,
           SUM(CASE WHEN a.normal_balance = 'debit' THEN jl.debit - jl.credit
                    ELSE jl.credit - jl.debit END)::float AS balance
    FROM accounts a
    LEFT JOIN journal_lines jl ON jl.account_id = a.id
    LEFT JOIN journals j ON jl.journal_id = j.id AND j.is_posted = true
    WHERE a.type IN ('asset','liability','equity') AND a.deleted_at IS NULL
    GROUP BY a.code, a.name, a.type, a.category, a.level, a.is_detail
    ORDER BY a.code`;
  console.log("=== ACCOUNTS (asset/liability/equity) with posted balance ===");
  for (const a of accounts) {
    console.log(`${a.code} | ${a.type.padEnd(10)} | L${a.level} det=${a.is_detail ? "Y" : "n"} | ${String(a.balance ?? 0).padStart(15)} | ${a.name}${a.category ? " [" + a.category + "]" : ""}`);
  }

  // 2. Cash & bank accounts
  const cash = await prisma.cashBankAccount.findMany({
    where: { deletedAt: null },
    select: { code: true, name: true, type: true, purpose: true, unitType: true, currentBalance: true, isActive: true, glAccount: { select: { code: true } } },
    orderBy: { code: "asc" },
  });
  console.log(`\n=== CASH/BANK ACCOUNTS (${cash.length}) ===`);
  for (const c of cash) {
    console.log(`${c.code} | ${c.type.padEnd(4)} | akt=${c.isActive ? "Y" : "N"} | gl=${c.glAccount?.code ?? "-"} | ${String(Number(c.currentBalance)).padStart(15)} | ${c.name}${c.purpose ? " (" + c.purpose + ")" : ""}${c.unitType ? " @" + c.unitType : ""}`);
  }

  // 3. Assets per category
  const assets = await prisma.$queryRaw<any[]>`
    SELECT category, COUNT(*)::int AS n,
           SUM(acquisition_cost)::float AS gross,
           SUM(accumulated_depreciation)::float AS depr,
           SUM(book_value)::float AS net
    FROM assets WHERE status = 'active' AND deleted_at IS NULL
    GROUP BY category ORDER BY category`;
  console.log(`\n=== FIXED ASSETS per kategori ===`);
  for (const a of assets) {
    console.log(`${a.category.padEnd(12)} n=${a.n} gross=${a.gross} depr=${a.depr} net=${a.net}`);
  }

  // 4. Savings per product type
  const savings = await prisma.$queryRaw<any[]>`
    SELECT sp.type, COUNT(sa.id)::int AS n, COALESCE(SUM(sa.balance),0)::float AS total
    FROM savings_accounts sa JOIN savings_products sp ON sa.product_id = sp.id
    WHERE sa.status = 'active'
    GROUP BY sp.type ORDER BY sp.type`;
  console.log(`\n=== SAVINGS per type ===`);
  for (const s of savings) console.log(`${s.type.padEnd(20)} n=${s.n} total=${s.total}`);

  // 5. Piutang candidates: unit/store credit outstanding (piutang pihak ketiga non anggota?)
  const storePiutang = await prisma.$queryRaw<any[]>`
    SELECT COUNT(*)::int AS n, COALESCE(SUM(total_amount),0)::float AS total
    FROM store_sales
    WHERE metadata->>'isVoided' IS DISTINCT FROM 'true' AND payment_method = 'salary_cut'`;
  console.log(`\n=== STORE SALES salary_cut (potong gaji, belum settle?) ===`, storePiutang[0]);
  const billingPending = await prisma.$queryRaw<any[]>`
    SELECT COUNT(*)::int AS n, COALESCE(SUM(amount),0)::float AS total
    FROM billing_items WHERE paid_at IS NULL`;
  console.log(`=== BILLING ITEMS unpaid ===`, billingPending[0]);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
