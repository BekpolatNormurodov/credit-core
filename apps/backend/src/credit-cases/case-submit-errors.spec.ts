import { caseSubmitErrors, CaseStatus, ProductType } from '@credit-core/shared';
import type { CreditCaseDto, CollateralDto } from '@credit-core/shared';

const collateral = (over: Partial<CollateralDto> = {}): CollateralDto => ({
  type: ProductType.AUTO, agreedValue: 50_000_000, agreedValueWords: null, owners: [],
  model: 'SPARK', stateNumber: '10 A 111 AA', techPassportNo: 'AAS1234567', ...over,
});

/** A fully-complete case — every required field across every gate is satisfied. */
const completeCase = (over: Partial<CreditCaseDto> = {}): CreditCaseDto => ({
  id: 'case-1',
  number: 'GEN-2026-0001',
  productType: ProductType.AUTO,
  status: CaseStatus.DRAFT,
  amount: 50_000_000,
  termMonths: 12,
  katmPrice: null,
  contractNumber: null,
  contractGlobalNo: null,
  contractYearlyNo: null,
  contractBranchSym: null,
  isReMfl: false,
  branch: null,
  createdByName: 'Operator',
  borrower: {
    fullName: 'Aliyev Ali',
    passportSeries: 'AA',
    passportNumber: '1234567',
    pinfl: '12345678901234',
    birthDate: null,
    address: null,
    phone: '+998901234567',
    closeContacts: [
      { relation: 'Ota', fullName: 'Aliyev Vali', phone: '+998901111111' },
      { relation: 'Ona', fullName: 'Aliyeva Guli', phone: '+998902222222' },
    ],
  },
  guarantors: [],
  collaterals: [collateral()],
  employment: null,
  affordability: null,
  creditLine: {
    lineNumber: null, loanType: 'MICROLOAN', amountAuto: null, amountPolis: null,
    amountTotal: 50_000_000, requiredCollateralAmount: null, requiredInsuredAmount: null,
    termMonths: 12, lineDate: null, lineMaturity: null, interestRate: null, penaltyRate: null,
    orderNumber: null, insurance: null,
    tranche: {
      trancheNo: 1, applicationNo: null, applicationDate: null, contractNo: null, contractDate: null,
      principal: 50_000_000, termMonths: 12, maturity: null, scheduleType: 'ANNUITY',
      monthlyPayment: null, paymentDay: null, insurancePayment: null,
    },
  },
  creditHistory: {
    repaidLoansCount: 0, activeLoansCount: 0, overdueSubstandardFlag: 0, otherObligations: 0,
    loansOver5MFlag: 'YO‘Q', priorMfiPawnshopFlag: 'YO‘Q', totalOutstandingDebt: 0,
    avgMonthlyPaymentExisting: 0, committeeProtocolRef: null, committeeDecisionDate: null,
  },
  documents: [],
  events: [],
  stepStartedAt: null,
  stepDeadlineAt: null,
  pausedAt: null,
  pauseUntil: null,
  deletedAt: null,
  deletedReason: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...over,
});

describe('caseSubmitErrors', () => {
  it('a fully-complete case returns no errors', () => {
    expect(caseSubmitErrors(completeCase())).toEqual([]);
  });

  it('missing pinfl is reported', () => {
    const c = completeCase({ borrower: { ...completeCase().borrower!, pinfl: '123' } });
    expect(caseSubmitErrors(c)).toContain('PINFL 14 raqam bo‘lishi kerak');
  });

  it('0 collaterals is reported — this is the ONLY thing the old gate checked', () => {
    const c = completeCase({ collaterals: [] });
    expect(caseSubmitErrors(c)).toContain('Kamida 1 ta garov majburiy');
  });

  it('an incomplete collateral is reported with the missing field label', () => {
    const c = completeCase({ collaterals: [collateral({ stateNumber: null })] });
    const errs = caseSubmitErrors(c);
    expect(errs.some((e) => e.startsWith('Garov 1:') && e.includes('Davlat raqami'))).toBe(true);
  });

  it('missing tranche principal is reported', () => {
    const base = completeCase();
    const c = completeCase({
      creditLine: { ...base.creditLine!, tranche: { ...base.creditLine!.tranche!, principal: null } },
    });
    expect(caseSubmitErrors(c)).toContain('Asosiy summa majburiy');
  });

  it('incomplete KATM section is reported', () => {
    const c = completeCase({
      creditHistory: { ...completeCase().creditHistory!, avgMonthlyPaymentExisting: null },
    });
    expect(caseSubmitErrors(c)).toContain('KATM bo‘limi to‘liq to‘ldirilishi shart');
  });

  it('amountTotal 150M (mikrokredit) with empty employment/affordability is reported', () => {
    const base = completeCase();
    const c = completeCase({
      creditLine: { ...base.creditLine!, amountTotal: 150_000_000 },
      employment: null,
      affordability: null,
    });
    expect(caseSubmitErrors(c)).toContain('Mikrokredit (100 mln+) — ish joyi va asosiy daromad majburiy');
  });

  it('amountTotal 50M (mikroqarz) with empty employment/affordability has NO employment error', () => {
    const base = completeCase();
    const c = completeCase({
      creditLine: { ...base.creditLine!, amountTotal: 50_000_000 },
      employment: null,
      affordability: null,
    });
    expect(caseSubmitErrors(c)).not.toContain('Mikrokredit (100 mln+) — ish joyi va asosiy daromad majburiy');
  });
});
