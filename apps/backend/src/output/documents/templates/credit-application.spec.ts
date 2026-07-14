import { mockCaseDoc, flattenDocText } from '../__fixtures__/case-doc.fixture';
import { creditApplicationTemplate } from './credit-application';

describe('creditApplicationTemplate (Микроқарз олиш учун АРИЗА)', () => {
  it('renders the application header, terms in Cyrillic words, and consent list', () => {
    const text = flattenDocText(creditApplicationTemplate(mockCaseDoc()));
    expect(text).toContain('Микроқарз олиш учун');
    expect(text).toContain('АРИЗА');
    expect(text).toContain('Микроқарз суммаси: 150 000 000,00 (Бир юз эллик миллион сўм 00 тийин) сўм');
    expect(text).toContain('Микроқарз муддати: 24 (Йигирма тўрт) ойгача');
    expect(text).toContain('55% (Эллик беш) фоиз');
    expect(text).toContain('кредит ахборотлари давлат реестри');
  });

  it('includes the full auto collateral detail for a vehicle case', () => {
    const c = mockCaseDoc({
      collaterals: [{
        type: 'AUTO' as unknown as never,
        model: 'CHEVROLET COBALT' as unknown as never,
        bodyType: 'YENGIL SEDAN' as unknown as never,
        engineNo: 'ENG123' as unknown as never,
        stateNumber: '01 P 083 SC' as unknown as never,
        agreedValue: 98_000_000 as unknown as never,
        owners: [{ fullName: 'UBAYDULLAYEV ZUXRIDDIN NASRIDDINOVICH' } as unknown as never],
      }],
    });
    const text = flattenDocText(creditApplicationTemplate(c));
    expect(text).toContain('тип кузова - YENGIL SEDAN');
    expect(text).toContain('двигатель №ENG123');
    expect(text).toContain('CHEVROLET COBALT');
    // Auto-only → the insurance polis line is hidden.
    expect(text).not.toContain('Суғурта полисининг қиймати');
  });

  it('shows the insurance polis line for a real-estate (non auto-only) case', () => {
    const c = mockCaseDoc({
      collaterals: [{ type: 'REAL_ESTATE' as unknown as never, realtyKind: 'HOUSE' as unknown as never, agreedValue: 126_000_000 as unknown as never, owners: [] as unknown as never }],
      creditLine: { amountPolis: 26_000_000 as unknown as never, insurance: { insuredSum: 26_000_000 as unknown as never } },
    });
    const text = flattenDocText(creditApplicationTemplate(c));
    expect(text).toContain('Суғурта полисининг қиймати');
    expect(text).toContain('Йигирма олти миллион');
  });

  it('is null-safe when the credit line is missing', () => {
    const text = flattenDocText(creditApplicationTemplate(mockCaseDoc({ creditLine: null as unknown as never, amount: null as unknown as never })));
    expect(text).toContain('АРИЗА');
    expect(text).not.toContain('NaN');
  });
});
