import { describe, it, expect } from "vitest";
import {
  isTestSavingsTxn,
  computeBalanceDeltas,
  evaluateGuards,
  type SavingsTxnRow,
  type CashBankRow,
} from "@/lib/services/hu-cleanup";

describe("isTestSavingsTxn", () => {
  it("flags explicit E2E marker notes (case-insensitive)", () => {
    expect(isTestSavingsTxn({ id: 1, transactionNo: "HU-2026-1", notes: "Test setoran E2E", createdById: 727 })).toBe(true);
    expect(isTestSavingsTxn({ id: 2, transactionNo: "HU-2026-2", notes: "Test setoran comprehensive E2E", createdById: 727 })).toBe(true);
    expect(isTestSavingsTxn({ id: 3, transactionNo: "HU-2026-3", notes: "e2E Test — talangan via Playwright", createdById: 727 })).toBe(true);
  });
  it("flags bagi-hasil interest by BH- prefix regardless of notes", () => {
    expect(isTestSavingsTxn({ id: 4, transactionNo: "BH-2026-862459170-0", notes: "Bagi Hasil BSI", createdById: 727 })).toBe(true);
  });
  it("flags generic default-note deposit only when created by a known test account (727/1612)", () => {
    expect(isTestSavingsTxn({ id: 5, transactionNo: "HU-2026-4", notes: "Setoran Tabungan Haji", createdById: 1612 })).toBe(true);
    expect(isTestSavingsTxn({ id: 6, transactionNo: "HU-2026-5", notes: "Setoran Tabungan Haji", createdById: 727 })).toBe(true);
    // real teller -> NOT test (guard will abort)
    expect(isTestSavingsTxn({ id: 7, transactionNo: "HU-2026-6", notes: "Setoran Tabungan Haji", createdById: 9999 })).toBe(false);
  });
  it("does not flag a real-looking txn by an unknown creator", () => {
    expect(isTestSavingsTxn({ id: 8, transactionNo: "HU-2026-7", notes: "Setoran bulanan", createdById: 9999 })).toBe(false);
    expect(isTestSavingsTxn({ id: 9, transactionNo: "HU-2026-8", notes: null, createdById: 9999 })).toBe(false);
  });
});

describe("computeBalanceDeltas", () => {
  it("returns empty map for no rows", () => {
    expect(computeBalanceDeltas([]).size).toBe(0);
  });
  it("sums inflows as positive net (delete -> decrement)", () => {
    const rows: CashBankRow[] = [
      { id: 1, transactionNo: "a", type: "in", amount: 500000, accountId: 9 },
      { id: 2, transactionNo: "b", type: "in", amount: 2500, accountId: 9 },
    ];
    const d = computeBalanceDeltas(rows).get(9)!;
    expect(d.inSum).toBe(502500);
    expect(d.outSum).toBe(0);
    expect(d.net).toBe(502500);
  });
  it("nets a voided in/out pair to zero", () => {
    const rows: CashBankRow[] = [
      { id: 1, transactionNo: "a", type: "in", amount: 3000, accountId: 9 },
      { id: 2, transactionNo: "b", type: "out", amount: 3000, accountId: 9 },
    ];
    expect(computeBalanceDeltas(rows).get(9)!.net).toBe(0);
  });
  it("groups by account and treats out as negative net", () => {
    const rows: CashBankRow[] = [
      { id: 1, transactionNo: "a", type: "in", amount: 100, accountId: 9 },
      { id: 2, transactionNo: "b", type: "out", amount: 40, accountId: 12 },
    ];
    const map = computeBalanceDeltas(rows);
    expect(map.get(9)!.net).toBe(100);
    expect(map.get(12)!.net).toBe(-40);
  });
  it("produces the documented Bank BRI net (in 6,338,000 / out 9,000 -> 6,329,000)", () => {
    const rows: CashBankRow[] = [
      { id: 1, transactionNo: "all-in", type: "in", amount: 6338000, accountId: 9 },
      { id: 2, transactionNo: "all-out", type: "out", amount: 9000, accountId: 9 },
    ];
    const d = computeBalanceDeltas(rows).get(9)!;
    expect(d.inSum).toBe(6338000);
    expect(d.outSum).toBe(9000);
    expect(d.net).toBe(6329000);
  });
});

describe("evaluateGuards", () => {
  const baseOk = {
    huAccounts: [{ id: 4336, txns: [
      { id: 5277, transactionNo: "HU-1", notes: "Test setoran E2E", createdById: 727 },
      { id: 5285, transactionNo: "HU-2", notes: "Setoran Tabungan Haji", createdById: 1612 },
      { id: 5293, transactionNo: "BH-2026-1-0", notes: "Bagi Hasil BSI", createdById: 727 },
    ] as SavingsTxnRow[] }],
    bagiDistStatuses: [{ id: 1, status: "voided" }],
    talanganLoanStatuses: [{ id: 3438, status: "voided" }],
    testProductRefs: [{ id: 12, accounts: 0, txns: 0 }],
    cbCount: 41,
  };

  it("passes (no violations) for the clean all-test surface", () => {
    expect(evaluateGuards(baseOk)).toEqual([]);
  });
  it("aborts when an H&U account has a non-test txn", () => {
    const v = evaluateGuards({ ...baseOk, huAccounts: [{ id: 4336, txns: [
      { id: 5277, transactionNo: "HU-1", notes: "Test setoran E2E", createdById: 727 },
      { id: 6000, transactionNo: "HU-3", notes: "Setoran bulanan real", createdById: 9999 },
    ] as SavingsTxnRow[] }] });
    expect(v.some((x) => x.type === "mixed_account" && x.accountId === 4336 && x.nonTestTxnIds.includes(6000))).toBe(true);
  });
  it("aborts when a bagi-hasil distribution is not voided", () => {
    const v = evaluateGuards({ ...baseOk, bagiDistStatuses: [{ id: 1, status: "voided" }, { id: 9, status: "processed" }] });
    expect(v.some((x) => x.type === "live_bagi_hasil" && x.distributionIds.includes(9))).toBe(true);
  });
  it("aborts when a talangan loan is not voided", () => {
    const v = evaluateGuards({ ...baseOk, talanganLoanStatuses: [{ id: 3438, status: "voided" }, { id: 999, status: "active" }] });
    expect(v.some((x) => x.type === "live_talangan_loan" && x.loanIds.includes(999))).toBe(true);
  });
  it("aborts when a test product still has accounts or txns", () => {
    const v = evaluateGuards({ ...baseOk, testProductRefs: [{ id: 12, accounts: 2, txns: 0 }] });
    expect(v.some((x) => x.type === "test_product_has_refs")).toBe(true);
  });
  it("aborts when CB row count is below the band", () => {
    const v = evaluateGuards({ ...baseOk, cbCount: 5 });
    expect(v.some((x) => x.type === "cb_count_out_of_band" && x.count === 5)).toBe(true);
  });
  it("aborts when CB row count is above the band", () => {
    const v = evaluateGuards({ ...baseOk, cbCount: 999 });
    expect(v.some((x) => x.type === "cb_count_out_of_band")).toBe(true);
  });
});
