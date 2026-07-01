import type { BalanceSheetResult, BalanceSheetItem } from "./neraca";

export interface MobileNeracaItem {
  code: string;
  name: string;
  amount: number;
}

export interface MobileNeracaShape {
  assets: {
    current: MobileNeracaItem[];
    fixed: MobileNeracaItem[];
    totalCurrentAssets: number;
    totalFixedAssets: number;
    totalAssets: number;
  };
  liabilities: {
    shortTerm: MobileNeracaItem[];
    longTerm: MobileNeracaItem[];
    totalLiabilities: number;
  };
  equity: {
    items: MobileNeracaItem[];
    totalEquity: number;
  };
  totalLiabilitiesAndEquity: number;
  isBalanced?: boolean;
}

const sum = (items: { amount: number }[]) => items.reduce((s, i) => s + i.amount, 0);

const strip = (items: BalanceSheetItem[]): MobileNeracaItem[] =>
  items.map((i) => ({ code: i.code, name: i.name, amount: i.amount }));

/**
 * Reshape canonical ledger BalanceSheetResult → mobile NeracaScreen shape.
 * Pure; unit-tested. `source` field dropped (screen only reads code/name/amount).
 */
export function toMobileNeracaShape(bs: BalanceSheetResult): MobileNeracaShape {
  const fixed: MobileNeracaItem[] = strip(bs.assets.fixedGross);
  if (bs.assets.accumulatedDepreciation !== 0) {
    fixed.push({ code: "1499", name: "Akumulasi Penyusutan", amount: -bs.assets.accumulatedDepreciation });
  }

  const current = strip(bs.assets.current);
  const totalCurrentAssets = sum(current);
  const totalFixedAssets = sum(fixed); // gross + (-accum) = net

  const shortTerm = strip([...bs.liabilities.savings, ...bs.liabilities.other]);

  return {
    assets: {
      current,
      fixed,
      totalCurrentAssets,
      totalFixedAssets,
      totalAssets: bs.assets.totalAssets,
    },
    liabilities: {
      shortTerm,
      longTerm: [],
      totalLiabilities: bs.liabilities.totalLiabilities,
    },
    equity: {
      items: strip(bs.equity.items),
      totalEquity: bs.equity.totalEquity,
    },
    totalLiabilitiesAndEquity: bs.liabilities.totalLiabilities + bs.equity.totalEquity,
    isBalanced: bs.isBalanced,
  };
}
