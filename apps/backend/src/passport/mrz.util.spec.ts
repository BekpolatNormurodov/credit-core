import { scoreConfidence, mapMrzToBorrower, yymmddToIso, extractMrzLines, MrzDetail } from './mrz.util';

const detail = (field: string, valid: boolean): MrzDetail => ({ field, value: '', valid });

describe('scoreConfidence', () => {
  const allChecks = (valid: boolean): MrzDetail[] => [
    detail('compositeCheckDigit', valid),
    detail('documentNumberCheckDigit', valid),
    detail('birthDateCheckDigit', valid),
    detail('expirationDateCheckDigit', valid),
    detail('personalNumberCheckDigit', valid),
  ];
  it('all check digits valid → 100', () => {
    expect(scoreConfidence(allChecks(true))).toBe(100);
  });
  it('composite invalid → below 90 (weighted)', () => {
    const d = allChecks(true).map((x) => (x.field === 'compositeCheckDigit' ? { ...x, valid: false } : x));
    expect(scoreConfidence(d)).toBeLessThan(90); // loses weight 4 of 12 → 67
  });
  it('no check digits → 0', () => {
    expect(scoreConfidence([detail('firstName', true)])).toBe(0);
  });
});

describe('yymmddToIso', () => {
  it('maps a past birth date (2000s)', () => {
    expect(yymmddToIso('900101', false)).toBe('1990-01-01T00:00:00.000Z');
  });
  it('rejects an impossible date', () => {
    expect(yymmddToIso('991399', false)).toBeNull();
    expect(yymmddToIso('abc', false)).toBeNull();
  });
});

describe('mapMrzToBorrower', () => {
  it('splits documentNumber, joins name, maps sex + 14-digit PINFL', () => {
    const out = mapMrzToBorrower({
      lastName: 'KARIMOV', firstName: 'ALISHER',
      documentNumber: 'AA1234567', birthDate: '900101', expirationDate: '300101',
      sex: 'male', personalNumber: '12345678901234',
    });
    expect(out.fullName).toBe('KARIMOV ALISHER');
    expect(out.passportSeries).toBe('AA');
    expect(out.passportNumber).toBe('1234567');
    expect(out.gender).toBe('MALE');
    expect(out.pinfl).toBe('12345678901234');
    expect(out.birthDate).toBe('1990-01-01T00:00:00.000Z');
  });
  it('drops a non-14-digit PINFL', () => {
    expect(mapMrzToBorrower({ personalNumber: '123' }).pinfl).toBe('');
  });
});

describe('extractMrzLines', () => {
  it('picks the two trailing MRZ lines from noisy text', () => {
    const text = [
      'REPUBLIC OF UZBEKISTAN',
      'P<UZBKARIMOV<<ALISHER<<<<<<<<<<<<<<<<<<<<<<<<',
      'AA12345670UZB9001011M3001011<<<<<<<<<<<<<<02',
    ].join('\n');
    const lines = extractMrzLines(text);
    expect(lines).toHaveLength(2);
    expect(lines[0].startsWith('P<UZB')).toBe(true);
  });
});
