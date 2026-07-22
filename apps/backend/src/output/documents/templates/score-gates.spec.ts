import { mockCaseDoc, flattenDocText } from '../__fixtures__/case-doc.fixture';
import { scoreReportTemplate } from './score-report';

/**
 * The six gates of «Score отчет», against the formulas that produce them.
 *
 * Two of them printed wording the sheet never emits, and one tested nothing at all — the report
 * looked right on a clean case, which is why it went unnoticed.
 */
const report = (over: object) => flattenDocText(scoreReportTemplate(mockCaseDoc({ scoring: null as never, ...over })));
const gate = (text: string, label: string) => text.slice(text.indexOf(label) + label.length).trim().slice(0, 40);

describe('«Муаммоли кредитлар» — B20 = IF(C4="",I21,IF(C4=0,H21,G21))', () => {
  it('passes when there is no overdue debt', () => {
    const t = report({ creditHistory: { overdueSubstandardFlag: 0 as never } });
    expect(gate(t, 'Муаммоли кредитлар')).toContain('Талабларга мос келади');
  });

  it('refers to the committee when there is', () => {
    const t = report({ creditHistory: { overdueSubstandardFlag: 1 as never } });
    expect(gate(t, 'Муаммоли кредитлар')).toContain('Кредит қўмитаси қарорига хавола');
  });

  it('says the history is unfilled when the flag is absent', () => {
    const t = report({ creditHistory: null as never });
    expect(gate(t, 'Муаммоли кредитлар')).toContain('Кредит тарихи маълумотлари тўлдирилмаган');
  });

  it('never prints the row-20 wording, which the formula does not read', () => {
    const t = report({ creditHistory: { overdueSubstandardFlag: 1 as never } });
    expect(t).not.toContain('Муаммоли кредитлар мавжуд');
  });
});

describe('«Жорий мажбуриятлари» — B21 = IF(C3="",I22,IF(C3>=3,G22,H22))', () => {
  it('fails at three or more existing loans', () => {
    const t = report({ creditHistory: { activeLoansCount: 3 as never, overdueSubstandardFlag: 0 as never } });
    expect(gate(t, 'Жорий мажбуриятлари')).toContain('Талабларга мос келмайди');
  });

  it('passes below three', () => {
    const t = report({ creditHistory: { activeLoansCount: 2 as never, overdueSubstandardFlag: 0 as never } });
    expect(gate(t, 'Жорий мажбуриятлари')).toContain('Талабларга мос келади');
  });

  it('says the history is unfilled when the count is absent', () => {
    const t = report({ creditHistory: { activeLoansCount: null as never } });
    expect(gate(t, 'Жорий мажбуриятлари')).toContain('Кредит тарихи маълумотлари тўлдирилмаган');
  });
});

describe('«Ёшга мувофиқлиги» — B22, the gate that is live in the verdict', () => {
  const yearsAgo = (n: number) => new Date(Date.now() - n * 365.25 * 24 * 3600 * 1000);
  it('fails outside 18..68', () => {
    expect(gate(report({ borrower: { birthDate: yearsAgo(70) as never } }), 'Ёшга мувофиқлиги'))
      .toContain('Талабларга мос келмайди');
  });
  it('passes inside it', () => {
    expect(gate(report({ borrower: { birthDate: yearsAgo(40) as never } }), 'Ёшга мувофиқлиги'))
      .toContain('Талабларга мос келади');
  });
});

describe('«Даромадларнинг етарлилиги» — B19 = IF(балл!C31<0, G22, H22)', () => {
  it('fails when the tranche load exceeds income', () => {
    const t = report({ affordability: { mainActivityIncome: 1_000_000 as never, newLoanPayment: 5_000_000 as never } });
    expect(gate(t, 'Даромадларнинг етарлилиги')).toContain('Талабларга мос келмайди');
  });

  it('passes when income covers it', () => {
    const t = report({ affordability: { mainActivityIncome: 20_000_000 as never, newLoanPayment: 2_000_000 as never } });
    expect(gate(t, 'Даромадларнинг етарлилиги')).toContain('Талабларга мос келади');
  });

  it("never answers this one with a committee referral — that wording is another row's", () => {
    const t = report({ affordability: { mainActivityIncome: 1_000_000 as never, newLoanPayment: 5_000_000 as never } });
    expect(gate(t, 'Даромадларнинг етарлилиги')).not.toContain('қўмитаси');
  });
});

/*
  The two gates the sheet leaves static. It types «Талабларга мос келади» into both and never
  computes them, so on paper they pass for every case. We check them instead — confirmed with the
  office — because a line that always passes tells the reader nothing. These tests exist so that
  choice cannot be reverted by accident.
*/
describe('«Умумий шартларга» — ours, not the sheet\'s', () => {
  it('passes when the loan has an amount, a term and a rate', () => {
    const t = report({ creditLine: { amountTotal: 50_000_000 as never, termMonths: 24 as never, interestRate: 0.55 as never } });
    expect(gate(t, 'фоиз ставка)')).toContain('Талабларга мос келади');
  });

  it('fails when the rate is missing', () => {
    const t = report({ creditLine: { interestRate: null as never } });
    expect(gate(t, 'фоиз ставка)')).toContain('Талабларга мос келмайди');
  });

  it('fails when the term is missing', () => {
    const t = report({ creditLine: { termMonths: null as never } });
    expect(gate(t, 'фоиз ставка)')).toContain('Талабларга мос келмайди');
  });
});

describe('«Гаровга кўйилган талаблар» — ours, at the 140% the business requires', () => {
  it('passes when the pledges cover the property-backed portion', () => {
    const t = report({
      creditLine: { amountAuto: 100_000_000 as never },
      collaterals: [{ type: 'REAL_ESTATE', agreedValue: 140_000_000, owners: [] }] as never,
    });
    expect(gate(t, 'Гаровга кўйилган талаблар')).toContain('Талабларга мос келади');
  });

  it('fails a hair below it', () => {
    const t = report({
      creditLine: { amountAuto: 100_000_000 as never },
      collaterals: [{ type: 'REAL_ESTATE', agreedValue: 139_000_000, owners: [] }] as never,
    });
    expect(gate(t, 'Гаровга кўйилган талаблар')).toContain('Талабларга мос келмайди');
  });

  it('fails with no collateral at all', () => {
    expect(gate(report({ collaterals: [] as never }), 'Гаровга кўйилган талаблар'))
      .toContain('Талабларга мос келмайди');
  });
});
