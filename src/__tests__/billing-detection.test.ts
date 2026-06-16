import { describe, it, expect } from "vitest";
import { extractSaleNo, buildBillingItems } from "@/lib/services/billing";

describe("extractSaleNo", () => {
  it("matches web toko prefix TK-", () => {
    expect(extractSaleNo("Piutang toko (Potongan Gaji) - TK-16062026-0033"))
      .toBe("TK-16062026-0033");
  });
  it("matches resto RS- and cafe CF-", () => {
    expect(extractSaleNo("... RS-16062026-0029")).toBe("RS-16062026-0029");
    expect(extractSaleNo("... CF-11062026-0059")).toBe("CF-11062026-0059");
  });
  it("matches mobile prefix POS-M- (the bug fix)", () => {
    expect(extractSaleNo("Piutang toko (Mobile Potong Gaji) - POS-M-16062026-0001"))
      .toBe("POS-M-16062026-0001");
  });
  it("matches playstation PS-, resto_cafe RC-, coffe_latar CL-", () => {
    expect(extractSaleNo("x PS-16062026-0001")).toBe("PS-16062026-0001");
    expect(extractSaleNo("x RC-16062026-0001")).toBe("RC-16062026-0001");
    expect(extractSaleNo("x CL-16062026-0001")).toBe("CL-16062026-0001");
  });
  it("returns null when no saleNo present", () => {
    expect(extractSaleNo("Pembayaran cuci_mobil - Walk-in")).toBeNull();
    expect(extractSaleNo(null)).toBeNull();
    expect(extractSaleNo(undefined)).toBeNull();
    expect(extractSaleNo("")).toBeNull();
  });
});

type UTOver = {
  id: number; memberId?: number; unitType?: string; description?: string | null;
  saleNo?: string | null;
  amount?: number; isPaid?: boolean; status?: string;
  member?: { name: string | null; nrp: string | null };
};
const ut = (over: UTOver) => ({
  id: over.id,
  memberId: over.memberId ?? 1,
  unitType: over.unitType ?? "toko",
  description: over.description ?? null,
  saleNo: over.saleNo ?? null,
  amount: over.amount ?? 50000,
  isPaid: over.isPaid ?? false,
  status: over.status ?? "completed",
  member: over.member ?? { name: "Anggota", nrp: "1" },
});
type SSOver = {
  id: number; saleNo?: string; memberId?: number; unitType?: string;
  totalAmount?: number; metadata?: unknown;
  member?: { name: string | null; nrp: string | null };
};
const ss = (over: SSOver) => ({
  id: over.id,
  saleNo: over.saleNo ?? "TK-16062026-0001",
  memberId: over.memberId ?? 1,
  unitType: over.unitType ?? "toko",
  totalAmount: over.totalAmount ?? 50000,
  metadata: over.metadata ?? null,
  member: over.member ?? { name: "Anggota", nrp: "1" },
});

