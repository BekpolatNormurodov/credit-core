import { mockCaseDoc, flattenDocText } from '../__fixtures__/case-doc.fixture';
import { grafikTemplate } from './grafik';

describe('grafikTemplate', () => {
  it('renders the installment table (header + rows + totals) for a tranche with a schedule', () => {
    const c = mockCaseDoc();
    const text = flattenDocText(grafikTemplate(c));

    expect(text).toContain('Асосий қарз');
    expect(text).toContain('ЖАМИ');
    // 3rd installment row (seq 3) present.
    expect(text).toContain('3');
    // A formatted amount from one of the installments.
    expect(text).toContain("so'm");
  });

  it('does not leak raw Date/time formatting into the schedule dates', () => {
    const c = mockCaseDoc();
    const text = flattenDocText(grafikTemplate(c));

    expect(text).not.toContain('GMT');
    expect(text).not.toMatch(/\d\d:\d\d:\d\d/);
  });

  it('renders the guard paragraph and does not crash when the tranche has no schedule', () => {
    const c = mockCaseDoc({ creditLine: { tranches: [{ schedule: null }] as any } });
    const text = flattenDocText(grafikTemplate(c));

    expect(text).toContain('Тўлов жадвали ҳисобланмаган');
    expect(text).not.toContain('NaN');
  });

  it('renders the guard paragraph when installments are empty', () => {
    const c = mockCaseDoc({
      creditLine: { tranches: [{ schedule: { installments: [] } }] as any },
    });
    const text = flattenDocText(grafikTemplate(c));

    expect(text).toContain('Тўлов жадвали ҳисобланмаган');
  });
});
