import { mockCaseDoc, flattenDocText } from '../__fixtures__/case-doc.fixture';
import { grafikTemplate } from './grafik';

describe('grafikTemplate', () => {
  it('renders the compact installment table (headers + ИТОГО) for a scheduled tranche', () => {
    const c = mockCaseDoc();
    const text = flattenDocText(grafikTemplate(c));

    expect(text).toContain('асосий қарз');
    expect(text).toContain('фоизлар*');
    expect(text).toContain('ИТОГО');
    // No "so'm" suffix and no "Кунлар" (days) column in the compact table.
    expect(text).not.toContain("so'm");
    expect(text).not.toContain('Кунлар');
  });

  it('closes with the two-party requisites + signature block', () => {
    const text = flattenDocText(grafikTemplate(mockCaseDoc()));
    expect(text).toContain('Микромолия ташкилоти');
    expect(text).toContain('Қарздор');
    expect(text).toContain('Ижрочи директор');
  });

  it('does not leak raw Date/time formatting into the schedule dates', () => {
    const text = flattenDocText(grafikTemplate(mockCaseDoc()));
    expect(text).not.toContain('GMT');
    expect(text).not.toMatch(/\d\d:\d\d:\d\d/);
  });

  it('regenerates the schedule on-demand from tranche/line params when nothing is persisted', () => {
    const c = mockCaseDoc({ creditLine: { tranches: [{ schedule: null }] as any } });
    const text = flattenDocText(grafikTemplate(c));

    expect(text).not.toContain('Тўлов жадвали ҳисобланмаган');
    expect(text).toContain('ИТОГО');
    expect(text).not.toContain('NaN');
  });

  it('shows the guard paragraph only when inputs are insufficient (no line / amount / rate)', () => {
    const c = mockCaseDoc({ creditLine: null as any, amount: null as any, termMonths: null as any });
    const text = flattenDocText(grafikTemplate(c));

    expect(text).toContain('Тўлов жадвали ҳисобланмаган');
    expect(text).not.toContain('NaN');
  });
});
