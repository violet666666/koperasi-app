import { describe, it, expect } from "vitest";
import { generateCashBankTxnNo, generateTransferTxnNo } from "@/lib/services/cash-bank-txn-no";

describe("generateCashBankTxnNo", () => {
  it("in → CBM-{year}-{6digit}", () => {
    const n = generateCashBankTxnNo("in", 2026);
    expect(n).toMatch(/^CBM-2026-\d{6}$/);
  });
  it("out → CBK-{year}-{6digit}", () => {
    expect(generateCashBankTxnNo("out", 2026)).toMatch(/^CBK-2026-\d{6}$/);
  });
  it("6-digit segment is zero-padded", () => {
    // run several; all must be exactly 6 digits
    for (let i = 0; i < 50; i++) {
      const seg = generateCashBankTxnNo("in", 2026).split("-")[2];
      expect(seg).toMatch(/^\d{6}$/);
    }
  });
  it("produces high uniqueness over 1000 samples", () => {
    const set = new Set<string>();
    for (let i = 0; i < 1000; i++) set.add(generateCashBankTxnNo("in", 2026));
    expect(set.size).toBeGreaterThan(900); // crypto → near-unique
  });
});

describe("generateTransferTxnNo", () => {
  it("→ TRF-{year}-{6digit}", () => {
    expect(generateTransferTxnNo(2026)).toMatch(/^TRF-2026-\d{6}$/);
  });
});
