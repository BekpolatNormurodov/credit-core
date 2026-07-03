import { nationalityName, NATIONALITY_OPTIONS } from '@credit-core/shared';

describe('nationalityName', () => {
  it('maps UZB to the primary Uzbek name', () => {
    expect(nationalityName('UZB')).toBe('O‘zbekiston Respublikasi');
  });
  it('maps other known codes, case-insensitively', () => {
    expect(nationalityName('rus')).toBe('Rossiya Federatsiyasi');
    expect(nationalityName('KAZ')).toBe('Qozog‘iston');
  });
  it('falls back to the raw code for an unknown nationality', () => {
    expect(nationalityName('XYZ')).toBe('XYZ');
  });
  it('returns empty string for nullish input', () => {
    expect(nationalityName(null)).toBe('');
    expect(nationalityName(undefined)).toBe('');
  });
});

describe('NATIONALITY_OPTIONS', () => {
  it('lists UZB first and Boshqa last', () => {
    expect(NATIONALITY_OPTIONS[0]).toBe('O‘zbekiston Respublikasi');
    expect(NATIONALITY_OPTIONS[NATIONALITY_OPTIONS.length - 1]).toBe('Boshqa');
  });
  it('has ~20 entries', () => {
    expect(NATIONALITY_OPTIONS.length).toBeGreaterThanOrEqual(20);
  });
});
