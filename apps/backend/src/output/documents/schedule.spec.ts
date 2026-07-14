import { mockCaseDoc } from './__fixtures__/case-doc.fixture';
import { scheduleForCase } from './schedule';

describe('scheduleForCase', () => {
  it('honors a persisted schedule when installments already exist', () => {
    const s = scheduleForCase(mockCaseDoc());
    expect(s).not.toBeNull();
    // The fixture persists exactly 3 installments — they must be returned as-is (not recomputed).
    expect(s!.installments).toHaveLength(3);
    expect(s!.installments[0].seq).toBe(1);
  });

  it('recomputes the schedule from tranche/line params when nothing is persisted', () => {
    const s = scheduleForCase(mockCaseDoc({
      creditLine: {
        interestRate: 0.5 as unknown as never,
        tranches: [{ principal: 12_000_000, termMonths: 12, scheduleType: 'ANNUITY', schedule: null } as any],
      },
    }));
    expect(s).not.toBeNull();
    expect(s!.installments).toHaveLength(12);
    // Annuity: the loan is fully repaid — closing balance of the last row is 0.
    const last = s!.installments[11];
    expect(Math.round(last.openingBalance - last.principal)).toBe(0);
    // Every row reconciles: total = principal + interest, no NaN.
    for (const i of s!.installments) {
      expect(i.total).toBeCloseTo(i.principal + i.interest, 4);
      expect(Number.isNaN(i.total)).toBe(false);
    }
  });

  it('splits principal evenly for the DIFFERENTIATED method', () => {
    const s = scheduleForCase(mockCaseDoc({
      creditLine: {
        interestRate: 0.4 as unknown as never,
        tranches: [{ principal: 12_000_000, termMonths: 12, scheduleType: 'DIFFERENTIATED', schedule: null } as any],
      },
    }));
    expect(s!.method).toBe('DIFFERENTIATED');
    // Equal principal each month (1 000 000), interest declines → total declines.
    expect(Math.round(s!.installments[0].principal)).toBe(1_000_000);
    expect(s!.installments[0].total).toBeGreaterThan(s!.installments[11].total);
  });

  it('advances due dates month by month on the payment day', () => {
    const s = scheduleForCase(mockCaseDoc({
      creditLine: {
        interestRate: 0.5 as unknown as never,
        tranches: [{
          principal: 6_000_000, termMonths: 3, scheduleType: 'ANNUITY',
          contractDate: new Date('2026-03-06T00:00:00.000Z') as unknown as never,
          paymentDay: 6, schedule: null,
        } as any],
      },
    }));
    const months = s!.installments.map((i) => i.dueDate.getUTCMonth());
    // April, May, June (0-indexed 3,4,5).
    expect(months).toEqual([3, 4, 5]);
  });

  it('returns null when principal / term / rate are missing', () => {
    expect(scheduleForCase(mockCaseDoc({ creditLine: null as any, amount: null as any, termMonths: null as any }))).toBeNull();
  });
});
