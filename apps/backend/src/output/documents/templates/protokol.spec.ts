import { mockCaseDoc, flattenDocText } from '../__fixtures__/case-doc.fixture';
import { protokolTemplate } from './protokol';

const norm = (s: string) => s.replace(/\s/g, ' ');

describe('protokolTemplate (Протокол — Latin sheet)', () => {
  it('renders the committee sheet: agenda, QAROR QILADI and the six resolutions', () => {
    const text = flattenDocText(protokolTemplate(mockCaseDoc()));

    expect(text).toContain('Kredit qo‘mitasining yig‘ilishi');
    expect(text).toContain('protokolidan ko‘chirma');
    expect(text).toContain('Toshkent shahri');
    expect(text).toContain('KUN TARTIBI:');
    expect(text).toContain('Mikroqarz ta’minoti:');
    expect(text).toContain('QAROR QILADI:');
    expect(text).toContain('1. Mikroqarz summasi:');
    expect(text).toContain('6. Boshqa shartlar');
  });

  it('spells sums/terms in Cyrillic and the rate in Latin, exactly as the sheet does', () => {
    const text = norm(flattenDocText(protokolTemplate(mockCaseDoc())));
    expect(text).toContain('150 000 000,00 (Бир юз эллик миллион сўм 00 тийин)');
    expect(text).toContain('24 (Йигирма тўрт) oy');
    expect(text).toContain('55% (Ellik besh ) foiz');
  });

  it('renders the vehicle table + footnotes for an AUTO collateral (never a real-estate row)', () => {
    const c = mockCaseDoc({
      collaterals: [{
        type: 'AUTO' as unknown as never,
        agreedValue: 77_000_000 as unknown as never,
        model: 'SPARK' as unknown as never,
        bodyType: 'XETCHBEK' as unknown as never,
        engineNo: 'ENG-9' as unknown as never,
        stateNumber: '01 X 001 AA' as unknown as never,
        year: 2021 as unknown as never,
        owners: [] as unknown as never,
      }],
    });
    const text = norm(flattenDocText(protokolTemplate(c)));

    expect(text).toContain('avtomobil markasi SPARK');
    expect(text).toContain('Kuzov turi va kuzov raqami*');
    expect(text).toContain('-* avtotransport egasi:');
    expect(text).toContain('-* davlat raqami: 01 X 001 AA');
    expect(text).toContain('77 000 000,00');
    expect(text).not.toContain('ko‘chmas mulk egasi');
    expect(text).toContain("6. Boshqa shartlar – avtotransport shaklida");
  });

  it('renders the real-estate table + footnotes, naming the property by its propertyType', () => {
    const c = mockCaseDoc({
      collaterals: [{
        type: 'REAL_ESTATE' as unknown as never,
        realtyKind: 'HOUSE' as unknown as never,
        propertyType: 'YAKKA TARTIBDAGI TURAR JOY' as unknown as never,
        agreedValue: 90_000_000 as unknown as never,
        cadastreNo: 'CAD-9' as unknown as never,
        address: 'Тест куча 1' as unknown as never,
        owners: [] as unknown as never,
      }],
    });
    const text = norm(flattenDocText(protokolTemplate(c)));

    expect(text).toContain('YAKKA TARTIBDAGI TURAR JOY');
    expect(text).toContain('Kadastr raqami');
    expect(text).toContain('-* ko‘chmas mulk egasi:');
    expect(text).toContain('-* manzili: Тест куча 1');
    expect(text).toContain('90 000 000,00');
    expect(text).toContain('6. Boshqa shartlar – ko‘chmas mulk shaklida');
  });

  it('never fabricates a default term / rate / date when the line lacks them', () => {
    const c = mockCaseDoc({
      creditLine: {
        termMonths: null as unknown as never,
        interestRate: null as unknown as never,
        lineDate: null as unknown as never,
      },
    });
    const text = flattenDocText(protokolTemplate(c));

    expect(text).not.toContain('60 (');
    expect(text).not.toContain('55%');
    expect(text).toContain('—');
  });
});
