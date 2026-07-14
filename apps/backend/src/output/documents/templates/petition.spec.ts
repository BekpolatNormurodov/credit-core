import { mockCaseDoc, flattenDocText } from '../__fixtures__/case-doc.fixture';
import { petitionTemplate } from './petition';

describe('petitionTemplate', () => {
  it('renders the real term/rate/penalty for a fully-populated credit line', () => {
    const c = mockCaseDoc();
    const text = flattenDocText(petitionTemplate(c));

    expect(text).toContain('24 ой');
    expect(text).toContain('55%');
    expect(text).toContain('105%');
  });

  it('binds the borrower name, amount, line number and applicant address', () => {
    const c = mockCaseDoc();
    const text = flattenDocText(petitionTemplate(c));

    expect(text).toContain(c.borrower!.fullName);
    expect(text).toContain(new Intl.NumberFormat('ru-RU').format(150_000_000));
    expect(text).toContain(c.creditLine!.lineNumber!);
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

    // The old bug hardcoded term=60/rate=55%/penalty=105% regardless of data.
    expect(text).not.toContain('60 ой');
    expect(text).not.toContain('55%');
    expect(text).not.toContain('105%');
    // No fabricated today() fallback for a missing line date — must show a placeholder instead.
    expect(text).toContain('Мурожаатнома санаси: —');
  });
});
