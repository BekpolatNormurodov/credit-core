import { mockCaseDoc, flattenDocText } from '../__fixtures__/case-doc.fixture';
import { obloshkaTemplate } from './obloshka';

describe('obloshkaTemplate', () => {
  it('renders the borrower name, PINFL, and collateral count', () => {
    const c = mockCaseDoc();
    const text = flattenDocText(obloshkaTemplate(c));

    expect(text).toContain('ЖЎЛДИБАЕВ РУСЛАН');
    expect(text).toContain('52101901234567');
    expect(text).toContain('2');
  });

  it('never crashes / shows NaN when the credit-line fields are missing — renders "—" instead', () => {
    const c = mockCaseDoc({
      amount: null as unknown as never,
      creditLine: {
        loanType: null as unknown as never,
        amountTotal: null as unknown as never,
        termMonths: null as unknown as never,
        interestRate: null as unknown as never,
        lineDate: null as unknown as never,
      },
    });
    const text = flattenDocText(obloshkaTemplate(c));

    expect(text).toContain('—');
    expect(text).not.toContain('NaN');
    expect(text).not.toContain('undefined');
  });
});
