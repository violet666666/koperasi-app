import { describe, it, expect } from "vitest";
import { extractSaleNo } from "@/lib/services/billing";

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
