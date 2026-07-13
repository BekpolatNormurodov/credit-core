import { mockCaseDoc, flattenDocText } from '../__fixtures__/case-doc.fixture';
import { accountantSplitTemplate } from './accountant-split';

describe('accountantSplitTemplate', () => {
  it('renders the 35/20/15 amount split as money, not percentages', () => {
    const c = mockCaseDoc({
      creditLine: {
        amountAuto: 20_000_000 as unknown as never,
        amountPolis: 15_000_000 as unknown as never,
        amountTotal: 35_000_000 as unknown as never,
        insurance: { insuredSum: 15_000_000 as unknown as never },
      },
    });
    const text = flattenDocText(accountantSplitTemplate(c));

    expect(text).toContain('35');
    expect(text).toContain('20');
    expect(text).toContain('15');
    expect(text).not.toContain('%');
  });

  it('never crashes / shows NaN when the credit line is missing — renders "—" instead', () => {
    const c = mockCaseDoc({ creditLine: null as unknown as never, amount: null as unknown as never });
    const text = flattenDocText(accountantSplitTemplate(c));

    expect(text).toContain('—');
    expect(text).not.toContain('NaN');
  });
});
