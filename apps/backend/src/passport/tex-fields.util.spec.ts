import { extractTexFields, numberedFields, texDateToIso, findSeries, findPlate, fixUzbekText, fixBodyType, formatUzPlate, recoverAddress, recoverOwner } from './tex-fields.util';

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

describe('formatUzPlate', () => {
  it('spaces a canonical plate for display', () => expect(formatUzPlate('10Z310GB')).toBe('10 Z 310 GB'));
  it('leaves a non-plate string untouched', () => expect(formatUzPlate('')).toBe(''));
});

describe('fixUzbekText', () => {
  it('snaps region + admin-term misreads to canonical Uzbek', () => {
    // As eng OCR reads the angled tex-2 address: "KASHKADARYO" (K↔Q) and "VILOYATT" (trailing T↔I).
    expect(fixUzbekText('OZBEKISTON KASHKADARYO VILOYATT QARSHI TUMANI'))
      .toBe("O'ZBEKISTON QASHQADARYO VILOYATI QARSHI TUMANI");
  });
  it('leaves names, streets and house numbers untouched', () => {
    expect(fixUzbekText('FAROVON 23-UY IND')).toBe('FAROVON 23-UY IND');
  });
});

describe('recoverOwner', () => {
  it('recovers a name anchored on the patronymic', () => {
    expect(recoverOwner('junk noise SHAKIROV VAXABJAN TEMIROVICH more')).toBe('SHAKIROV VAXABJAN TEMIROVICH');
  });
  it('returns empty when there is no patronymic', () => {
    expect(recoverOwner('DCIMET MODELL RANDOM')).toBe('');
  });
});

describe('recoverAddress', () => {
  it('recovers the address when the "5." marker is lost, stopping before the next label', () => {
    const addr = recoverAddress("4 OWNER NAME 5 TOSHKENT VILOYATI TOSHKENT TUMANI DURMON KO'CHASI 39-UY 6 BERILGAN SANASI");
    expect(addr).toContain('TUMANI');
    expect(addr).toContain('39-UY');
    expect(addr).not.toContain('BERILGAN');
  });
  it('does NOT match the printed viloyat list (no district/street anchor)', () => {
    expect(recoverAddress('ANDIJON VILOYATI BUXORO VILOYATI JIZZAX VILOYATI NAVOIY VILOYATI')).toBe('');
  });
});

describe('fixBodyType', () => {
  it('snaps a body-type misread to the canonical spelling', () => {
    expect(fixBodyType('YENGIL SEOAN')).toBe('YENGIL SEDAN');
    expect(fixBodyType('YENGIL UNVERSAL')).toBe('YENGIL UNIVERSAL');
  });
  it('leaves an exact body type unchanged', () => {
    expect(fixBodyType('YENGIL SEDAN')).toBe('YENGIL SEDAN');
  });
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
    expect(r.fields.stateNumber).toBe('70 U 922 DB');
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
    expect(front.fields.stateNumber).toBe('70 U 922 DB');
  });
  it('recovers the year from field 8 when field 9 is misread', () => {
    const r = extractTexFields(FRONT_1, '8. 2019\n10. YENGIL SEDAN');
    expect(r.fields.year).toBe(2019);
  });
  it('fixes the white colour misread ("00" → "OQ")', () => {
    const r = extractTexFields('3. 00 BELODIMCHATIY', '');
    expect(r.fields.color).toMatch(/^OQ/);
  });
  it('recovers a model prefixed by OCR junk ("- DAMAS" → "DAMAS")', () => {
    const r = extractTexFields('2. - DAMAS', '');
    expect(r.fields.model).toBe('DAMAS');
  });
  it('strips short OCR noise tokens from a free-text field', () => {
    const r = extractTexFields('4. SEE VAYADGAN TEMIROVICH', '');
    expect(r.fields.ownerName).toBe('VAYADGAN TEMIROVICH');
  });
  it('recovers the model from a hint word when field 2 is garbled', () => {
    // OCR reads field 2 as "RF" (dropped) but the model word survives elsewhere ("…OLET SPARK…").
    const r = extractTexFields('1. 10Z310GB\n2. RF\n3. OQ\nOLET SPARK', '');
    expect(r.fields.model).toBe('SPARK');
  });
  it('prefers a known model word over a garbled field-2 value ("VOIY" → SPARK)', () => {
    // Field 2 reads garbage "VOIY"; the real model word "SPARK" is elsewhere on the front.
    const r = extractTexFields('1. OLET SPARK\n2. VOIY', '');
    expect(r.fields.model).toBe('SPARK');
  });
  it('leaves the model empty when field 2 is garbage and no known model is present', () => {
    expect(extractTexFields('2. VOIY', '').fields.model).toBe('');
  });
  it('drops a garbage issuer that has no region/admin anchor', () => {
    expect(extractTexFields('7. GERI', '').fields.issuer).toBe('');
    expect(extractTexFields("7. QASHQADARYO VILOYATI RO' VA IOB", '').fields.issuer).toContain('QASHQADARYO');
  });
  it('adds informational weights (12/13) to perField without inflating confidence', () => {
    const r = extractTexFields('', '12. 1 310.00 (KG)\n13. 790.00 (KG)');
    const byKey = Object.fromEntries(r.perField.map((p) => [p.key, p.value]));
    expect(byKey.fullWeight).toBe('1310 kg');
    expect(byKey.unladenWeight).toBe('790 kg');
    expect(r.confidence).toBe(0); // weights are informational — they must not count toward confidence
  });
  it('adds the fuel type (field 16), snapped to canonical', () => {
    const r = extractTexFields('', '16. BENZN');
    expect(Object.fromEntries(r.perField.map((p) => [p.key, p.value])).fuelType).toBe('BENZIN');
  });
});
