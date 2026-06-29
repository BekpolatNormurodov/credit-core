import { LoanType, RepaymentMethod } from './enums';

/** ≤ threshold → микроқарз, > → микрокредит. */
export const MICRO_THRESHOLD = 100_000_000;
export function loanTypeFor(amount: number | null | undefined): LoanType {
  return (amount ?? 0) > MICRO_THRESHOLD ? LoanType.MICROCREDIT : LoanType.MICROLOAN;
}

/** Max term (months) per repayment method. */
export const TERM_CAP: Record<RepaymentMethod, number> = {
  [RepaymentMethod.ANNUITY]: 30,
  [RepaymentMethod.DIFFERENTIATED]: 48,
};
export function termCapFor(method: RepaymentMethod): number {
  return TERM_CAP[method] ?? TERM_CAP[RepaymentMethod.ANNUITY];
}
export function isTermValid(method: RepaymentMethod, term: number | null | undefined): boolean {
  return !!term && term > 0 && term <= termCapFor(method);
}

/** b3!M:N — activity sphere → industry-risk code (1–17). Lower code = lower risk. */
export const SECTOR_RISK: { label: string; code: number }[] = [
  { label: 'Безопасность / Военная служба / Служба спасения / Органы внутренних дел', code: 1 },
  { label: 'Недвижимость / Эксплуатация / ЖКХ', code: 2 },
  { label: 'Проектирование / Строительство', code: 3 },
  { label: 'Промышленность / Производство', code: 4 },
  { label: 'Сельское хозяйство', code: 5 },
  { label: 'Транспорт, Перевозка и хранение', code: 6 },
  { label: 'Фармацевтика / Медицина / Ветеринария', code: 7 },
  { label: 'Фитнес / Физкультура / Спорт', code: 8 },
  { label: 'Бухгалтерия / Банки / Страхование / Финансы / Инвестиции', code: 9 },
  { label: 'Бытовые услуги / Сервисные центры / Автосервис', code: 10 },
  { label: 'Телекоммуникации / Связь / Информационные технологии', code: 11 },
  { label: 'Юриспруденция', code: 12 },
  { label: 'Торговля / Продажи', code: 13 },
  { label: 'Государственная служба', code: 14 },
  { label: 'Маркетинг / Реклама / PR / GR', code: 15 },
  { label: 'Наука / Культура / Искусство', code: 16 },
  { label: 'Образование / Бизнес-образование / Консалтинг', code: 17 },
];
export function sectorRiskCode(label: string | null | undefined): number | null {
  return SECTOR_RISK.find((s) => s.label === label)?.code ?? null;
}

export interface OriginationCalcInput {
  mainActivityIncome?: number | null;
  secondaryIncome?: number | null;
  familyIncome?: number | null;
  otherIncome?: number | null;
  utilitiesExpense?: number | null;
  familyExpense?: number | null;
  otherExpense?: number | null;
  existingCreditBurden?: number | null; // b4 avg monthly payment on existing loans
  newLoanPayment?: number | null;       // tranche monthly payment
  loanUnderPolicy?: number | null;
  insuranceRate?: number | null;        // fraction, e.g. 0.02
  policyTermMonths?: number | null;
  amountTotal?: number | null;
  collateralTotal?: number | null;
}

export interface OriginationCalc {
  totalIncome: number;
  totalCreditPayments: number; // existing + new
  totalExpenses: number;       // utilities + family + other + existing + new payment
  dtiRatio: number;            // totalCreditPayments / totalIncome (0 when no income)
  surplus: number;             // totalIncome − totalExpenses
  minRequiredIncome: number;   // ROUNDUP((existing + new) × 2.2, −3)
  insuredSum: number;          // loanUnderPolicy × 1.3
  premium: number;             // insuredSum × rate ÷ 12 × policyTermMonths
  coverageRatio: number;       // collateralTotal / amountTotal (0 when no amount)
  affordabilityOk: boolean;    // surplus ≥ 0 && totalIncome ≥ minRequiredIncome
}

const n = (v: number | null | undefined): number => v ?? 0;
const roundUpTo = (x: number, unit: number): number => Math.ceil(x / unit) * unit;

export function originationCalc(i: OriginationCalcInput): OriginationCalc {
  const totalIncome = n(i.mainActivityIncome) + n(i.secondaryIncome) + n(i.familyIncome) + n(i.otherIncome);
  const totalCreditPayments = n(i.existingCreditBurden) + n(i.newLoanPayment);
  const totalExpenses = n(i.utilitiesExpense) + n(i.familyExpense) + n(i.otherExpense) + totalCreditPayments;
  const dtiRatio = totalIncome > 0 ? totalCreditPayments / totalIncome : 0;
  const surplus = totalIncome - totalExpenses;
  const minRequiredIncome = roundUpTo((n(i.existingCreditBurden) + n(i.newLoanPayment)) * 2.2, 1000);
  const insuredSum = roundUpTo(n(i.loanUnderPolicy) * 1.3, 1); // exact ×1.3
  const premium = i.policyTermMonths ? (insuredSum * n(i.insuranceRate)) / 12 * n(i.policyTermMonths) : 0;
  const coverageRatio = i.amountTotal ? n(i.collateralTotal) / n(i.amountTotal) : 0;
  const affordabilityOk = surplus >= 0 && totalIncome >= minRequiredIncome;
  return { totalIncome, totalCreditPayments, totalExpenses, dtiRatio, surplus, minRequiredIncome, insuredSum, premium, coverageRatio, affordabilityOk };
}
