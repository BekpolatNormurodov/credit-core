import { nextPaymentBusinessDay, isUzHoliday } from '@credit-core/shared';

const d = (iso: string) => new Date(iso + 'T00:00:00.000Z');

describe('nextPaymentBusinessDay (weekends + UZ holidays)', () => {
  it('keeps a normal working day unchanged', () => {
    // 2026-07-15 is a Wednesday, not a holiday.
    expect(nextPaymentBusinessDay(d('2026-07-15')).toISOString()).toBe('2026-07-15T00:00:00.000Z');
  });
  it('moves a Sunday to Monday', () => {
    // 2026-07-12 is a Sunday → 2026-07-13 (Mon).
    expect(nextPaymentBusinessDay(d('2026-07-12')).toISOString()).toBe('2026-07-13T00:00:00.000Z');
  });
  it('moves a holiday to the next working day', () => {
    // 2026-01-01 (New Year, Thu) → 2026-01-02 (Fri).
    expect(nextPaymentBusinessDay(d('2026-01-01')).toISOString()).toBe('2026-01-02T00:00:00.000Z');
  });
  it('skips a holiday landing on Friday over the weekend', () => {
    // 2027-01-01 is a Friday (holiday) → skip Sat/Sun → 2027-01-04 (Mon).
    expect(nextPaymentBusinessDay(d('2027-01-01')).toISOString()).toBe('2027-01-04T00:00:00.000Z');
  });
  it('recognises the 8 fixed holidays', () => {
    for (const iso of ['2026-01-14', '2026-03-08', '2026-03-21', '2026-05-09', '2026-09-01', '2026-10-01', '2026-12-08']) {
      expect(isUzHoliday(d(iso))).toBe(true);
    }
    expect(isUzHoliday(d('2026-07-15'))).toBe(false);
  });
});
