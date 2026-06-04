import { describe, it, expect } from "vitest";

import {
  cleanNrp,
  cleanNumber,
  cleanNameForMatch,
  parseExcelDate,
  detectPeriod,
  MONTH_NAME_MAP,
  SUMMARY_KEYWORDS,
  COL,
  ROMAWI,
} from "@/lib/import-vs-sp-helpers";

// =================================================================
// cleanNrp
// =================================================================
describe("cleanNrp", () => {
  it("strips quotes and trims", () => {
    expect(cleanNrp("'74110018")).toBe("74110018");
    expect(cleanNrp('"74110018"')).toBe("74110018");
    expect(cleanNrp("  74110018  ")).toBe("74110018");
  });

  it("removes .0 suffix from Excel number format", () => {
    expect(cleanNrp("74110018.0")).toBe("74110018");
  });

  it("handles empty/undefined", () => {
    expect(cleanNrp("")).toBe("");
    expect(cleanNrp(undefined)).toBe("");
  });
});

// =================================================================
// cleanNumber
// =================================================================
describe("cleanNumber", () => {
  it("parses clean numbers", () => {
    expect(cleanNumber("27000000")).toBe(27000000);
    expect(cleanNumber(1500000)).toBe(1500000);
  });

  it("handles parenthesized negatives (accounting format)", () => {
    expect(cleanNumber("(500000)")).toBe(-500000);
  });

  it("returns 0 for empty/invalid", () => {
    expect(cleanNumber("")).toBe(0);
    expect(cleanNumber(undefined)).toBe(0);
    expect(cleanNumber("abc")).toBe(0);
  });

  it("handles decimal numbers", () => {
    expect(cleanNumber("1041666.6666666666")).toBeCloseTo(1041666.67, 1);
  });
});

// =================================================================
// cleanNameForMatch
// =================================================================
describe("cleanNameForMatch", () => {
  it("strips leading spaces and uppercases", () => {
    expect(cleanNameForMatch(" EKO KRISDIANSYAH")).toBe("EKO KRISDIANSYAH");
  });

  it("removes academic titles", () => {
    expect(cleanNameForMatch("ERWIN PRATAMA S.H.")).toBe("ERWIN PRATAMA");
    expect(cleanNameForMatch("TOTOK SUDARSONO, S.E.")).toBe("TOTOK SUDARSONO");
    expect(cleanNameForMatch("YOGA WICAKSANA S.T.")).toBe("YOGA WICAKSANA");
  });

  it("handles empty input", () => {
    expect(cleanNameForMatch("")).toBe("");
  });

  it("normalizes multiple spaces", () => {
    expect(cleanNameForMatch("  AAN   NISMANTO  ")).toBe("AAN NISMANTO");
  });

  it("removes dots from names", () => {
    expect(cleanNameForMatch("WALUYO MUJI .S")).toBe("WALUYO MUJI S");
  });

  it("splits on comma and takes first part", () => {
    expect(cleanNameForMatch("TOTOK SUDARSONO, S.E.")).toBe("TOTOK SUDARSONO");
  });
});

