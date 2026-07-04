/**
 * Pure helpers for the unit laporan report (web `/api/unit/[slug]/laporan` +
 * mobile generic per-unit laporan). Fase 7b extracts the route's data logic
 * into this shared module so web + mobile call the same code.
 *
 * T1 (this file): `computePeriodRange` — the pure period-range computation,
 * faithfully ported from `src/app/api/unit/[slug]/laporan/route.ts` lines 56-96
 * (date boundaries) + lines 114-123 (periodLabel). Refactored to take `now`
 * as a param instead of reading the system clock, so it is deterministic and
 * unit-testable. NO Prisma, NO I/O, NO `new Date()` internally.
 *
 * T2 (later) will append `getUnitLaporanData`, which calls this fn.
 */

/** WIB offset in milliseconds (+7h). */
const WIB_OFFSET = 7 * 60 * 60 * 1000;

export interface PeriodRange {
  start: Date;
  end: Date;
  periodLabel: string;
  dateFromIso: string;
  dateToIso: string;
}

/**
 * Compute the [start, end] date range + human-readable label for a laporan
 * period. Behavior-preserving port of the web route's WIB (+7) period math
 * (lines 56-96 + periodLabel lines 114-123).
 *
 * @param period    "today" | "week" | "month" | "year" | "custom" (anything
 *                  not matched falls back to "month", matching the web's
 *                  `default` case).
 * @param now       The reference instant. The web route uses `new Date()`;
 *                  here it is injected so the fn is deterministic/testable.
 * @param dateFrom  YYYY-MM-DD string (required for "custom").
 * @param dateTo    YYYY-MM-DD string (required for "custom").
 */
export function computePeriodRange(
  period: string,
  now: Date,
  dateFrom?: string,
  dateTo?: string,
): PeriodRange {
  // --- WIB (+7) timezone math — faithful copy of route lines 56-62 ---
  const nowWIB = new Date(now.getTime() + WIB_OFFSET);
  // Use UTC methods to get WIB-correct date components
  const wibYear = nowWIB.getUTCFullYear();
  const wibMonth = nowWIB.getUTCMonth();
  const wibDay = nowWIB.getUTCDate();

  let dateFromComputed: Date;
  // 23:59:59 WIB = 16:59:59 UTC (route line 65)
  let dateToComputed: Date = new Date(
    Date.UTC(wibYear, wibMonth, wibDay, 23 - 7, 59, 59, 999),
  );

  switch (period) {
    case "today":
      // 00:00 WIB = 17:00 UTC hari sebelumnya (route lines 68-72)
      dateFromComputed = new Date(
        Date.UTC(wibYear, wibMonth, wibDay) - WIB_OFFSET,
      );
      dateToComputed = new Date(dateFromComputed.getTime() + 86400000 - 1);
      break;
    case "week": {
      // Senin WIB minggu ini (route lines 73-80)
      const dayOfWeek = nowWIB.getUTCDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const mondayWIB = new Date(Date.UTC(wibYear, wibMonth, wibDay + diff));
      dateFromComputed = new Date(mondayWIB.getTime() - WIB_OFFSET); // 00:00 WIB Senin
      break;
    }
    case "year":
      dateFromComputed = new Date(Date.UTC(wibYear, 0, 1) - WIB_OFFSET); // 1 Jan 00:00 WIB
      dateToComputed = new Date(Date.UTC(wibYear, 11, 31, 23 - 7, 59, 59, 999)); // 31 Des 23:59 WIB
      break;
    case "custom":
      // NOTE: the web route returns HTTP 400 if dateFrom/dateTo are missing.
      // This pure helper, having no Response object, falls back to treating
      // the (possibly undefined) input the same way the web would if it had
      // received the strings — i.e. it builds the Date from the literal.
      // Callers (route + mobile) are responsible for validating presence
      // before calling, exactly as the web route's `if (!dateFromParam)`
      // guard does. Building `new Date(undefined + ...)` yields Invalid Date;
      // that is the faithful non-fatal counterpart here and callers must
      // guard. (Web route lines 85-92.)
      dateFromComputed = new Date((dateFrom ?? "") + "T00:00:00+07:00");
      dateToComputed = new Date((dateTo ?? "") + "T23:59:59+07:00");
      break;
    default: // "month" (route lines 93-95)
      dateFromComputed = new Date(
        Date.UTC(wibYear, wibMonth, 1) - WIB_OFFSET,
      ); // 1 bulan ini 00:00 WIB
      break;
  }

  // --- periodLabel — faithful copy of route lines 114-123 ---
  // NOTE: the web route formats via `now.toLocaleDateString` / `now.getFullYear`
  // (the raw `now`, not `nowWIB`), so the label is host-tz dependent. We
  // preserve that exact behavior here; do not "fix" it to use WIB.
  const periodLabel =
    period === "today"
      ? `${now.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`
      : period === "week"
        ? `Minggu Ini (${dateFromComputed.toLocaleDateString("id-ID", { day: "numeric", month: "short" })} – ${dateToComputed.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })})`
        : period === "year"
          ? `Tahun ${now.getFullYear()}`
          : period === "custom"
            ? `${new Date(dateFrom ?? "").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })} – ${new Date(dateTo ?? "").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`
            : `${now.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}`;

  return {
    start: dateFromComputed,
    end: dateToComputed,
    periodLabel,
    dateFromIso: dateFromComputed.toISOString(),
    dateToIso: dateToComputed.toISOString(),
  };
}
