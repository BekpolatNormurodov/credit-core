import { mockCaseDoc, flattenDocText } from '../__fixtures__/case-doc.fixture';
import { DOC_REGISTRY } from '../registry';
import { monitoringTemplate } from './monitoring';

describe('monitoringTemplate (Акт мониторинга)', () => {
  const c = mockCaseDoc();

  it('renders the sheet: heading, inspector clause, property block and the two signatures', () => {
    const text = flattenDocText(monitoringTemplate(c, 6));

    expect(text).toContain('Фуқаро ЖЎЛДИБАЕВ РУСЛАН билан имзоланган');
    expect(text).toContain('гаровга кўйилган мол мулкнинг текширув.');
    expect(text).toContain('ДАЛОЛАТНОМАСИ');
    expect(text).toContain('Тошкент шахри');
    expect(text).toContain('гаровга кўйилган мол - мулкни текширдим');
    expect(text).toContain('Гаров сифатида қуйидаги мулк қабул қилинган:');
    expect(text).toContain('Гаровга қўйилган мулкни визуал текшириши унинг қониқорли холатини кўрсатди.');
    expect(text).toContain('Юқоридагиларни тасдиқлаб имзо қўювчилар:');
    expect(text).toContain('ижрочи директори');
    expect(text).toContain('Қарздор');
  });

  it('uses the monitoring sheet\'s own real-estate columns (not the act\'s)', () => {
    const text = flattenDocText(monitoringTemplate(c, 6));
    expect(text).toContain('Умумий фойдаланиш майдони');
    expect(text).not.toContain('Давлат руйхатидан утказилган ер майдони');
    expect(text).toContain('ЖАМИ');
  });

  it('states the total agreed value in Cyrillic words', () => {
    const text = flattenDocText(monitoringTemplate(c, 6)).replace(/\s/g, ' ');
    // Fixture: 200M realty + 180M auto = 380M.
    expect(text).toContain('380 000 000,00');
    expect(text).toContain('сўмни ташкил қилади');
  });

  it('inspects at the END of each period — application date 2026-01-06 + 6/12/18 months', () => {
    expect(flattenDocText(monitoringTemplate(c, 6))).toContain('06 Июль 2026 й.');
    expect(flattenDocText(monitoringTemplate(c, 12))).toContain('06 Январь 2027 й.');
    expect(flattenDocText(monitoringTemplate(c, 18))).toContain('06 Июль 2027 й.');
  });

  it('labels each act with the period it covers', () => {
    expect(flattenDocText(monitoringTemplate(c, 6))).toContain('1-6 ой мониторинги');
    expect(flattenDocText(monitoringTemplate(c, 12))).toContain('7-12 ой мониторинги');
    expect(flattenDocText(monitoringTemplate(c, 18))).toContain('13-18 ой мониторинги');
  });

  it('the three registry entries cover months 1-6, 7-12 and 13-18', () => {
    expect(flattenDocText(DOC_REGISTRY.monitoring1.build(c))).toContain('1-6 ой мониторинги');
    expect(flattenDocText(DOC_REGISTRY.monitoring2.build(c))).toContain('7-12 ой мониторинги');
    expect(flattenDocText(DOC_REGISTRY.monitoring3.build(c))).toContain('13-18 ой мониторинги');
  });

  it('does not leak a raw datetime/timestamp anywhere in any of the three periods', () => {
    for (const months of [6, 12, 18]) {
      const text = flattenDocText(monitoringTemplate(c, months));
      expect(text).not.toContain('GMT');
      expect(text).not.toMatch(/\d\d:\d\d:\d\d/);
    }
  });

  it('shows — and does not crash when there is no base date at all', () => {
    const noDate = mockCaseDoc({ creditLine: { lineDate: null, tranches: [] as any } });
    for (const months of [6, 12, 18]) {
      const text = flattenDocText(monitoringTemplate(noDate, months));
      expect(text).toContain('—');
      expect(text).not.toContain('NaN');
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
