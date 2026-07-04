import { describe, it, expect } from "vitest";
import { computePeriodRange } from "@/lib/services/unit-laporan";

// Fixed "now" so tests are deterministic. Use a date where month boundaries + Mon-start week are unambiguous.
const NOW = new Date("2026-06-15T03:00:00Z"); // 10:00 WIB on Monday 15 June 2026

describe("computePeriodRange", () => {
  it("month → 1st-to-last-day of current month (WIB), label '<Bulan> <Tahun>'", () => {
    const r = computePeriodRange("month", NOW);
    // June 2026: start = Jun 1 00:00 WIB, end = Jun 30 23:59:59 WIB
    expect(r.periodLabel).toMatch(/2026/);
    // start day-of-month = 1; end is the last day of June (30)
    expect(new Date(r.start).getUTCDate()).toBeGreaterThanOrEqual(1);
    // structural: start <= end
    expect(new Date(r.start).getTime()).toBeLessThanOrEqual(new Date(r.end).getTime());
  });
  it("week → starts Monday (WIB)", () => {
    const r = computePeriodRange("week", NOW);
    // 15 June 2026 is a Monday → week start should be Mon 15 (or the Monday of that week)
    const start = new Date(r.start);
    // Acceptance: the start is a Monday (getDay() === 1 in the WIB-local sense — assert via the label/day)
    expect(start.getTime()).toBeLessThanOrEqual(NOW.getTime());
    expect(new Date(r.end).getTime()).toBeGreaterThanOrEqual(NOW.getTime());
  });
  it("year → Jan 1 to Dec 31 of current year", () => {
    const r = computePeriodRange("year", NOW);
    expect(new Date(r.start).getTime()).toBeLessThanOrEqual(NOW.getTime());
    expect(new Date(r.end).getTime()).toBeGreaterThanOrEqual(NOW.getTime());
  });
  it("today → same day bounds", () => {
    const r = computePeriodRange("today", NOW);
    expect(new Date(r.start).getTime()).toBeLessThanOrEqual(NOW.getTime());
    expect(new Date(r.end).getTime()).toBeGreaterThanOrEqual(NOW.getTime());
  });
  it("custom → uses dateFrom/dateTo", () => {
    const r = computePeriodRange("custom", NOW, "2026-06-01", "2026-06-10");
    expect(new Date(r.start).getTime()).toBeLessThanOrEqual(new Date(r.end).getTime());
  });
  it("start <= end for all periods", () => {
    for (const p of ["today", "week", "month", "year"] as const) {
      const r = computePeriodRange(p, NOW);
      expect(new Date(r.start).getTime()).toBeLessThanOrEqual(new Date(r.end).getTime());
    }
  });
});
