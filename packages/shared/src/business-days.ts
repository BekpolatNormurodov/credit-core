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
 * Uzbekistan fixed-date public holidays as "MM-DD" — non-working days. The two religious holidays
 * (Ramazon/Qurbon hayit) shift each year and are intentionally excluded here.
 */
export const UZ_HOLIDAYS = ['01-01', '01-14', '03-08', '03-21', '05-09', '09-01', '10-01', '12-08'];

/** Is `d` (UTC) one of the fixed Uzbek public holidays? */
export function isUzHoliday(d: Date): boolean {
  const mmdd = `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  return UZ_HOLIDAYS.includes(mmdd);
}

/**
 * Nudge a payment date forward to the next working day — skips Sat/Sun and the fixed Uzbek holidays.
 * UTC-based (payment dates are ISO UTC midnight). Idempotent when already a working day. Used only for
 * payment dates, NOT SLA deadlines (which stay weekends-only via addBusinessDays).
 */
export function nextPaymentBusinessDay(d: Date): Date {
  const r = new Date(d.getTime());
  const weekendUtc = (x: Date) => x.getUTCDay() === 0 || x.getUTCDay() === 6;
  while (weekendUtc(r) || isUzHoliday(r)) r.setUTCDate(r.getUTCDate() + 1);
  return r;
}

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
