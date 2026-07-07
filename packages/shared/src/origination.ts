import { LoanType, RepaymentMethod } from './enums';
import { pmt } from './loan';

/** Insurance partners currently on-boarded (the "Kompaniya" dropdown). */
export const INSURANCE_COMPANIES = ['TRUST INSURANCE', 'APEX INSURANCE'] as const;
/** Insurance is 2%/yil (default, editable) on the insured sum (×1.3 of the policy-backed loan), max 2 years. */
export const INSURANCE_ANNUAL_RATE = 0.02;
export const INSURANCE_MAX_MONTHS = 24;
/** Common gen-agreement number prefix that opens every policy number; the tail changes per policy. */
export const INSURANCE_GEN_PREFIX = '01/14/260004-';
/** Collateral must cover 140% of the property-backed loan portion (amountAuto). */
export const COLLATERAL_COVERAGE_TARGET = 1.4;

/** Relationship options for a borrower's close contacts (yaqin kishilar). */
export const RELATIVE_RELATIONS = ['Ota', 'Ona', 'Aka', 'Uka', 'Opa', 'Singil', 'Turmush o‘rtog‘i', 'Farzand', 'Qarindosh', 'Boshqa'] as const;

/** Over 100M (mikrokredit) the borrower's entrepreneur status + guvohnoma raqami is captured. */
export const ENTREPRENEUR_TYPES = ['Yakka tartibdagi tadbirkor', 'O‘zini o‘zi band qilgan'] as const;

/**
 * Monthly payment day-of-month, derived from the formalization (tranche application) date: the day
 * the client is formalized, capped at the 15th. Formalized on the 7th → pays on the 7th each month;
 * on the 20th → capped to the 15th. (Was an Excel rule; now system-computed.)
 */
export const PAYMENT_DAY_CAP = 15;
export function paymentDayFor(dateIso: string | null | undefined): number | null {
  if (!dateIso) return null;
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.min(d.getUTCDate(), PAYMENT_DAY_CAP);
}

/** ≤ threshold → микроқарз, > → микрокредит. */
export const MICRO_THRESHOLD = 100_000_000;
export function loanTypeFor(amount: number | null | undefined): LoanType {
  return (amount ?? 0) > MICRO_THRESHOLD ? LoanType.MICROCREDIT : LoanType.MICROLOAN;
}

/**
 * Representative monthly payment for a tranche, from the repayment method + principal + term + annual
 * rate (fraction, e.g. 0.55 = 55%/yil). ANNUITY → the level annuity via Excel-PMT. DIFFERENTIATED →
 * the FIRST (largest) month: principal/term + interest on the full principal (later months decline).
 * Returns null when inputs are insufficient. Rounded to whole so'm.
 */
export function monthlyPaymentFor(
  method: RepaymentMethod | null | undefined,
  principal: number | null | undefined,
  termMonths: number | null | undefined,
  annualRate: number | null | undefined,
): number | null {
  if (!method || !principal || principal <= 0 || !termMonths || termMonths <= 0) return null;
  const r = (annualRate ?? 0) / 12;
  if (method === RepaymentMethod.DIFFERENTIATED) return Math.round(principal / termMonths + principal * r);
  return Math.round(pmt(r, termMonths, principal));
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

export interface LoanRuleInput {
  scheduleType?: RepaymentMethod | null;
  trancheTermMonths?: number | null;
  lineTermMonths?: number | null;
}

/** Server-authoritative term-cap checks. Empty array = valid. */
export function loanRuleViolations(i: LoanRuleInput): string[] {
  const errs: string[] = [];
  const m = i.scheduleType ?? undefined;
  if (m && i.trancheTermMonths != null && !isTermValid(m, i.trancheTermMonths)) {
    errs.push(`Transh muddati ${termCapFor(m)} oydan oshmasligi kerak`);
  }
  if (m && i.lineTermMonths != null && !isTermValid(m, i.lineTermMonths)) {
    errs.push(`Liniya muddati ${termCapFor(m)} oydan oshmasligi kerak`);
  }
  return errs;
}

/** A moderator may act on a case only if it sits in one of their assigned branches. */
export function isCaseInScope(branchIds: string[], caseBranchId: string | null | undefined): boolean {
  return !!caseBranchId && branchIds.includes(caseBranchId);
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
  const affordabilityOk = totalIncome > 0 && surplus >= 0 && totalIncome >= minRequiredIncome;
  return { totalIncome, totalCreditPayments, totalExpenses, dtiRatio, surplus, minRequiredIncome, insuredSum, premium, coverageRatio, affordabilityOk };
}

export interface PersistedInput {
  amountTotal?: number | null;
  loanUnderPolicy?: number | null;
  insuranceRate?: number | null;
  policyTermMonths?: number | null;
  trancheMonthlyPayment?: number | null;
}
export interface PersistedDerived {
  loanType: LoanType;
  amount: number | null;
  insuredSum: number;
  premium: number;
  newLoanPayment: number | null;
}

/** Server-authoritative derived values to write to the DB columns documents read. */
export function originationPersistedValues(i: PersistedInput): PersistedDerived {
  const calc = originationCalc({
    loanUnderPolicy: i.loanUnderPolicy,
    insuranceRate: i.insuranceRate,
    policyTermMonths: i.policyTermMonths,
  });
  return {
    loanType: loanTypeFor(i.amountTotal),
    amount: i.amountTotal ?? null,
    insuredSum: calc.insuredSum,
    premium: calc.premium,
    newLoanPayment: i.trancheMonthlyPayment ?? null,
  };
}
