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

  it('regenerates the schedule on-demand from tranche/line params when nothing is persisted', () => {
    // No persisted schedule — but the tranche (principal/term) and line (rate) are filled, so the
    // grafik must recompute the installments live instead of showing the "hisoblanmagan" guard.
    const c = mockCaseDoc({ creditLine: { tranches: [{ schedule: null }] as any } });
    const text = flattenDocText(grafikTemplate(c));

    expect(text).not.toContain('Тўлов жадвали ҳисобланмаган');
    expect(text).toContain('ЖАМИ');
    expect(text).toContain("so'm");
    expect(text).not.toContain('NaN');
  });

  it('shows the guard paragraph only when inputs are insufficient (no line / amount / rate)', () => {
    const c = mockCaseDoc({ creditLine: null as any, amount: null as any, termMonths: null as any });
    const text = flattenDocText(grafikTemplate(c));

    expect(text).toContain('Тўлов жадвали ҳисобланмаган');
    expect(text).not.toContain('NaN');
  });
});
