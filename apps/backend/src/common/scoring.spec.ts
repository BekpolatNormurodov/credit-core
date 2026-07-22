import { scoreCase, verdictFor, ageYears, SCORE_VERDICT_LABEL, type ScoreInput } from '@credit-core/shared';

/**
 * The reference case: TURAYEV ZUFAR BAXTIYOROVICH from «ХОВЛИ мфл TRUST (3).xlsx», whose «балл»
 * sheet totals 82/100 and whose «Score отчет» prints «Маъқулланди».
 *
 * Every value below was read out of that workbook, and the per-factor expectations are its own
 * D5:D24 column. If this test drifts, our score has stopped agreeing with the sheet the office
 * checks against — which is the only thing that makes the number mean anything.
 */
const REFERENCE: ScoreInput = {
  gender: 'MALE',
  // 37.4 years at the time the sheet was computed — fixed here so the test does not age.
  birthDate: new Date(Date.now() - 37.4 * 365 * 24 * 3600 * 1000),
  education: 'урта',
  // Д1!C32 in the reference workbook — the picker's own wording, not a paraphrase.
  maritalStatus: 'турмуш курган',
  hasAutoCollateral: false,
  // The reference case pledges one property.
  collateralCount: 1,
  familySize: 3,
  pledgorIsBorrower: true,
  residenceBand: '1-5 лет (йил)',
  sectorRiskCode: 10,
  position: 'Рахбарият',
  experienceBand: 'до 3 лет',
  housingType: 'мулкий хукук',
  depositBand: 'мавжуд эмас',
  activeLoansCount: 0,
  overdueSubstandardFlag: 0,
  otherObligations: 0,
  loansOver5MFlag: 'Мавжуд эмас',
  priorMfiPawnshopFlag: 'Мавжуд эмас',
  monthlyTranchePayment: 8_106_000,
  monthlyIncome: 19_666_000,
  declaredExpenses: 600_000,
};

describe('scoreCase — parity with the reference workbook', () => {
  const r = scoreCase(REFERENCE);
  const pts = (key: string) => r.factors.find((f) => f.key === key)!.points;

  it('totals 82 out of 100, exactly as the балл sheet does', () => {
    expect(r.total).toBe(82);
    expect(r.max).toBe(100);
  });

  it('matches the sheet factor by factor (its D5:D24 column)', () => {
    expect({
      gender: pts('gender'), age: pts('age'), education: pts('education'),
      maritalStatus: pts('maritalStatus'), collateral: pts('collateral'), familySize: pts('familySize'),
      pledgor: pts('pledgor'), residence: pts('residence'), sector: pts('sector'),
      position: pts('position'), experience: pts('experience'), housing: pts('housing'),
      deposits: pts('deposits'), loanCount: pts('loanCount'), otherObligations: pts('otherObligations'),
      currentObligations: pts('currentObligations'), loansOver5M: pts('loansOver5M'),
      priorMfi: pts('priorMfi'), trancheToIncome: pts('trancheToIncome'),
      surplusToTranche: pts('surplusToTranche'),
    }).toEqual({
      gender: 1, age: 4, education: 0, maritalStatus: 3, collateral: 4, familySize: 1,
      pledgor: 3, residence: 2, sector: 5, position: 5, experience: 1, housing: 2,
      deposits: 0, loanCount: 1, otherObligations: 2, currentObligations: 5, loansOver5M: 0,
      priorMfi: 0, trancheToIncome: 22, surplusToTranche: 21,
    });
  });

  it('reproduces the sheet\'s intermediate ratios (C23, C24, C29, C30)', () => {
    expect(r.ratios.tranchePerIncome).toBeCloseTo(0.41218, 4);
    expect(r.ratios.surplusPerTranche).toBeCloseTo(1.13903, 4);
    expect(r.ratios.expenses).toBe(10_433_000);
    expect(r.ratios.surplus).toBe(9_233_000);
  });

  it('reaches the same verdict — Маъқулланди', () => {
    expect(r.verdict).toBe('APPROVED');
    expect(SCORE_VERDICT_LABEL[r.verdict]).toBe('Маъқулланди');
  });

  it('reports nothing missing — every input the sheet needs is present', () => {
    expect(r.missingCount).toBe(0);
    expect(r.factors.filter((x) => x.missing)).toEqual([]);
  });

  it('sums to exactly the total it reports', () => {
    expect(r.factors.reduce((s, f) => s + f.points, 0)).toBe(r.total);
  });
});

