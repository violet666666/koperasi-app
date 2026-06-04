// =================================================================
// Import VS SP — Pure helper functions
// =================================================================
// Extracted from route handler for testability.
// NO database access — all functions are pure.
// =================================================================

/** GAJI sheet column mapping (0-indexed) */
export const COL = {
  NO: 0,
  KODE_SATKER: 1,
  KLASIFIKASI: 2,
  NAMA: 3,
  PANGKAT: 4,
  NRP: 5,
  TGL_PINJAM: 6,
  PINJAM: 7,
  SELAMA: 8,
  JASA: 9,
  ANGSURAN: 10,
  POT_BULAN: 11,
  TOTAL_BULAN: 12,
  JUMLAH_SD: 13,
  SISA_SALDO: 14,
} as const;

/** Summary rows to skip — these are totals/headers, not real data */
export const SUMMARY_KEYWORDS = [
  "JUMLAH",
  "PERMINTAAN",
  "GAGAL POT",
  "DITERIMA",
  "DIKEMBALIKAN",
  "MENGEMBALIKAN",
  "SAMA DENGAN",
] as const;

/** Month name → number mapping for period detection & date parsing */
export const MONTH_NAME_MAP: Record<string, number> = {
  // Indonesian full
  januari: 0,
  pebruari: 1,
  februari: 1,
  maret: 2,
  april: 3,
  mei: 4,
  juni: 5,
  juli: 6,
  agustus: 7,
  september: 8,
  oktober: 9,
  november: 10,
  desember: 11,
  // Indonesian abbreviated
  jan: 0,
  peb: 1,
  feb: 1,
  mrt: 2,
  apr: 3,
  agu: 7,
  agt: 7,
  ags: 7,
  okt: 9,
  nov: 10,
  nop: 10,
  des: 11,
  sept: 8,
  // English (fallback)
  january: 0,
  february: 1,
  march: 2,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  october: 9,
  december: 11,
};

/** Month number → Indonesian name */
export const MONTH_INDONESIAN: Record<number, string> = {
  0: "Januari",
  1: "Februari",
  2: "Maret",
  3: "April",
  4: "Mei",
  5: "Juni",
  6: "Juli",
  7: "Agustus",
  8: "September",
  9: "Oktober",
  10: "November",
  11: "Desember",
};

/** Roman numeral for import sequence numbers */
export const ROMAWI = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

// =================================================================
// Cleaners & Parsers
// =================================================================

/**
 * Strip quotes, trim whitespace, remove .0 suffix from Excel number format.
 */
