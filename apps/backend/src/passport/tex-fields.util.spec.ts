import { extractTexFields, numberedFields, texDateToIso, findSeries, findPlate } from './tex-fields.util';

// Transcribed roughly as the eng OCR reads the two sample certificates (Downloads/tex-1*.jpg).
const FRONT_1 = `AVTOMOTOTRANSPORT VOSITASI
RO'YXATDAN O'TKAZILGANLIGI
TO'G'RISIDA GUVOHNOMA
1. 70U922DB
2. DAMAS
3. OQ BELODIMCHATIY
4. RAMZIDDIN BAXRIYEV IXTIYOR O'G'LI
5. OZBEKISTON KASHQADARYO VILOYATI QARSHI TUMANI FAROVON KO'CHASI 23-UY IND
6. 01.12.2025
7. QASHQADARYO VILOYATI RO' VA IOB
8. 37703865740060`;

const BACK_1 = `VL8011449
AA9747835B
9. 2019
10. YENGIL SEDAN
11. XWB7T12YDLP165062 / RAKAMSIZ
12. 1 310.00 (KG)
13. 790.00 (KG)
14. F8CB191160056
15. 38
16. GBASPG
19. OSSH 2025-11-05`;

describe('texDateToIso', () => {
  it('parses dd.mm.yyyy', () => expect(texDateToIso('01.12.2025')).toBe('2025-12-01'));
  it('parses yyyy-mm-dd', () => expect(texDateToIso('OSSH 2025-11-05')).toBe('2025-11-05'));
  it('returns null when absent', () => expect(texDateToIso('no date here')).toBeNull());
});

describe('findSeries', () => {
  it('finds the certificate series token', () => expect(findSeries(BACK_1)).toBe('VL8011449'));
  it('ignores a 14-digit reg number (no letters)', () => expect(findSeries('8. 37703865740060')).toBe(''));
});

describe('findPlate', () => {
  it('finds a clean Uzbek plate anywhere in the text', () => expect(findPlate('junk 70U922DB more')).toBe('70U922DB'));
  it('stays empty for a garbled plate read (no clean match)', () => expect(findPlate('70UGZ2D8 noise')).toBe(''));
});

describe('numberedFields', () => {
  it('reads clean "N. value" lines', () => {
    const m = numberedFields(FRONT_1);
    expect(m.get(1)).toBe('70U922DB');
    expect(m.get(5)).toContain('FAROVON');
  });
  it('tolerates comma separators and leading OCR garbage', () => {
    // Real OCR prefixes background noise before the number and reads the dot as a comma.
    const m = numberedFields('ae & 10. YENGIL SEDAN gas\nCELE 4, 7QUB2208 oe');
    expect(m.get(10)).toContain('YENGIL');
    expect(m.get(4)).toContain('7QUB2208');
  });
  it('appends continuation lines to a wrapping text field (address)', () => {
    const m = numberedFields('5. TOSHKENT SHAHAR\nCHILONZOR TUMANI 12-UY\n6. 01.01.2020');
    expect(m.get(5)).toContain('CHILONZOR');
    expect(m.get(5)).toContain('12-UY');
    expect(m.get(6)).toBe('01.01.2020');
  });
});

describe('extractTexFields', () => {
  const r = extractTexFields(FRONT_1, BACK_1);
  it('reads the front fields', () => {
    expect(r.fields.stateNumber).toBe('70U922DB');
    expect(r.fields.model).toBe('DAMAS');
    expect(r.fields.color).toBe('OQ BELODIMCHATIY');
    expect(r.fields.ownerName).toContain('RAMZIDDIN');
    expect(r.fields.address).toContain('FAROVON');
    expect(r.fields.techPassportDate).toBe('2025-12-01');
  });
  it('reads the back fields', () => {
    expect(r.fields.year).toBe(2019);
    expect(r.fields.bodyType).toBe('YENGIL SEDAN');
    expect(r.fields.bodyNo).toBe('XWB7T12YDLP165062');
    expect(r.fields.chassis).toMatch(/RAKAMSIZ/);
    expect(r.fields.engineNo).toBe('F8CB191160056');
    expect(r.fields.techPassportNo).toBe('VL8011449');
  });
  it('is high confidence when the key fields are present', () => {
    expect(r.confidence).toBeGreaterThanOrEqual(80);
    expect(r.warnings).not.toContain('tex_not_found');
  });
  it('flags a missing back', () => {
    const front = extractTexFields(FRONT_1, '');
    expect(front.warnings).toContain('back_not_found');
    expect(front.fields.bodyNo).toBe('');
    expect(front.fields.stateNumber).toBe('70U922DB');
  });
  it('recovers the year from field 8 when field 9 is misread', () => {
    const r = extractTexFields(FRONT_1, '8. 2019\n10. YENGIL SEDAN');
    expect(r.fields.year).toBe(2019);
  });
});
