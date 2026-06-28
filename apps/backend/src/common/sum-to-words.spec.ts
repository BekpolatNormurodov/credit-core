import { integerToUzbekWords, sumToWordsUz } from './sum-to-words.util';

describe('sum-to-words (uz)', () => {
  it('converts simple integers', () => {
    expect(integerToUzbekWords(0)).toBe('nol');
    expect(integerToUzbekWords(1)).toBe('bir');
    expect(integerToUzbekWords(84)).toBe("sakson to'rt");
  });

  it('handles the valuation-act example (84 000 000)', () => {
    expect(integerToUzbekWords(84_000_000)).toBe("sakson to'rt million");
  });

  it('handles thousands and hundreds', () => {
    expect(integerToUzbekWords(123_456)).toBe(
      "bir yuz yigirma uch ming to'rt yuz ellik olti",
    );
  });

  it('formats a full prописью sum string', () => {
    expect(sumToWordsUz(84_000_000)).toBe("Sakson to'rt million so'm 00 tiyin");
  });
});
