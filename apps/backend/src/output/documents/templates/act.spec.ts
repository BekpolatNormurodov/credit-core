import { mockCaseDoc, flattenDocText } from '../__fixtures__/case-doc.fixture';
import { actTemplate } from './act';

const norm = (s: string) => s.replace(/\s/g, ' ');

describe('actTemplate', () => {
  it('titles the act "№1" (as the Excel does) and references the real line number in the clause', () => {
    const c = mockCaseDoc({ contractNumber: '1175/MFL', creditLine: { orderNumber: 'ORD-77' as unknown as never } });
    const text = flattenDocText(actTemplate(c));
    expect(text).toContain('ГАРОВ ПРЕДМЕТИНИНГ ҚИЙМАТИНИ КЕЛИШИШ ДАЛОЛАТНОМАСИ №1');
    // The line reference inside the clause still carries the real number.
    expect(text).toContain('№ORD-77 сонли микромолиялаш линияси');
  });

  it('shows "—" instead of fabricating a today() date when lineDate is missing', () => {
    const c = mockCaseDoc({ creditLine: { lineDate: null as unknown as never } });
    const text = flattenDocText(actTemplate(c));
    expect(text).toContain('Тошкент ш.');
    expect(text).toContain('— йилдаги'); // no fabricated line date
  });

  it('renders the agreed value table with each collateral value and the total in Cyrillic words', () => {
    const c = mockCaseDoc();
    const text = norm(flattenDocText(actTemplate(c)));
    // Fixture: collateral-1 (REAL_ESTATE) = 200_000_000, collateral-2 (AUTO) = 180_000_000; total 380M.
    expect(text).toContain('200 000 000,00');
    expect(text).toContain('180 000 000,00');
    expect(text).toContain('380 000 000,00');
  });

  it('combines borrower + pledgor into one 2nd party when they are the same person', () => {
    // Fixture default: both collateral owners are the borrower ЖЎЛДИБАЕВ РУСЛАН.
    const text = flattenDocText(actTemplate(mockCaseDoc()));
    expect(text).toContain('1 - тарафдан');
    expect(text).toContain('2 - тарафдан');
    expect(text).not.toContain('3 - тарафдан');
    expect(text).toContain('«Қарз олувчи» ва «Гаровга қўювчи» (2 тараф)');
  });

  it('renders a 3rd-party pledgor when the collateral owner differs from the borrower', () => {
    const c = mockCaseDoc({ collaterals: [{ owners: [{ fullName: 'TAYLIBAYEVA ZARINA ZOKIROVNA' }] }] });
    const text = flattenDocText(actTemplate(c));
    // The Excel names parties in short form: the borrower stays the 2nd party as "ЖЎЛДИБАЕВ Р."
    expect(text).toContain('«Қарз олувчи» (2 тараф) Ўзбекистон Республикаси фуқароси ЖЎЛДИБАЕВ Р.');
    expect(text).toContain('3 - тарафдан');
    expect(text).toContain('TAYLIBAYEVA Z.Z.'); // shortName of the pledgor
  });

  it('never leaks a raw datetime (no GMT string, no HH:MM:SS timestamp)', () => {
    const text = flattenDocText(actTemplate(mockCaseDoc()));
    expect(text).not.toContain('GMT');
    expect(text).not.toMatch(/\d\d:\d\d:\d\d/);
  });
});
