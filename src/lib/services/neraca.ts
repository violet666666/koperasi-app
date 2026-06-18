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
