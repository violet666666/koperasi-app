import { describe, it, expect } from "vitest";
import { resolveIncomeMode } from "@/lib/services/operational-income-helpers";

describe("resolveIncomeMode", () => {
  it("jenis 'customer' → create UT + cbCategory pendapatan_unit", () => {
    const m = resolveIncomeMode("customer", null);
    expect(m.createsUnitTransaction).toBe(true);
    expect(m.cbCategory).toBe("pendapatan_unit");
    expect(m.memberId).toBeNull();
  });
  it("jenis 'customer' + memberId → memberId diparse ke number", () => {
    expect(resolveIncomeMode("customer", "123").memberId).toBe(123);
    expect(resolveIncomeMode("customer", 456).memberId).toBe(456);
  });
  it("jenis 'operasional' → tidak create UT, cbCategory operational, memberId null", () => {
    const m = resolveIncomeMode("operasional", "123");
    expect(m.createsUnitTransaction).toBe(false);
    expect(m.cbCategory).toBe("operational");
    expect(m.memberId).toBeNull();
  });
  it("default (undefined/null/invalid) → operasional", () => {
    expect(resolveIncomeMode(undefined, null).createsUnitTransaction).toBe(false);
    expect(resolveIncomeMode(null, null).cbCategory).toBe("operational");
    expect(resolveIncomeMode("hacked", null).cbCategory).toBe("operational");
    expect(resolveIncomeMode("", null).cbCategory).toBe("operational");
  });
  it("memberId invalid (NaN) → null", () => {
    expect(resolveIncomeMode("customer", "abc").memberId).toBeNull();
    expect(resolveIncomeMode("customer", NaN).memberId).toBeNull();
  });
});
