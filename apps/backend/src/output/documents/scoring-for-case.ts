import { scoreCase, type ScoreInput, type ScoreResult } from '@credit-core/shared';
import { CaseDocData } from './case-document.loader';

/**
 * The case's score, computed on demand.
 *
 * Nothing ever wrote the ScoringResult table, so every report printed «Скоринг ҳисобланмаган».
 * Computing it here — the way the payment schedule is computed — means the report is always
 * current and never depends on a row somebody forgot to create. A stored result, if one is ever
 * persisted, still takes precedence at the call site.
 */
export function scoringInputFor(c: CaseDocData): ScoreInput {
  const b = c.borrower;
  const emp = c.employment;
  const af = c.affordability;
  const h = c.creditHistory;
  const line = c.creditLine;
  const tr = line?.tranches?.[0];

  const n = (v: unknown): number | null => (v == null ? null : Number(v));

  /*
    балл!C27 — the monthly tranche load is what the client already pays plus what this loan will
    cost. Falls back to the tranche's own monthlyPayment when the affordability step has not been
    filled, so a half-entered case still scores something meaningful.
  */
  const newPayment = n(af?.newLoanPayment) ?? n(tr?.monthlyPayment) ?? 0;
  const existingPayment = n(af?.existingCreditBurden) ?? n(h?.avgMonthlyPaymentExisting) ?? 0;

  // балл!C28 — the sheet adds exactly two income lines (Д1!C44+C45).
  const income = (n(af?.mainActivityIncome) ?? 0) + (n(af?.secondaryIncome) ?? 0);

  // балл!C29's SUM(Д1!C46:C49) — the declared expense lines, on top of the 50% living-cost base.
  const declared =
    (n(af?.utilitiesExpense) ?? 0) + (n(af?.familyExpense) ?? 0) + (n(af?.otherExpense) ?? 0);

  return {
    gender: (b?.gender as 'MALE' | 'FEMALE' | null) ?? null,
    birthDate: b?.birthDate ?? null,
    education: b?.education ?? null,
    maritalStatus: b?.maritalStatus ?? null,
    hasAutoCollateral: (c.collaterals ?? []).some((col) => col.type === 'AUTO'),
    familySize: b?.familySize ?? null,
    // Д2!B28 — «да» when the borrower pledges their own property. With no owner entered the
    // borrower stands in (see resolveOwners), which is exactly that case.
    pledgorIsBorrower: (c.collaterals ?? []).every(
      (col) => !col.owners?.length || col.owners.some((o) => o.fullName === b?.fullName),
    ),
    residenceBand: b?.regTenure ?? null,
    sectorRiskCode: emp?.sectorRiskCode ?? null,
    position: emp?.position ?? null,
    experienceBand: emp?.experienceBand ?? null,
    housingType: b?.housingType ?? null,
    depositBand: b?.depositBand ?? null,
    activeLoansCount: h?.activeLoansCount ?? null,
    overdueSubstandardFlag: h?.overdueSubstandardFlag ?? null,
    otherObligations: h?.otherObligations ?? null,
    loansOver5MFlag: h?.loansOver5MFlag ?? null,
    priorMfiPawnshopFlag: h?.priorMfiPawnshopFlag ?? null,
    monthlyTranchePayment: newPayment + existingPayment,
    monthlyIncome: income,
    declaredExpenses: declared,
  };
}

export function scoringForCase(c: CaseDocData): ScoreResult {
  return scoreCase(scoringInputFor(c));
}
