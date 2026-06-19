import prisma from "@/lib/prisma";
import { calculateSystemSHU } from "./shu-calculator";

export interface BalanceSheetItem {
  code: string;
  name: string;
  amount: number;
  source?: "ledger" | "journal" | "computed";
}

const SAVINGS_TYPE_TO_ACCOUNT: Record<string, { code: string; name: string }> = {
  pokok: { code: "2101", name: "Simpanan Pokok" },
  wajib: { code: "2102", name: "Simpanan Wajib" },
  sukarela: { code: "2103", name: "Simpanan Sukarela" },
};

export function mapSavingsByType(rows: { productType: string; balance: number }[]): BalanceSheetItem[] {
  const sums: Record<string, number> = {};
  for (const r of rows) sums[r.productType] = (sums[r.productType] ?? 0) + r.balance;

  const items: BalanceSheetItem[] = [];
  let lainnya = 0;
  for (const [type, amt] of Object.entries(sums)) {
    const acc = SAVINGS_TYPE_TO_ACCOUNT[type];
    if (acc) {
      items.push({ code: acc.code, name: acc.name, amount: amt, source: "ledger" });
    } else {
      lainnya += amt;
    }
  }
  items.sort((a, b) => a.code.localeCompare(b.code));
  if (lainnya !== 0) {
    items.push({ code: "21XX", name: "Simpanan Lainnya (Haji/Umrah/dll)", amount: lainnya, source: "ledger" });
  }
  return items;
}

export interface LoanReceivables {
  principal: number;      // 1201
  interest: number;       // 1202
  writtenOff: number;     // baris terpisah non-realisable
}

export function sumLoanReceivables(
  loans: { status: string; principalOutstanding: number; interestOutstanding: number }[],
): LoanReceivables {
  let principal = 0;
  let interest = 0;
  let writtenOff = 0;
  for (const l of loans) {
    if (l.status === "written_off") {
      writtenOff += l.principalOutstanding;
    } else {
      principal += l.principalOutstanding;
      interest += l.interestOutstanding;
    }
  }
  return { principal, interest, writtenOff };
}

export function computeInventory(
  products: { stock: number; costPrice: number; trackStock: boolean; isService: boolean }[],
): number {
  let total = 0;
  for (const p of products) {
    if (!p.trackStock || p.isService) continue;
    if (p.stock > 0) total += p.stock * p.costPrice;
  }
  return total;
}

export interface FixedAssetSummary {
  gross: number;
  accumulatedDepreciation: number;
  net: number;
}

export function computeFixedAssets(
  assets: { acquisitionCost: number; accumulatedDepreciation: number }[],
): FixedAssetSummary {
  let gross = 0;
  let accumulatedDepreciation = 0;
  for (const a of assets) {
    gross += a.acquisitionCost;
    accumulatedDepreciation += a.accumulatedDepreciation;
  }
  return { gross, accumulatedDepreciation, net: gross - accumulatedDepreciation };
}

export interface EquityResult {
  items: BalanceSheetItem[];
  shuBerjalan: number;
  selisih: number;
  totalEquity: number;
  isBalanced: boolean;
}

export function buildEquityWithSelisih(params: {
  modalItems: BalanceSheetItem[]; // 3101/3102 dari jurnal (excl 3103)
  shuBerjalan: number;
  totalAssets: number;
  totalLiabilities: number;
}): EquityResult {
  const items: BalanceSheetItem[] = [...params.modalItems];
  if (params.shuBerjalan !== 0) {
    items.push({ code: "3103", name: "SHU Tahun Berjalan", amount: params.shuBerjalan, source: "computed" });
  }
  const equityBeforeSelisih = items.reduce((s, i) => s + i.amount, 0);
  const selisih = params.totalAssets - params.totalLiabilities - equityBeforeSelisih;
  const isBalanced = Math.abs(selisih) < 1;
  if (!isBalanced) {
    items.push({ code: "31XX", name: "Selisih Penyesuaian (beda data/jurnal)", amount: selisih, source: "computed" });
  }
  const totalEquity = equityBeforeSelisih + (isBalanced ? 0 : selisih);
  return { items, shuBerjalan: params.shuBerjalan, selisih, totalEquity, isBalanced };
}

