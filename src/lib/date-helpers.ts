/**
 * Safely add months to a Date without month-end overflow.
 *
 * JS `setMonth()` has a known bug: Jan 31 + 1 month → Mar 3 (overflow).
 * This helper clamps the day to the target month's last day.
 *
 * Examples:
 *   addMonths(new Date('2024-01-31'), 1) → 2024-02-29 (leap year)
 *   addMonths(new Date('2024-03-31'), 1) → 2024-04-30
 *   addMonths(new Date('2024-01-15'), 6) → 2024-07-15
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getDate();
  result.setDate(1); // prevent overflow during setMonth
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0
  ).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
}
