/**
 * Business-day helpers for SLA deadlines.
 * "Ish kuni" = Monday–Friday; Saturday/Sunday are skipped. Public holidays are
 * NOT handled (out of scope). Used by the backend to compute a step deadline and
 * by the frontend countdown to render remaining working time.
 */

const isWeekend = (d: Date): boolean => {
  const day = d.getDay(); // 0 = Sun, 6 = Sat
  return day === 0 || day === 6;
};

/**
 * Add `days` business days to `from`, preserving the time-of-day.
 * e.g. Friday 10:00 + 1 ish kuni → Monday 10:00.
 */
export function addBusinessDays(from: Date, days: number): Date {
  const result = new Date(from.getTime());
  let remaining = Math.max(0, Math.floor(days));
  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    if (!isWeekend(result)) remaining -= 1;
  }
  return result;
}

/**
 * Whole + fractional business days between `from` and `to` (can be negative when
 * `to` is in the past). Weekends contribute no time. Used for "muddati o'tgan".
 */
export function businessDaysBetween(from: Date, to: Date): number {
  if (from.getTime() === to.getTime()) return 0;
  const sign = to > from ? 1 : -1;
  const start = sign > 0 ? from : to;
  const end = sign > 0 ? to : from;
  let ms = 0;
  const cursor = new Date(start.getTime());
  while (cursor < end) {
    const next = new Date(cursor.getTime());
    next.setDate(next.getDate() + 1);
    next.setHours(0, 0, 0, 0);
    const segmentEnd = next < end ? next : end;
    if (!isWeekend(cursor)) ms += segmentEnd.getTime() - cursor.getTime();
    cursor.setTime(next.getTime());
  }
  return (sign * ms) / (24 * 60 * 60 * 1000);
}