export interface BalanceSheetResult {
  asOf: string;
  assets: {
    current: BalanceSheetItem[];
    fixedGross: BalanceSheetItem[];
    accumulatedDepreciation: number;
    totalAssets: number;
  };
  liabilities: {
    savings: BalanceSheetItem[];
    other: BalanceSheetItem[];
    totalLiabilities: number;
  };
  equity: {
    items: BalanceSheetItem[];
    shuBerjalan: number;
    selisih: number;
    totalEquity: number;
  };
  isBalanced: boolean;
  meta: { generatedAt: string; note: string };
}

export interface BalanceSheetParts {
  asOf: string;
  cashItems: BalanceSheetItem[];
  loanRec: LoanReceivables;
  inventory: number;
  fixed: FixedAssetSummary;
  savingsItems: BalanceSheetItem[];
  hutangItems: BalanceSheetItem[];
  modalItems: BalanceSheetItem[];
  shuBerjalan: number;
}

export function assembleBalanceSheet(parts: BalanceSheetParts): BalanceSheetResult {
  const current: BalanceSheetItem[] = [
    ...parts.cashItems,
    { code: "1201", name: "Piutang Pinjaman Anggota", amount: parts.loanRec.principal, source: "ledger" },
    { code: "1202", name: "Piutang Bunga Pinjaman", amount: parts.loanRec.interest, source: "ledger" },
    { code: "1301", name: "Persediaan Barang Dagangan", amount: parts.inventory, source: "ledger" },
  ];
  if (parts.loanRec.writtenOff !== 0) {
    current.push({ code: "1299", name: "Piutang Dihapusbukukan (non-realisable)", amount: parts.loanRec.writtenOff, source: "ledger" });
  }
  const totalCurrent = current.reduce((s, i) => s + i.amount, 0);
  const fixedGross: BalanceSheetItem[] = parts.fixed.gross !== 0
    ? [{ code: "1400", name: "Aset Tetap (harga perolehan)", amount: parts.fixed.gross, source: "ledger" }]
    : [];
  const totalAssets = totalCurrent + parts.fixed.net;

  const liabilityItems = [...parts.savingsItems, ...parts.hutangItems];
  const totalLiabilities = liabilityItems.reduce((s, i) => s + i.amount, 0);

  const equity = buildEquityWithSelisih({
    modalItems: parts.modalItems,
    shuBerjalan: parts.shuBerjalan,
    totalAssets,
    totalLiabilities,
  });

  return {
    asOf: parts.asOf,
    assets: { current, fixedGross, accumulatedDepreciation: parts.fixed.accumulatedDepreciation, totalAssets },
    liabilities: { savings: parts.savingsItems, other: parts.hutangItems, totalLiabilities },
    equity: { items: equity.items, shuBerjalan: equity.shuBerjalan, selisih: equity.selisih, totalEquity: equity.totalEquity },
    isBalanced: equity.isBalanced,
    meta: {
      generatedAt: parts.asOf,
      note: "Posisi per hari ini. Saldo dari tabel ledger (simpanan/kas/pinjaman/aset) + jurnal (hutang/modal).",
    },
  };
}

interface JournalAccountRow {
  code: string;
  name: string;
  type: string;
  balance: number; // sudah dinormalisasi tanda per normal_balance
}

// Ambil saldo akun detail dari jurnal (liability + equity), normalisasi tanda.
async function fetchJournalBalances(): Promise<JournalAccountRow[]> {
  const rows = await prisma.$queryRaw<JournalAccountRow[]>`
    SELECT a.code, a.name, a.type,
           SUM(CASE
               WHEN a.normal_balance = 'debit' THEN jl.debit - jl.credit
               ELSE jl.credit - jl.debit
           END)::float AS balance
    FROM journal_lines jl
    JOIN journals j ON jl.journal_id = j.id
    JOIN accounts a ON jl.account_id = a.id
    WHERE j.is_posted = true
      AND a.is_detail = true
      AND a.type IN ('liability', 'equity')
    GROUP BY a.code, a.name, a.type
    HAVING SUM(CASE
               WHEN a.normal_balance = 'debit' THEN jl.debit - jl.credit
               ELSE jl.credit - jl.debit
           END) <> 0
  `;
  return rows.map((r) => ({ ...r, balance: Number(r.balance) }));
}

