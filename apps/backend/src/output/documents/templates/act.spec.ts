import { mockCaseDoc, flattenDocText } from '../__fixtures__/case-doc.fixture';
import { money } from '../doc-layout';
import { actTemplate } from './act';

describe('actTemplate', () => {
  it('renders the real contract number in the act reference (never a hardcoded №1)', () => {
    const c = mockCaseDoc({ contractNumber: '1175/MFL' });
    const text = flattenDocText(actTemplate(c));

    expect(text).toContain('1175/MFL');
    // The old bug hardcoded the act title to end in the literal '№1'.
    expect(text).not.toContain('№1');
  });

  it('shows "—" instead of fabricating a today() date when lineDate is missing', () => {
    const c = mockCaseDoc({ creditLine: { lineDate: null as unknown as never } });
    const text = flattenDocText(actTemplate(c));

    expect(text).toContain('Тошкент ш. · —');
  });

  it('renders each collateral\'s own agreed value as a row, in addition to the lumped total', () => {
    const c = mockCaseDoc();
    const text = flattenDocText(actTemplate(c));

    // Fixture: collateral-1 (REAL_ESTATE) = 200_000_000, collateral-2 (AUTO) = 180_000_000.
    expect(text).toContain(money(200_000_000));
    expect(text).toContain(money(180_000_000));
    // The lumped total (200M + 180M, rendered via amountWords' number formatting) must still be present.
    expect(text).toContain(new Intl.NumberFormat('ru-RU').format(380_000_000));
  });

  it('renders the full 3-party signature block (lender / borrower / pledgor)', () => {
    const c = mockCaseDoc();
    const text = flattenDocText(actTemplate(c));

    expect(text).toContain('1 - тарафдан');
    expect(text).toContain('2 - тарафдан');
    expect(text).toContain('3 - тарафдан');
  });

  it('renders the collateral owner as the 3rd-party pledgor when they differ from the borrower', () => {
    const c = mockCaseDoc({
      collaterals: [{ owners: [{ fullName: 'TAYLIBAYEVA Z.Z' }] }],
    });
    const text = flattenDocText(actTemplate(c));

    // The borrower (fixture default "ЖЎЛДИБАЕВ РУСЛАН") remains the 2nd party...
    expect(text).toContain('ЖЎЛДИБАЕВ РУСЛАН');
    // ...while the 3rd-party pledgor is the collateral's own owner, not the borrower.
    expect(text).toContain('TAYLIBAYEVA Z.Z');
  });

  it('never leaks a raw datetime (no GMT string, no HH:MM:SS timestamp)', () => {
    const c = mockCaseDoc();
    const text = flattenDocText(actTemplate(c));

    expect(text).not.toContain('GMT');
    expect(text).not.toMatch(/\d\d:\d\d:\d\d/);
  });
});
