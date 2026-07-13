import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { collateralDetails } from './_shared';
import { mockCaseDoc, flattenDocText } from '../__fixtures__/case-doc.fixture';

describe('collateralDetails — techPassportDate rendering', () => {
  it('formats techPassportDate as a clean date — never a raw datetime (no 00:00:00 / GMT / ISO-T leak)', () => {
    // The fixture's AUTO collateral carries a techPassportDate (a Date), which used to be
    // interpolated raw and toString()'d to "... 00:00:00 GMT..." — the reported bug.
    const c = mockCaseDoc();
    const text = flattenDocText({ content: collateralDetails(c) } as TDocumentDefinitions);
    expect(text).not.toContain('GMT');
    expect(text).not.toMatch(/\d\d:\d\d:\d\d/); // no HH:MM:SS time part
    expect(text).not.toMatch(/T\d\d:\d\d/); // no ISO "T00:00"
    // The tech-passport line is still rendered (fixture has one) with the formatted year present.
    expect(text).not.toContain('техник паспорт рақами: —');
    expect(text).toContain('2023');
  });
});
