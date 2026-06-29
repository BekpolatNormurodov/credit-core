import { originationCalc, loanTypeFor, type UpsertCasePayload } from '@credit-core/shared';
import { Card } from '../../components/primitives';
import { formatMoney } from '../../lib/cn';

/** Live, sticky affordability + economics summary shown beside the wizard. */
export function Summary({ form }: { form: UpsertCasePayload }) {
  const af = form.affordability;
  const ins = form.creditLine?.insurance;
  const collateralTotal = form.collaterals.reduce((s, c) => s + (c.agreedValue ?? 0), 0);
  const amountTotal = form.creditLine?.amountTotal ?? form.amount;
  const calc = originationCalc({
    mainActivityIncome: af?.mainActivityIncome, secondaryIncome: af?.secondaryIncome, familyIncome: af?.familyIncome, otherIncome: af?.otherIncome,
    utilitiesExpense: af?.utilitiesExpense, familyExpense: af?.familyExpense, otherExpense: af?.otherExpense, existingCreditBurden: af?.existingCreditBurden,
    newLoanPayment: form.creditLine?.tranche?.monthlyPayment,
    loanUnderPolicy: ins?.loanUnderPolicy, insuranceRate: ins?.insuranceRate, policyTermMonths: ins?.policyTermMonths,
    amountTotal, collateralTotal,
  });
  const loanType = loanTypeFor(amountTotal);

  const row = (label: string, value: string, danger = false) => (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className={`nums font-semibold ${danger ? 'text-error-600 dark:text-error-500' : 'text-gray-800 dark:text-white'}`}>{value}</span>
    </div>
  );

  return (
    <Card className="sticky top-4 space-y-0.5">
      <h3 className="mb-2 font-semibold text-gray-800 dark:text-white">Xulosa</h3>
      {row('Kredit turi', loanType === 'MICROCREDIT' ? 'Mikrokredit' : 'Mikroqarz')}
      {row('Jami daromad', formatMoney(calc.totalIncome))}
      {row('Jami xarajat', formatMoney(calc.totalExpenses))}
      {row('DTI (qarz yuki)', `${(calc.dtiRatio * 100).toFixed(1)}%`)}
      {row('Surplus', formatMoney(calc.surplus), calc.surplus < 0)}
      {row('Min kerakli daromad', formatMoney(calc.minRequiredIncome))}
      {row('Sug‘urta puli', formatMoney(calc.premium))}
      {row('Garov qoplami', amountTotal ? `${(calc.coverageRatio * 100).toFixed(0)}%` : '—')}
      {!calc.affordabilityOk && (calc.totalIncome > 0) && (
        <p className="mt-2 rounded-lg bg-error-50 px-3 py-2 text-xs font-medium text-error-700 dark:bg-error-600/10 dark:text-error-400">
          Daromad yetarli emas (surplus manfiy yoki 2.2× dan past) — ko‘rib chiqing.
        </p>
      )}
    </Card>
  );
}
