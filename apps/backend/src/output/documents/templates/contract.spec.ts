import { mockCaseDoc, flattenDocText } from '../__fixtures__/case-doc.fixture';
import { contractTemplate } from './contract';

describe('contractTemplate', () => {
  it('rounds the interest rate to a whole percent (no floating-point garbage)', () => {
    const c = mockCaseDoc({ creditLine: { interestRate: 0.55 as unknown as never } });
    const text = flattenDocText(contractTemplate(c));

    expect(text).toContain('55%');
    // The old bug rendered `Number(0.55) * 100` with no rounding -> 55.00000000000001%.
    expect(text).not.toContain('55.00000000000001');
  });

  it('shows "—" (not "NaN%") for the rate/penalty when they are missing', () => {
    const c = mockCaseDoc({
      creditLine: { interestRate: null as unknown as never, penaltyRate: null as unknown as never },
    });
    const text = flattenDocText(contractTemplate(c));

    expect(text).not.toContain('NaN%');
    expect(text).toContain('—');
  });

  it('never defaults a missing/null scheduleType to "annuitet"', () => {
    const c = mockCaseDoc({
      creditLine: { tranches: [{ scheduleType: null as unknown as never }] },
    });
    const text = flattenDocText(contractTemplate(c));

    // The old bug rendered every non-DIFFERENTIATED value (including null) as 'annuitet'.
    expect(text).not.toContain('annuitet');
    expect(text).toContain('—');
  });

  it('still renders "annuitet" when the schedule truly is ANNUITY', () => {
    const c = mockCaseDoc({ creditLine: { tranches: [{ scheduleType: 'ANNUITY' as unknown as never }] } });
    const text = flattenDocText(contractTemplate(c));

    expect(text).toContain('annuitet');
  });

  it('shows "—" for the place/date line when lineDate is missing (not a blank line)', () => {
    const c = mockCaseDoc({ creditLine: { lineDate: null as unknown as never } });
    const text = flattenDocText(contractTemplate(c));

    expect(text).toContain('Toshkent sh., —');
  });
});