describe("buildBillingItems", () => {
  it("I1 completeness: emits one item per outstanding UnitTransaction", () => {
    const items = buildBillingItems({
      unitTransactions: [ut({ id: 1, amount: 10000 }), ut({ id: 2, amount: 20000 }), ut({ id: 3, amount: 30000 })],
      storeSales: [], excludedTxIds: new Set(), excludedSaleIds: new Set(),
    });
    expect(items).toHaveLength(3);
    expect(items.every((i) => i.transactionSource === "unit_transaction")).toBe(true);
  });

  it("I2 settled excluded: isPaid UT is NOT emitted (defense-in-depth)", () => {
    const items = buildBillingItems({
      unitTransactions: [ut({ id: 1, isPaid: true }), ut({ id: 2, isPaid: false })],
      storeSales: [], excludedTxIds: new Set(), excludedSaleIds: new Set(),
    });
    expect(items).toHaveLength(1);
    expect(items[0].transactionId).toBe(2);
  });

  it("I1 status filter: non-completed UT excluded", () => {
    const items = buildBillingItems({
      unitTransactions: [ut({ id: 1, status: "voided" }), ut({ id: 2, status: "completed" })],
      storeSales: [], excludedTxIds: new Set(), excludedSaleIds: new Set(),
    });
    expect(items).toHaveLength(1);
    expect(items[0].transactionId).toBe(2);
  });

  it("I3 cross-period dedup: UT id in excludedTxIds is NOT emitted", () => {
    const items = buildBillingItems({
      unitTransactions: [ut({ id: 1 }), ut({ id: 2 })],
      storeSales: [], excludedTxIds: new Set([1]), excludedSaleIds: new Set(),
    });
    expect(items).toHaveLength(1);
    expect(items[0].transactionId).toBe(2);
  });

  it("Source 2 gap: StoreSale with no matching UT is emitted as store_sale", () => {
    const items = buildBillingItems({
      unitTransactions: [],
      storeSales: [ss({ id: 9, saleNo: "TK-16062026-0007", totalAmount: 44000 })],
      excludedTxIds: new Set(), excludedSaleIds: new Set(),
    });
    expect(items).toHaveLength(1);
    expect(items[0].transactionSource).toBe("store_sale");
    expect(items[0].transactionId).toBe(9);
    expect(items[0].amount).toBe(44000);
  });

  it("I3 POS-M- NO double-count: StoreSale + UT referencing same saleNo -> 1 item", () => {
    const saleNo = "POS-M-16062026-0001";
    const items = buildBillingItems({
      unitTransactions: [ut({ id: 1, description: `Piutang toko (Mobile Potong Gaji) - ${saleNo}` })],
      storeSales: [ss({ id: 9, saleNo })],
      excludedTxIds: new Set(), excludedSaleIds: new Set(),
    });
    expect(items).toHaveLength(1);
    expect(items[0].transactionSource).toBe("unit_transaction");
  });

  it("I3 TK- NO double-count (regression): StoreSale + UT -> 1 item", () => {
    const saleNo = "TK-16062026-0033";
    const items = buildBillingItems({
      unitTransactions: [ut({ id: 1, description: `Piutang toko (Potongan Gaji) - ${saleNo}` })],
      storeSales: [ss({ id: 9, saleNo })],
      excludedTxIds: new Set(), excludedSaleIds: new Set(),
    });
    expect(items).toHaveLength(1);
  });

  it("I4 voided StoreSale excluded", () => {
    const items = buildBillingItems({
      unitTransactions: [],
      storeSales: [ss({ id: 9, metadata: { isVoided: true } })],
      excludedTxIds: new Set(), excludedSaleIds: new Set(),
    });
    expect(items).toHaveLength(0);
  });

  it("I2 settled StoreSale excluded (defense)", () => {
    const items = buildBillingItems({
      unitTransactions: [],
      storeSales: [ss({ id: 9, metadata: { isSettled: true } })],
      excludedTxIds: new Set(), excludedSaleIds: new Set(),
    });
    expect(items).toHaveLength(0);
  });

  it("excludedSaleIds skips that StoreSale", () => {
    const items = buildBillingItems({
      unitTransactions: [],
      storeSales: [ss({ id: 9 }), ss({ id: 10 })],
      excludedTxIds: new Set(), excludedSaleIds: new Set([9]),
    });
    expect(items).toHaveLength(1);
    expect(items[0].transactionId).toBe(10);
  });

  it("I3 ut.saleNo is the primary dedup key (no regex on description needed)", () => {
    const saleNo = "TK-17062026-0001";
    const items = buildBillingItems({
      unitTransactions: [ut({ id: 1, saleNo, description: "Piutang toko - no saleNo text here" })],
      storeSales: [ss({ id: 9, saleNo })],
      excludedTxIds: new Set(), excludedSaleIds: new Set(),
    });
    expect(items).toHaveLength(1);
    expect(items[0].transactionSource).toBe("unit_transaction");
  });

  it("I3 ut.saleNo takes precedence over a different saleNo in description", () => {
    const items = buildBillingItems({
      unitTransactions: [ut({ id: 1, saleNo: "TK-17062026-0002", description: "Piutang toko - TK-17062026-0099" })],
      storeSales: [ss({ id: 9, saleNo: "TK-17062026-0002" })],
      excludedTxIds: new Set(), excludedSaleIds: new Set(),
    });
    expect(items).toHaveLength(1);
  });

  it("fallback: null ut.saleNo still dedups via extractSaleNo(description)", () => {
    const saleNo = "POS-M-17062026-0001";
    const items = buildBillingItems({
      unitTransactions: [ut({ id: 1, saleNo: null, description: `Piutang toko (Mobile Potong Gaji) - ${saleNo}` })],
      storeSales: [ss({ id: 9, saleNo })],
      excludedTxIds: new Set(), excludedSaleIds: new Set(),
    });
    expect(items).toHaveLength(1);
  });
});
