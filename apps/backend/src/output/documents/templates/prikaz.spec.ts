import { mockCaseDoc, flattenDocText } from '../__fixtures__/case-doc.fixture';
import { prikazTemplate } from './prikaz';

describe('prikazTemplate', () => {
  it('renders the real term/rate/penalty for a fully-populated credit line', () => {
    const c = mockCaseDoc();
    const text = flattenDocText(prikazTemplate(c));

    expect(text).toContain('24 ой');
    expect(text).toContain('55%');
    expect(text).toContain('105%');
  });

  it('never fabricates a default 60-month/55%/105% term when the credit line lacks them (and never fabricates a today() date for a missing lineDate)', () => {
    const c = mockCaseDoc({
      creditLine: {
        interestRate: null as unknown as never,
        penaltyRate: null as unknown as never,
        termMonths: null as unknown as never,
        lineDate: null as unknown as never,
      },
    });
    const text = flattenDocText(prikazTemplate(c));

    // The old bug hardcoded term=60/rate=55%/penalty=105% regardless of data, and defaulted a
    // missing lineDate to today().
    expect(text).not.toContain('60 ой');
    expect(text).not.toContain('55%');
    expect(text).not.toContain('105%');
    expect(text).toContain('—');
  });

  it('renders the issue date as a single Cyrillic phrase — no Latin month, no doubled "yil"/"йил"', () => {
    const c = mockCaseDoc();
    const text = flattenDocText(prikazTemplate(c));

    // lineDate in the fixture is 2026-01-05 -> "5 январ 2026 йилдаги".
    expect(text).toContain('5 январ 2026 йилдаги');
    // No Latin month word must leak in (the old bug rendered dateToUzbekWords' Latin "yanvar").
    expect(text).not.toMatch(/\byanvar\b/);
    expect(text).not.toContain('yil йил');
    expect(text).not.toContain('yil йилдаги');
  });

  it('prefers the credit line order number for the order №', () => {
    const c = mockCaseDoc({ creditLine: { orderNumber: 'П-123' as unknown as never } });
    const text = flattenDocText(prikazTemplate(c));

    expect(text).toContain('П-123');
  });
});
