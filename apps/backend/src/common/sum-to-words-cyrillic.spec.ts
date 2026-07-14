import { sumToWordsUzCyrillic, moneyWithWordsCyr, dateToRuCyrillic, integerToUzbekWordsCyrillic } from './sum-to-words.util';

describe('sumToWordsUzCyrillic', () => {
  it('matches the exact Cyrillic strings the Excel forms print', () => {
    expect(sumToWordsUzCyrillic(150_000_000)).toBe('Бир юз эллик миллион сўм 00 тийин');
    expect(sumToWordsUzCyrillic(90_000_000)).toBe('Тўқсон миллион сўм 00 тийин');
    expect(sumToWordsUzCyrillic(98_000_000)).toBe('Тўқсон саккиз миллион сўм 00 тийин');
    expect(sumToWordsUzCyrillic(26_000_000)).toBe('Йигирма олти миллион сўм 00 тийин');
    expect(sumToWordsUzCyrillic(126_000_000)).toBe('Бир юз йигирма олти миллион сўм 00 тийин');
    expect(sumToWordsUzCyrillic(110_000_000)).toBe('Бир юз ўн миллион сўм 00 тийин');
  });

  it('spells thousands and mixed groups', () => {
    expect(integerToUzbekWordsCyrillic(1_235_000)).toBe('бир миллион икки юз ўттиз беш минг');
    expect(integerToUzbekWordsCyrillic(0)).toBe('нол');
  });

  it('renders tiyin', () => {
    expect(sumToWordsUzCyrillic(1_000_000.5)).toBe('Бир миллион сўм 50 тийин');
  });
});

describe('moneyWithWordsCyr', () => {
  it('formats amount + Cyrillic words as the forms print it', () => {
    expect(moneyWithWordsCyr(150_000_000)).toBe('150 000 000,00 (Бир юз эллик миллион сўм 00 тийин) сўм');
  });
  it('is null-safe', () => {
    expect(moneyWithWordsCyr(null)).toBe('—');
    expect(moneyWithWordsCyr(undefined)).toBe('—');
  });
});

describe('dateToRuCyrillic', () => {
  it('prints Russian month + й. suffix', () => {
    expect(dateToRuCyrillic(new Date('2026-07-14T00:00:00.000Z'))).toBe('14 Июль 2026 й.');
    expect(dateToRuCyrillic(new Date('2026-01-01T00:00:00.000Z'))).toBe('1 Январь 2026 й.');
  });
});