describe('individual bands', () => {
  const at = (o: Partial<ScoreInput>, key: string) =>
    scoreCase({ ...REFERENCE, ...o }).factors.find((f) => f.key === key)!.points;

  it('scores women higher than men, as the sheet does', () => {
    expect(at({ gender: 'FEMALE' }, 'gender')).toBe(2);
    expect(at({ gender: 'MALE' }, 'gender')).toBe(1);
  });

  it('walks the age bands, including the over-68 cliff', () => {
    const yrs = (n: number) => new Date(Date.now() - n * 365 * 24 * 3600 * 1000);
    expect(at({ birthDate: yrs(70) }, 'age')).toBe(0);
    expect(at({ birthDate: yrs(55) }, 'age')).toBe(5);
    expect(at({ birthDate: yrs(35) }, 'age')).toBe(4);
    expect(at({ birthDate: yrs(25) }, 'age')).toBe(2);
    expect(at({ birthDate: yrs(18) }, 'age')).toBe(0);
  });

  it('ranks education, with multi-degree above a single one', () => {
    expect(at({ education: 'бир нечта олий' }, 'education')).toBe(3);
    expect(at({ education: 'Олий' }, 'education')).toBe(2);
    expect(at({ education: 'урта махсус' }, 'education')).toBe(1);
    expect(at({ education: 'урта' }, 'education')).toBe(0);
  });

  it('scores a vehicle pledge below property', () => {
    expect(at({ hasAutoCollateral: true }, 'collateral')).toBe(2);
    expect(at({ hasAutoCollateral: false }, 'collateral')).toBe(4);
  });

  it('penalises an overdue loan by zeroing the current-obligations factor', () => {
    expect(at({ overdueSubstandardFlag: 1 }, 'currentObligations')).toBe(0);
    expect(at({ overdueSubstandardFlag: 0, activeLoansCount: 1 }, 'currentObligations')).toBe(4);
    expect(at({ overdueSubstandardFlag: 0, activeLoansCount: 2 }, 'currentObligations')).toBe(2);
  });

  it('applies the two −5 penalties only when the flag says the debt exists', () => {
    expect(at({ loansOver5MFlag: 'Мавжуд' }, 'loansOver5M')).toBe(-5);
    expect(at({ loansOver5MFlag: 'Мавжуд эмас' }, 'loansOver5M')).toBe(0);
    expect(at({ priorMfiPawnshopFlag: 'Мавжуд' }, 'priorMfi')).toBe(-5);
    expect(at({ priorMfiPawnshopFlag: 'Мавжуд эмас' }, 'priorMfi')).toBe(0);
  });

  it('drops the 22-point affordability factor once the tranche passes half the income', () => {
    expect(at({ monthlyTranchePayment: 9_833_000 }, 'trancheToIncome')).toBe(22); // exactly 0.5
    expect(at({ monthlyTranchePayment: 9_833_001 }, 'trancheToIncome')).toBe(0);
  });

  // Two wordings are in use — the workbook's and the wizard's dropdown — and both must band the
  // same way. "500-1000$" contains both 500 and 1000, so substring matching alone cannot do it.
  it("ranks deposit bands in the workbook's wording", () => {
    expect(at({ depositBand: '3000$ ва ундан юқори, в экв.' }, 'deposits')).toBe(3);
    expect(at({ depositBand: '1000 дан 3000$ в экв.' }, 'deposits')).toBe(2);
    expect(at({ depositBand: '500 дан 1000$ гача экв.' }, 'deposits')).toBe(1);
    expect(at({ depositBand: '500$ кам эквивалентда' }, 'deposits')).toBe(0);
    expect(at({ depositBand: 'мавжуд эмас' }, 'deposits')).toBe(0);
  });

  it("ranks deposit bands in the wizard's wording identically", () => {
    expect(at({ depositBand: '3000$+' }, 'deposits')).toBe(3);
    expect(at({ depositBand: '1000-3000$' }, 'deposits')).toBe(2);
    expect(at({ depositBand: '500-1000$' }, 'deposits')).toBe(1);
    expect(at({ depositBand: '500$ кам' }, 'deposits')).toBe(0);
    expect(at({ depositBand: 'мавжуд эмас' }, 'deposits')).toBe(0);
  });

  it("ranks marital status by the sheet's own options", () => {
    expect(at({ maritalStatus: 'турмуш курган' }, 'maritalStatus')).toBe(3);
    expect(at({ maritalStatus: 'ажрашган' }, 'maritalStatus')).toBe(2);
    expect(at({ maritalStatus: 'бўйдоқ' }, 'maritalStatus')).toBe(0);
    // A widow is none of the three and takes the else branch, as in the sheet.
    expect(at({ maritalStatus: 'бева' }, 'maritalStatus')).toBe(2);
  });

  it("ranks positions by the sheet's own options", () => {
    expect(at({ position: 'Рахбарият' }, 'position')).toBe(5);
    expect(at({ position: 'ўрта менежер' }, 'position')).toBe(4);
    expect(at({ position: 'мутахассис' }, 'position')).toBe(2);
    expect(at({ position: 'хизмат кўрсатувчи' }, 'position')).toBe(2);
  });

  it("ranks housing types from the wizard's wording", () => {
    expect(at({ housingType: 'мулкий хукук' }, 'housing')).toBe(2);
    expect(at({ housingType: 'иш берувчи берган' }, 'housing')).toBe(1);
    expect(at({ housingType: 'ижара/ётокхона' }, 'housing')).toBe(0);
  });
});

