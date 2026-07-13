import { mockCaseDoc, flattenDocText } from '../__fixtures__/case-doc.fixture';
import { DOC_REGISTRY } from '../registry';
import { monitoringTemplate } from './monitoring';

describe('monitoringTemplate', () => {
  const c = mockCaseDoc();

  it('computes the +6-month visit date off the application date (2026-01-06 → 6 iyul 2026)', () => {
    const text = flattenDocText(monitoringTemplate(c, 6));
    // dateToUzbekWords renders month names in Latin transliteration (see sum-to-words.util.ts UZ_MONTHS)
    expect(text).toContain('iyul 2026');
  });

  it('computes the application-date (0-month) visit date (2026-01-06 → 6 yanvar 2026)', () => {
    const text = flattenDocText(monitoringTemplate(c, 0));
    expect(text).toContain('yanvar 2026');
  });

  it('does not leak a raw datetime/timestamp anywhere in any of the three periods', () => {
    for (const months of [0, 6, 12]) {
      const text = flattenDocText(monitoringTemplate(c, months));
      expect(text).not.toContain('GMT');
      expect(text).not.toMatch(/\d\d:\d\d:\d\d/);
    }
  });

  it('shows — and does not crash when there is no base date at all', () => {
    const noDate = mockCaseDoc({ creditLine: { lineDate: null, tranches: [] as any } });
    for (const months of [0, 6, 12]) {
      const text = flattenDocText(monitoringTemplate(noDate, months));
      expect(text).toContain('—');
    }
  });
});

describe('monitoring registry entries', () => {
  it('all 3 monitoring build fns return a valid document definition', () => {
    const c = mockCaseDoc();
    for (const key of ['monitoring1', 'monitoring2', 'monitoring3']) {
      const def = DOC_REGISTRY[key].build(c);
      expect(def.content).toBeDefined();
    }
  });
});
