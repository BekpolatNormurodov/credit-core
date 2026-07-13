import { mockCaseDoc, flattenDocText } from '../__fixtures__/case-doc.fixture';
import { money } from '../doc-layout';
import { protokolTemplate } from './protokol';

describe('protokolTemplate', () => {
  it('renders vehicle fields (not a fake apartment row) for an AUTO collateral, and its agreed value', () => {
    const c = mockCaseDoc({
      collaterals: [
        {
          id: 'collateral-x',
          caseId: 'case-1',
          type: 'AUTO',
          agreedValue: 77_000_000,
          agreedValueWords: null,
          model: 'SPARK',
          techPassportNo: 'TP-555',
          stateNumber: '01 X 001 AA',
          year: 2021,
          owners: [],
        },
      ],
    });
    const text = flattenDocText(protokolTemplate(c));

    expect(text).toContain('SPARK');
    // The old bug always rendered real-estate rows (registry/cadastre/address owner label) and
    // hardcoded the apartment description, even for an AUTO collateral.
    expect(text).not.toContain("ko'chmas mulk egasi");
    expect(text).not.toContain("KO'P QAVATLI UYDAGI XONADON");
    expect(text).toContain(money(77_000_000));
  });

  it('still renders the real-estate rows (respecting realtyKind) for a REAL_ESTATE collateral', () => {
    const c = mockCaseDoc({
      collaterals: [
        {
          id: 'collateral-y',
          caseId: 'case-1',
          type: 'REAL_ESTATE',
          agreedValue: 90_000_000,
          agreedValueWords: null,
          realtyKind: 'HOUSE',
          address: 'Тест куча 1',
          owners: [],
        },
      ],
    });
    const text = flattenDocText(protokolTemplate(c));

    expect(text).toContain('HOVLI');
    expect(text).not.toContain("KO'P QAVATLI UYDAGI XONADON");
    expect(text).toContain(money(90_000_000));
  });

  it('never fabricates a default 60-month term / 55% rate, or a today() date, when the line lacks them', () => {
    const c = mockCaseDoc({
      creditLine: {
        termMonths: null as unknown as never,
        interestRate: null as unknown as never,
        lineDate: null as unknown as never,
      },
    });
    const text = flattenDocText(protokolTemplate(c));

    expect(text).not.toContain('60 oy');
    expect(text).not.toContain('55%');
    expect(text).toContain('Toshkent shahri · —');
  });
});