const EXCLUDED_LIABILITY_CODES = new Set(["2101", "2102", "2103", "21XX"]); // sumbernya SavingsAccount

export async function buildBalanceSheet(): Promise<BalanceSheetResult> {
  const asOf = new Date().toISOString().split("T")[0];

  const [cashAccounts, loans, storeProducts, assets, savingsAccounts, savingsProducts, journalRows] = await Promise.all([
    prisma.cashBankAccount.findMany({
      where: { isActive: true, deletedAt: null },
      select: { code: true, name: true, currentBalance: true, glAccount: { select: { code: true } } },
    }),
    prisma.loan.findMany({
      where: { status: { in: ["active", "written_off"] } },
      select: { status: true, principalOutstanding: true, interestOutstanding: true },
    }),
    prisma.storeProduct.findMany({
      where: { deletedAt: null },
      select: { stock: true, costPrice: true, trackStock: true, isService: true },
    }),
    prisma.asset.findMany({
      where: { status: "active", deletedAt: null },
      select: { acquisitionCost: true, accumulatedDepreciation: true },
    }),
    prisma.savingsAccount.findMany({
      where: { status: "active" },
      select: { balance: true, productId: true },
    }),
    prisma.savingsProduct.findMany({ select: { id: true, type: true } }),
    fetchJournalBalances(),
  ]);

  // Simpanan (2-step hindari bug groupBy+relation)
  const prodTypeById = new Map(savingsProducts.map((p) => [p.id, p.type]));
  const savingsRows = savingsAccounts.map((a) => ({
    productType: prodTypeById.get(a.productId) ?? "lainnya",
    balance: Number(a.balance),
  }));
  const savingsItems = mapSavingsByType(savingsRows);

  // Kas & Bank (per akun) — kode GL bila glAccountId ter-set, fallback ke kode CashBankAccount
  const cashItems: BalanceSheetItem[] = cashAccounts
    .filter((c) => Number(c.currentBalance) !== 0)
    .map((c) => ({ code: c.glAccount?.code ?? c.code, name: c.name, amount: Number(c.currentBalance), source: "ledger" as const }));

  const loanRec = sumLoanReceivables(
    loans.map((l) => ({
      status: l.status,
      principalOutstanding: Number(l.principalOutstanding),
      interestOutstanding: Number(l.interestOutstanding),
    })),
  );
  const inventory = computeInventory(
    storeProducts.map((p) => ({
      stock: p.stock,
      costPrice: Number(p.costPrice),
      trackStock: p.trackStock,
      isService: p.isService,
    })),
  );
  const fixed = computeFixedAssets(
    assets.map((a) => ({
      acquisitionCost: Number(a.acquisitionCost),
      accumulatedDepreciation: Number(a.accumulatedDepreciation),
    })),
  );

  // Hutang (liability jurnal, kecuali 2101-2103) & Modal (equity jurnal, kecuali 3103)
  const hutangItems: BalanceSheetItem[] = journalRows
    .filter((r) => r.type === "liability" && !EXCLUDED_LIABILITY_CODES.has(r.code))
    .map((r) => ({ code: r.code, name: r.name, amount: r.balance, source: "journal" as const }));
  const modalItems: BalanceSheetItem[] = journalRows
    .filter((r) => r.type === "equity" && r.code !== "3103")
    .map((r) => ({ code: r.code, name: r.name, amount: r.balance, source: "journal" as const }));

  // SHU Tahun Berjalan = laba bersih tahun berjalan (YTD full-year currentYear).
  // Pakai totalIncome - totalExpense (BUKAN netSurplus yang di-Math.max(0,…)).
  const currentYear = new Date().getFullYear();
  const shu = await calculateSystemSHU(currentYear);
  const shuBerjalan = Number(shu.totalIncome) - Number(shu.totalExpense);

  return assembleBalanceSheet({
    asOf,
    cashItems,
    loanRec,
    inventory,
    fixed,
    savingsItems,
    hutangItems,
    modalItems,
    shuBerjalan,
  });
}