describe('verdictFor', () => {
  it('refuses below the minimum before anything else', () => {
    expect(verdictFor(59, 0)).toBe('BELOW_MIN');
    expect(verdictFor(59, 1)).toBe('BELOW_MIN');
  });
  /*
    The sheet's problem-loans branch compares a row-21 label against a row-20 one and so never
    fires. Followed as written: an overdue loan does not change the headline verdict. The report's
    «Муаммоли кредитлар» row still shows it.
  */
  it('does not stop a passing score that carries an overdue loan — as the sheet does not', () => {
    expect(verdictFor(85, 1)).toBe('APPROVED');
    expect(verdictFor(65, 1)).toBe('REFER_COMMITTEE');
  });
  it('approves at 70 and sends 60-69 to the committee', () => {
    expect(verdictFor(70, 0)).toBe('APPROVED');
    expect(verdictFor(69, 0)).toBe('REFER_COMMITTEE');
    expect(verdictFor(60, 0)).toBe('REFER_COMMITTEE');
  });
});

describe('an empty case', () => {
  it('scores without throwing, so an unfinished application still prints a report', () => {
    const r = scoreCase({});
    expect(Number.isFinite(r.total)).toBe(true);
    expect(r.factors).toHaveLength(20);
    expect(r.verdict).toBe('BELOW_MIN');
  });

  it('flags every factor as missing so a low score reads as unfinished, not refused', () => {
    const r = scoreCase({});
    expect(r.missingCount).toBe(20);
    expect(r.factors.every((x) => x.missing)).toBe(true);
  });

  /*
    The workbook's IF chains fall to their else-branch on an empty cell, so a blank sheet would
    score 31 there — «Оила аъзолари сони» alone paying its full 3 for no data at all. We refuse to,
    because a case here is read while still half-entered.
  */
  it('pays nothing at all for data that was never entered', () => {
    const r = scoreCase({});
    expect(r.total).toBe(0);
    expect(r.factors.filter((x) => x.points !== 0)).toEqual([]);
  });

  it('pays a factor only once its own input arrives', () => {
    const famOnly = scoreCase({ familySize: 1 }).factors.find((x) => x.key === 'familySize')!;
    expect(famOnly).toMatchObject({ missing: false, points: 2 });
    const famBlank = scoreCase({}).factors.find((x) => x.key === 'familySize')!;
    expect(famBlank).toMatchObject({ missing: true, points: 0 });
  });

  it('stops flagging a factor once its input arrives', () => {
    expect(scoreCase({ gender: 'FEMALE' }).factors.find((x) => x.key === 'gender')!.missing).toBe(false);
    expect(scoreCase({ collateralCount: 1 }).factors.find((x) => x.key === 'collateral')!.missing).toBe(false);
  });

  it('returns no age when there is no birth date', () => {
    expect(ageYears(null)).toBeNull();
    expect(ageYears('not a date')).toBeNull();
  });
});
