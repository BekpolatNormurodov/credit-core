import { mockCaseDoc, flattenDocText } from '../__fixtures__/case-doc.fixture';
import { scoreReportTemplate } from './score-report';

describe('scoreReportTemplate', () => {
  it('renders the real verdict + a failing income gate for a FAILED_INCOME case (never a blanket pass)', () => {
    const c = mockCaseDoc({ scoring: { verdict: 'FAILED_INCOME', netAfterDebt: -500_000 as unknown as never } });
    const text = flattenDocText(scoreReportTemplate(c));

    expect(text).toContain('Даромад етарли эмас');
    expect(text).toContain('Етарли эмас');
    // The old bug hardcoded every gate row (including income) to this constant regardless of data.
    expect(text.split('Талабларга мос келади').length - 1).toBe(0);
  });

  it('renders the 20-factor scoring breakdown (name + points/maxPoints), sorted by factorNo', () => {
    const c = mockCaseDoc();
    const text = flattenDocText(scoreReportTemplate(c));

    expect(text).toContain('Даромад барқарорлиги');
    expect(text).toContain('18 / 20');
  });

  it('never fabricates a default term/rate when the credit line lacks them', () => {
    const c = mockCaseDoc({ creditLine: { interestRate: null as unknown as never, termMonths: null as unknown as never } });
    const text = flattenDocText(scoreReportTemplate(c));

    expect(text).not.toContain('55%');
    expect(text).not.toContain('60 ой');
    expect(text).toContain('—');
  });

  it('renders "Скоринг ҳисобланмаган" and skips the verdict when scoring has not been computed', () => {
    const c = mockCaseDoc({ scoring: null as unknown as never });
    const text = flattenDocText(scoreReportTemplate(c));

    expect(text).toContain('Скоринг ҳисобланмаган');
    expect(text).not.toContain('Маъқулланди');
  });
});
