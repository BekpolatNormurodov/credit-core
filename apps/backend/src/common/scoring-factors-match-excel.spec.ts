import { scoreCase, SCORE_MAX } from '@credit-core/shared';

/**
 * The factor list IS the workbook's «балл» sheet — no more, no less.
 *
 * Rows 5..24 of that sheet, with the ceilings from its E column, which sum to the 100 in E25. This
 * exists so nobody adds a twenty-first factor, renames one, or nudges a ceiling: the score only
 * means anything while it is the same twenty the office computes by hand.
 *
 * Read straight out of «ХОВЛИ мфл TRUST (3).xlsx»; the АВТО and КВАРТИРА books are
 * formula-identical.
 */
const EXCEL_ROWS: [number, string, number][] = [
  [1, 'Пол', 2],
  [2, 'Возраст', 5],
  [3, 'Образование', 3],
  [4, 'Семейное положение', 3],
  [5, 'залог', 4],
  [6, 'Количество детей', 3],
  [7, 'Залогадетель', 3],
  [8, 'Срок проживания', 3],
  [9, 'Сфера деятельности', 6],
  [10, 'Должность', 5],
  [11, 'Общий стаж', 5],
  [12, 'Наличие дома', 2],
  [13, 'Наличие депозитов', 3],
  [14, 'Колич.погаш.кредитов', 3],
  [15, 'Прочие обязательства', 2],
  [16, 'Текущие обязательства', 5],
  [17, 'Наличие кредитов свыше 5 млн. сум', 0],
  [18, 'Получал ли кредит в МКО/ломбардах ранее', 0],
  [19, 'Транш/доход', 22],
  [20, '(Доход - расход)/транш', 21],
];

describe('the factor list matches the балл sheet exactly', () => {
  const factors = scoreCase({}).factors;

  it('has exactly twenty factors, numbered as the sheet numbers its rows', () => {
    expect(factors).toHaveLength(EXCEL_ROWS.length);
    expect(factors.map((f) => f.no)).toEqual(EXCEL_ROWS.map(([no]) => no));
  });

  it('carries the same ceiling on every factor', () => {
    expect(factors.map((f) => f.max)).toEqual(EXCEL_ROWS.map(([, , max]) => max));
  });

  it('those ceilings still sum to 100, as E25 does', () => {
    expect(factors.reduce((s, f) => s + f.max, 0)).toBe(SCORE_MAX);
    expect(EXCEL_ROWS.reduce((s, [, , m]) => s + m, 0)).toBe(SCORE_MAX);
  });

  it('keeps the sheet\'s own row wording', () => {
    // Our labels may add a clarifying parenthetical, but must still start with the sheet's text.
    for (const [no, label] of EXCEL_ROWS) {
      const ours = factors.find((f) => f.no === no)!;
      expect({ no, startsWith: ours.label.startsWith(label) }).toEqual({ no, startsWith: true });
    }
  });

  it('leaves the two penalty rows unable to earn anything — they only subtract', () => {
    for (const no of [17, 18]) expect(factors.find((f) => f.no === no)!.max).toBe(0);
  });
});
