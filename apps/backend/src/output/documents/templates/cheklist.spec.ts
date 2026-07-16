import { mockCaseDoc, flattenDocText } from '../__fixtures__/case-doc.fixture';
import { cheklistTemplate } from './cheklist';

describe('cheklistTemplate (перечень)', () => {
  it('renders the fixed 16-row filing list with the Excel column headers', () => {
    const text = flattenDocText(cheklistTemplate(mockCaseDoc()));

    expect(text).toContain('МФЛ бўйича хужжатлар кетма кетлиги');
    expect(text).toContain('№ т/р');
    expect(text).toContain('Хужжат номланиши');
    expect(text).toContain('Экз сони');
    expect(text).toContain('Варок');
    // First and last items, in the Excel's filing order.
    expect(text).toContain('Мижоз бирламчи хужжатлари');
    expect(text).toContain('МФЛ очиш бўйича бош келишув');
    expect(text).toContain('Претензионный');
    expect(text).toContain('16');
  });

  it('keeps the passport note on row 1 and closes with the credit-manager signature', () => {
    const text = flattenDocText(cheklistTemplate(mockCaseDoc()));
    expect(text).toContain('Аслидан нусха олинди');
    expect(text).toContain('Кредит менежери имзоси:');
  });

  it('is a static form — identical regardless of the case data', () => {
    const a = flattenDocText(cheklistTemplate(mockCaseDoc()));
    const b = flattenDocText(cheklistTemplate(mockCaseDoc({ documents: [] as unknown as never, contractNumber: 'X-999' })));
    expect(a).toBe(b);
  });
});
