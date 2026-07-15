import { mockCaseDoc, flattenDocText } from '../__fixtures__/case-doc.fixture';
import { petitionTemplate } from './petition';

describe('petitionTemplate', () => {
  it('renders the real term/rate/penalty for a fully-populated credit line', () => {
    const c = mockCaseDoc();
    const text = flattenDocText(petitionTemplate(c));

    expect(text).toContain('24 (Йигирма тўрт) ой');
    expect(text).toContain('55% (Эллик беш) фоиз');
    expect(text).toContain('105% (Бир юз беш) фоиз');
  });

  it('binds the borrower name, amount, line number and applicant address', () => {
    const c = mockCaseDoc();
    const text = flattenDocText(petitionTemplate(c));

    expect(text).toContain(c.borrower!.fullName);
    expect(text.replace(/\s/g, ' ')).toContain('150 000 000');
    expect(text).toContain(c.borrower!.regAddress!);
  });

  it('never leaks a raw datetime (toString/toISOString) into the rendered text', () => {
    const c = mockCaseDoc();
    const text = flattenDocText(petitionTemplate(c));

    expect(text).not.toContain('GMT');
    expect(text).not.toMatch(/\d\d:\d\d:\d\d/);
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
    const text = flattenDocText(petitionTemplate(c));

    // The old bug hardcoded term=60/rate=55% regardless of data. (Penalty 105% is boilerplate.)
    expect(text).not.toContain('60 (');
    expect(text).not.toContain('55% (');
    // No fabricated today() fallback for a missing line date — must show a placeholder instead.
    expect(text).toContain('Мурожаатнома санаси: —');
  });
});
