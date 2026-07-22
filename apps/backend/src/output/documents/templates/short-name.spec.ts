import { shortName, nameInitial } from './_collateral';

describe('nameInitial — Uzbek Latin digraphs are one letter', () => {
  it('keeps sh and ch together', () => {
    expect(nameInitial('SHUXRAT')).toBe('SH');
    expect(nameInitial('Sherzod')).toBe('SH');
    expect(nameInitial('CHORI')).toBe('CH');
    expect(nameInitial('Choriyev')).toBe('CH');
  });

  it('does not split a plain s or c off a different letter', () => {
    expect(nameInitial('SARDOR')).toBe('S');
    expect(nameInitial('Suhrob')).toBe('S'); // s-u-h, not the sh digraph
    expect(nameInitial('Nasriddin')).toBe('N');
  });

  it('carries the tail of o‘ and g‘, whichever apostrophe was typed', () => {
    expect(nameInitial('O‘KTAM')).toBe('O‘');
    expect(nameInitial("O'ktam")).toBe("O'");
    expect(nameInitial('G‘AYRAT')).toBe('G‘');
  });

  it('leaves Cyrillic alone — it has no such pair', () => {
    expect(nameInitial('ШУХРАТ')).toBe('Ш');
    expect(nameInitial('Руслан')).toBe('Р');
  });

  it('copes with empty input', () => {
    expect(nameInitial('')).toBe('');
    expect(nameInitial('   ')).toBe('');
  });
});

describe('shortName', () => {
  it('abbreviates a digraph name as the letter, not the character', () => {
    expect(shortName('ISMOILOV SHUXRAT CHORIYEVICH')).toBe('ISMOILOV SH.CH.');
  });
  it('still abbreviates ordinary names', () => {
    expect(shortName('UBAYDULLAYEV ZUXRIDDIN NASRIDDINOVICH')).toBe('UBAYDULLAYEV Z.N.');
    expect(shortName('ЖЎЛДИБАЕВ РУСЛАН ОДИЛОВИЧ')).toBe('ЖЎЛДИБАЕВ Р.О.');
  });
  it('leaves a single-word name whole, and dashes an empty one', () => {
    expect(shortName('ISMOILOV')).toBe('ISMOILOV');
    expect(shortName(null)).toBe('—');
  });
});
