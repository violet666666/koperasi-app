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
  if (lainnya > 0) {
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