export function cleanNrp(raw: string | undefined): string {
  if (!raw) return "";
  return String(raw).replace(/['"]/g, "").replace(/\.0$/, "").trim();
}

/**
 * Parse a numeric value from Excel cell.
 * Handles: clean numbers, parenthesized negatives (accounting format), decimals.
 * Returns 0 for empty/invalid input.
 */
export function cleanNumber(raw: string | number | undefined): number {
  if (raw === undefined || raw === null || raw === "") return 0;
  if (typeof raw === "number") return raw;
  const isNegative = String(raw).includes("(") && String(raw).includes(")");
  const cleaned = String(raw).replace(/[^0-9.\-]/g, "");
  let num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  if (isNegative) num = -Math.abs(num);
  return num;
}

/**
 * Normalize a member name for matching.
 * - Uppercase
 * - Remove academic titles (S.H., S.T., S.E., etc.)
 * - Remove dots
 * - Normalize spaces
 * - Split on comma (take first part)
 */
export function cleanNameForMatch(name: string): string {
  if (!name) return "";
  let clean = String(name).replace(/['"]/g, "").trim().toUpperCase();
  // Split on comma — take the name part, discard title after comma
  clean = clean.split(",")[0].trim();

  // Academic titles to remove (with and without dots)
  const titles = [
    "S.H.", "S.H", "SH",
    "S.T.", "S.T", "ST",
    "S.SOS.", "S.SOS", "SSOS",
    "S.E.", "S.E", "SE",
    "S.IP.", "S.IP", "SIP",
    "M.H.", "M.H", "MH",
    "M.SC.", "M.SC", "MSC",
    "M.M.", "M.M", "MM",
    "S.PD.", "S.PD", "SPD",
    "S.T.K.", "S.T.K", "STK",
    "S.PT.", "S.PT", "SPT",
    "S.OR.", "S.OR", "SOR",
    "S.I.K.", "S.I.K", "SIK",
  ];

  let changed = true;
  while (changed) {
    changed = false;
    for (const t of titles) {
      const suffix = " " + t;
      if (clean.endsWith(suffix) || clean.endsWith(suffix.replace(/\./g, ""))) {
        clean = clean.substring(0, clean.length - suffix.length).trim();
        changed = true;
      }
    }
  }

  return clean.replace(/\./g, "").replace(/\s+/g, " ").trim();
}

/**
 * Parse various date formats from Excel cells:
 * - "5 Feb 2025", "9 AGS 2024", "18 MARET 2026"
 * - Typo handling: "226" → "2026", "ARP" → "APR"
 * - Excel serial date numbers (e.g. 45658)
 * - Standard Date.parse fallback
 */
export function parseExcelDate(raw: string | number | undefined): Date | null {
  if (!raw) return null;
  const str = String(raw).trim();
  if (!str || str === "-") return null;

  // Try "5 Feb 2025" or "18 MARET 2026" format
  const parts = str.split(/[\s/-]+/);
  if (parts.length >= 3) {
    const day = parseInt(parts[0]);
    let monthStr = parts[1].toLowerCase().replace(/\./g, "");
    let year = parseInt(parts[2]);

    // Handle typo: short year like "226" → "2026"
    if (!isNaN(year) && year >= 100 && year < 1000) {
      year = 2000 + (year % 100);
    }

    // Handle typo: "ARP" → "APR"
    if (monthStr === "arp") monthStr = "apr";

    const month = MONTH_NAME_MAP[monthStr];
    if (!isNaN(day) && month !== undefined && !isNaN(year) && year > 2000) {
      return new Date(year, month, day);
    }
  }

  // Try Excel serial date number BEFORE native Date.parse
  // (native Date("45658") gives year 45658, which is wrong)
  const num = parseFloat(str);
  if (!isNaN(num) && num > 40000 && num < 60000) {
    return new Date((num - 25569) * 86400 * 1000);
  }

  // Fallback: try native Date parse (but guard against absurd years)
  const d = new Date(str);
  if (!isNaN(d.getTime()) && d.getFullYear() > 2000 && d.getFullYear() < 2100) return d;

  return null;
}

/**
 * Detect the period (month/year) from header rows of the GAJI sheet.
 * Scans row 6 for "PER [day] [MONTH] [YEAR]" pattern.
 * Returns { monthNum, monthName, year } or null.
 */
export function detectPeriod(
  rows: (string | number)[][],
): { monthNum: number; monthName: string; year: number } | null {
  // Scan header rows (0–11) for "PER ..." pattern
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    for (const cell of rows[i]) {
      const cellStr = String(cell).trim().toUpperCase();
      if (!cellStr.startsWith("PER ")) continue;

      // Pattern: "PER 31 JUNI 2026" or "PER 30 APRIL 2026"
      const match = cellStr.match(/^PER\s+(\d{1,2})\s+([A-Z]+)\s+(\d{4})$/);
      if (match) {
        const monthStr = match[2].toLowerCase();
        const year = parseInt(match[3]);
        const monthNum = MONTH_NAME_MAP[monthStr];
        if (monthNum !== undefined && !isNaN(year) && year > 2000) {
          return {
            monthNum: monthNum + 1, // 1-based month (1=Jan, 12=Dec)
            monthName: MONTH_INDONESIAN[monthNum],
            year,
          };
        }
      }
    }
  }

  return null;
}