// =================================================================
// parseExcelDate
// =================================================================
describe("parseExcelDate", () => {
  it("parses standard format: '5 Feb 2025'", () => {
    const d = parseExcelDate("5 Feb 2025");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2025);
    expect(d!.getMonth()).toBe(1); // February = 1
    expect(d!.getDate()).toBe(5);
  });

  it("parses abbreviated months: '9 AGS 2024'", () => {
    const d = parseExcelDate("9 AGS 2024");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2024);
    expect(d!.getMonth()).toBe(7); // August = 7
  });

  it("parses Indonesian months: '18 MARET 2026'", () => {
    const d = parseExcelDate("18 MARET 2026");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(2); // March = 2
  });

  it("handles typo '12 mei 226' as '12 mei 2026'", () => {
    const d = parseExcelDate("12 mei 226");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
  });

  it("handles typo '20 ARP 2024' as April", () => {
    const d = parseExcelDate("20 ARP 2024");
    expect(d).not.toBeNull();
    expect(d!.getMonth()).toBe(3); // April
  });

  it("returns null for empty/invalid", () => {
    expect(parseExcelDate("")).toBeNull();
    expect(parseExcelDate(undefined)).toBeNull();
    expect(parseExcelDate("-")).toBeNull();
  });

  it("parses Excel serial date numbers", () => {
    // 45658 = Jan 1, 2025 (Excel serial: days since 1899-12-30)
    const d = parseExcelDate("45658");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2025);
    expect(d!.getMonth()).toBe(0); // January
  });

  it("parses '06 MEI 2026'", () => {
    const d = parseExcelDate("06 MEI 2026");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(4); // May = 4
    expect(d!.getDate()).toBe(6);
  });

  it("parses 'sept' alias for september: '15 SEPT 2025'", () => {
    const d = parseExcelDate("15 SEPT 2025");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2025);
    expect(d!.getMonth()).toBe(8); // September = 8
    expect(d!.getDate()).toBe(15);
  });

  it("parses 'nop' alias for november: '20 NOP 2024'", () => {
    const d = parseExcelDate("20 NOP 2024");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2024);
    expect(d!.getMonth()).toBe(10); // November = 10
    expect(d!.getDate()).toBe(20);
  });
});

// =================================================================
// detectPeriod
// =================================================================
describe("detectPeriod", () => {
  it("detects from 'PER 31 JUNI 2026'", () => {
    const rows: string[][] = Array.from({ length: 12 }, () => Array(18).fill(""));
    rows[6] = Array(18).fill("");
    rows[6][10] = "PER 31 JUNI 2026";

    const result = detectPeriod(rows);
    expect(result).not.toBeNull();
    expect(result!.monthNum).toBe(6);
    expect(result!.monthName).toBe("Juni");
    expect(result!.year).toBe(2026);
  });

  it("detects from 'PER 30 APRIL 2026'", () => {
    const rows: string[][] = Array.from({ length: 12 }, () => Array(18).fill(""));
    rows[6] = Array(18).fill("");
    rows[6][10] = "PER 30 APRIL 2026";

    const result = detectPeriod(rows);
    expect(result).not.toBeNull();
    expect(result!.monthNum).toBe(4);
    expect(result!.monthName).toBe("April");
    expect(result!.year).toBe(2026);
  });

  it("returns null when no period found", () => {
    const rows: string[][] = Array.from({ length: 12 }, () => Array(18).fill(""));
    const result = detectPeriod(rows);
    expect(result).toBeNull();
  });

  it("detects period in any header row (0-11)", () => {
    const rows: string[][] = Array.from({ length: 12 }, () => Array(18).fill(""));
    rows[0][5] = "PER 28 FEBRUARI 2026";

    const result = detectPeriod(rows);
    expect(result).not.toBeNull();
    expect(result!.monthNum).toBe(2);
    expect(result!.monthName).toBe("Februari");
    expect(result!.year).toBe(2026);
  });
});

// =================================================================
// Constants
// =================================================================
describe("exported constants", () => {
  it("COL has all 15 columns mapped", () => {
    expect(Object.keys(COL)).toHaveLength(15);
    expect(COL.NAMA).toBe(3);
    expect(COL.NRP).toBe(5);
    expect(COL.PINJAM).toBe(7);
    expect(COL.SISA_SALDO).toBe(14);
  });

  it("SUMMARY_KEYWORDS contains required entries", () => {
    expect(SUMMARY_KEYWORDS).toContain("JUMLAH");
    expect(SUMMARY_KEYWORDS).toContain("GAGAL POT");
    expect(SUMMARY_KEYWORDS).toContain("SAMA DENGAN");
  });

  it("MONTH_NAME_MAP covers all 12 months", () => {
    const months = new Set(Object.values(MONTH_NAME_MAP));
    expect(months.size).toBe(12);
  });

  it("ROMAWI has 12 entries", () => {
    expect(ROMAWI).toHaveLength(12);
    expect(ROMAWI[0]).toBe("I");
    expect(ROMAWI[11]).toBe("XII");
  });
});
