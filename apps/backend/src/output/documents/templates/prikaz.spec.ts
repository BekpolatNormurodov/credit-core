import { mockCaseDoc, flattenDocText } from '../__fixtures__/case-doc.fixture';
import { prikazTemplate } from './prikaz';

describe('prikazTemplate', () => {
  it('renders the real term/rate/penalty for a fully-populated credit line', () => {
    const c = mockCaseDoc();
    const text = flattenDocText(prikazTemplate(c));

    expect(text).toContain('24 (Йигирма тўрт) ой');
    expect(text).toContain('55% (Эллик беш) фоиз');
    expect(text).toContain('105% (Бир юз беш) фоиз');
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

    // The old bug hardcoded term=60/rate=55% regardless of data. (Penalty 105% is boilerplate in
    // every reference form, so it always appears.)
    expect(text).not.toContain('60 (');
    expect(text).not.toContain('55% (');
    expect(text).toContain('—');
  });

  it('renders the issue date as a Cyrillic/Russian-month phrase — no Latin month, no GMT leak', () => {
    const c = mockCaseDoc();
    const text = flattenDocText(prikazTemplate(c));

    // lineDate in the fixture is 2026-01-05 -> "5 Январь 2026 й. йилдаги".
    expect(text).toContain('5 Январь 2026 й. йилдаги');
    expect(text).not.toMatch(/\byanvar\b/);
    expect(text).not.toContain('GMT');
  });

  it('prefers the credit line order number for the order №', () => {
    const c = mockCaseDoc({ creditLine: { orderNumber: 'П-123' as unknown as never } });
    const text = flattenDocText(prikazTemplate(c));

    expect(text).toContain('П-123');
  });
});
