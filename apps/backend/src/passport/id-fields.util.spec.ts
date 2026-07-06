import { ddmmyyyyToIso, extractIdFront, extractIdBackViz, mergeIdResult } from './id-fields.util';
import type { PassportScanResult } from '@credit-core/shared';

describe('ddmmyyyyToIso', () => {
  it('parses a dd.mm.yyyy date', () => {
    expect(ddmmyyyyToIso('21.01.2025')).toBe('2025-01-21T00:00:00.000Z');
  });
  it('rejects junk', () => {
    expect(ddmmyyyyToIso('x')).toBeNull();
    expect(ddmmyyyyToIso('40.13.2025')).toBeNull();
  });
});

describe('extractIdFront', () => {
  const text = [
    "O'ZBEKISTON RESPUBLIKASI",
    'SHAXS GUVOHNOMASI',
    'Familiyasi / Surname',
    'QODIROVA',
    'Ismi / Given name(s)',
    'XOLISXON',
    'Otasining ismi / Patronymic',
    'MUXTOROVNA',
    'Tugilgan sanasi / Date of birth   Jinsi / Sex',
    '08.07.1984   AYOL',
    'Berilgan sanasi / Date of issue   Fuqaroligi / Citizenship',
    "21.01.2025   O'ZBEKISTON",
    'Amal qilish muddati / Date of expiry   Karta raqami / Card number',
    '20.01.2035   AE1295616',
  ].join('\n');

  it('joins the full name including patronymic', () => {
    expect(extractIdFront(text).fullName).toBe('QODIROVA XOLISXON MUXTOROVNA');
  });
  it('reads issue date, birth date and expiry as ISO', () => {
    const f = extractIdFront(text);
    expect(f.issueDate).toBe('2025-01-21T00:00:00.000Z');
    expect(f.birthDate).toBe('1984-07-08T00:00:00.000Z');
    expect(f.expiryDate).toBe('2035-01-20T00:00:00.000Z');
  });
  it('reads the card number', () => {
    expect(extractIdFront(text).cardNumber).toBe('AE1295616');
  });
  it('is resilient to a missing patronymic', () => {
    const noPatr = text.replace('Otasining ismi / Patronymic\nMUXTOROVNA\n', '');
    expect(extractIdFront(noPatr).fullName).toBe('QODIROVA XOLISXON');
  });

  it('extracts names from real noisy OCR (dropped/garbled labels, junk tokens)', () => {
    // Verbatim from a real eng-OCR of the fixture: no "Surname" label, "EER" junk before the
    // patronymic, label words on "/"-separated lines. The layout heuristic must still win.
    const noisy = [
      "iB )'ZBEKISTON RESPUBLIKASI 3",
      'a 8 Emma SHAXS GUVOHNOMASI Sims |',
      'Wii wo QODIROVA',
      'L Lo » Tay N d i mi / Given namals)',
      ': . - p24 XOLISXON',
      'A of \\ : A) Otasining ismi | Patromyiic',
      'EER ¥ MUXTOROVNA',
      '= - BE i= Tugiigan sanasi / Date of birth Jinsi [ Sex',
      '2 pe 08.07.1984 AYOL',
    ].join('\n');
    const f = extractIdFront(noisy);
    expect(f.fullName).toBe('QODIROVA XOLISXON MUXTOROVNA');
    expect(f.birthDate).toBe('1984-07-08T00:00:00.000Z');
  });
});

const backMrz = (over: Partial<PassportScanResult['fields']> = {}): PassportScanResult => ({
  confidence: 100,
  fields: { fullName: 'QODIROVA XOLISX0O8', passportSeries: 'AE', passportNumber: '1295616', birthDate: '1984-07-08T00:00:00.000Z', passportExpiry: '2035-01-20T00:00:00.000Z', gender: 'FEMALE', nationality: "O'zbekiston Respublikasi", pinfl: '40807841080026', ...over },
  perField: [{ key: 'documentNumberCheckDigit', value: '0', valid: true }],
  format: 'TD1', rawMrz: [], warnings: [], docType: 'ID',
});

describe('extractIdBackViz', () => {
  it('cleans place of birth (drops OCR prefix noise + punctuation, garbled "Plage" label)', () => {
    const t = ['Plage of birth', "Re Al QORAKO'L TUMANI :", 'Place of issue', 'i ial atthe HV 6230 .'].join('\n');
    const v = extractIdBackViz(t);
    expect(v.placeOfBirth).toBe("QORAKO'L TUMANI");
    expect(v.issuer).toBe('HV 6230'); // code+number captured from noise; operator verifies (unverified)
  });
  it('keeps a clean issuer code and ignores a line with no code+number', () => {
    expect(extractIdBackViz(['Place of issue', 'IIV 6230'].join('\n')).issuer).toBe('IIV 6230');
    expect(extractIdBackViz(['Place of issue', 'just some words'].join('\n')).issuer).toBe('');
  });
});

describe('mergeIdResult', () => {
  const front = { fullName: 'QODIROVA XOLISXON MUXTOROVNA', issueDate: '2025-01-21T00:00:00.000Z', nationality: '', birthDate: '1984-07-08T00:00:00.000Z', expiryDate: '2035-01-20T00:00:00.000Z', cardNumber: 'AE1295616' };
  const viz = { placeOfBirth: "QORAKO'L TUMANI", issuer: 'IIV 6230' };

  it('uses MRZ numbers and the clean front name', () => {
    const r = mergeIdResult(backMrz(), front, viz);
    expect(r.fields.fullName).toBe('QODIROVA XOLISXON MUXTOROVNA');
    expect(r.fields.pinfl).toBe('40807841080026');
    expect(r.fields.passportSeries).toBe('AE');
    expect(r.fields.placeOfBirth).toBe("QORAKO'L TUMANI");
    expect(r.fields.passportIssueDate).toBe('2025-01-21T00:00:00.000Z');
    expect(r.confidence).toBe(100);
    expect(r.docType).toBe('ID');
    expect(r.unverifiedFields).toEqual(expect.arrayContaining(['fullName', 'passportIssueDate', 'placeOfBirth']));
  });
  it('flags a front/back date mismatch and keeps the MRZ value', () => {
    const r = mergeIdResult(backMrz(), { ...front, birthDate: '1990-01-01T00:00:00.000Z' }, viz);
    expect(r.warnings).toContain('front_back_mismatch');
    expect(r.fields.birthDate).toBe('1984-07-08T00:00:00.000Z');
  });
});
