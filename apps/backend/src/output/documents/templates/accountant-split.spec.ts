import { mockCaseDoc, flattenDocText } from '../__fixtures__/case-doc.fixture';
import { accountantSplitTemplate } from './accountant-split';

describe('accountantSplitTemplate', () => {
  it('renders the 35/20/15 amount split as money, not percentages', () => {
    const c = mockCaseDoc({
      creditLine: {
        amountAuto: 20_000_000 as unknown as never,
        amountPolis: 15_000_000 as unknown as never,
        amountTotal: 35_000_000 as unknown as never,
      },
    });
    const text = flattenDocText(accountantSplitTemplate(c));

    expect(text).toContain('35');
    expect(text).toContain('20');
    expect(text).toContain('15');
    expect(text).not.toContain('%');
  });

  it('labels the garov portion "Автотранспорт" when the collateral is a vehicle', () => {
    const c = mockCaseDoc({ collaterals: [{ type: 'AUTO' as unknown as never }] });
    const text = flattenDocText(accountantSplitTemplate(c));
    expect(text).toContain('Автотранспорт');
    expect(text).not.toContain('Мол-мулк қисми');
  });

  it('labels the garov portion "Мол-мулк" when the collateral is real estate', () => {
    const c = mockCaseDoc({ collaterals: [{ type: 'REAL_ESTATE' as unknown as never }] });
    const text = flattenDocText(accountantSplitTemplate(c));
    expect(text).toContain('Мол-мулк қисми');
  });

  it('embeds the beneficiary card / bank requisites (grouped 4-4-4-4 card)', () => {
    const c = mockCaseDoc({
      disbursement: {
        holderName: 'IVANOV I' as unknown as never,
        cardNumber: '5614681810235717' as unknown as never,
        bankMfo: '00083' as unknown as never,
        bankName: 'Xalq banki' as unknown as never,
      },
    });
    const text = flattenDocText(accountantSplitTemplate(c));
    expect(text).toContain('IVANOV I');
    expect(text).toContain('5614 6818 1023 5717');
    expect(text).toContain('00083');
    expect(text).toContain('Xalq banki');
  });

  it('never crashes / shows NaN when the credit line is missing — renders "—" instead', () => {
    const c = mockCaseDoc({ creditLine: null as unknown as never, amount: null as unknown as never });
    const text = flattenDocText(accountantSplitTemplate(c));

    expect(text).toContain('—');
    expect(text).not.toContain('NaN');
  });
});
