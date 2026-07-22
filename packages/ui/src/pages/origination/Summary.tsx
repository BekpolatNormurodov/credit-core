import { useState } from 'react';
import {
  originationCalc, loanTypeFor, scoreForCase, SCORE_VERDICT_LABEL,
  type ScorableCase, type UpsertCasePayload,
} from '@credit-core/shared';
import { Card } from '../../components/primitives';
import { ChevronDown } from '../../lib/icons';
import { cn, formatMoney } from '../../lib/cn';

/** Tone for the score total — matches the verdict bands (<60 refuse, 70+ approve). */
function scoreTone(verdict: string): string {
  if (verdict === 'APPROVED') return 'text-success-700 dark:text-success-400';
  if (verdict === 'BELOW_MIN' || verdict === 'FAILED_PROBLEM_LOANS') return 'text-error-600 dark:text-error-500';
  return 'text-warning-700 dark:text-warning-400';
}

/**
 * The score, factor by factor, folded away until asked for.
 *
 * The total on its own invites "why 82?" and there is no way to answer it from the screen — the
 * weights live in a workbook. Each row here is one line of the «балл» sheet, numbered as it is
 * there, so a disputed score can be traced to the exact band that produced it.
 */
function ScoreBreakdown({ form }: { form: UpsertCasePayload }) {
  const [open, setOpen] = useState(false);
  const r = scoreForCase(form as unknown as ScorableCase);

  return (
    <div className="mt-2 border-t border-gray-200 pt-2 dark:border-white/10">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between gap-3 py-1.5 text-left"
      >
        <span className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
          Skoring balli
          <ChevronDown className={cn('h-4 w-4 transition', open && 'rotate-180')} />
        </span>
        <span className={cn('nums font-bold', scoreTone(r.verdict))}>
          {r.total} / {r.max}
        </span>
      </button>

      <p className={cn('pb-1 text-right text-xs font-medium', scoreTone(r.verdict))}>
        {SCORE_VERDICT_LABEL[r.verdict]}
      </p>

      {open && (
        <div className="mt-1 space-y-px rounded-lg bg-gray-50 p-2 dark:bg-white/5">
          {r.factors.map((f) => (
            <div key={f.key} className="flex items-baseline justify-between gap-2 py-0.5 text-xs">
              <span className="min-w-0 text-gray-500 dark:text-gray-400">
                <span className="mr-1 tabular-nums text-gray-400 dark:text-gray-500">{f.no}.</span>
                {f.label}
              </span>
              <span
                className={cn(
                  'nums shrink-0 font-semibold',
                  // A penalty and a zero mean different things: one lost you points, the other
                  // never had any to give.
                  f.points < 0 ? 'text-error-600 dark:text-error-500'
                    : f.points === 0 ? 'text-gray-400 dark:text-gray-500'
                      : f.points === f.max ? 'text-success-700 dark:text-success-400'
                        : 'text-gray-700 dark:text-gray-200',
                )}
              >
                {f.points} / {f.max}
              </span>
            </div>
          ))}
          <p className="mt-1.5 border-t border-gray-200 pt-1.5 text-[11px] leading-relaxed text-gray-400 dark:border-white/10 dark:text-gray-500">
            0 ball — ma’lumot kiritilmagan yoki shart bajarilmagan. Oxirgi ikkitasi (transh/daromad)
            43 ballni tashkil qiladi.
          </p>
        </div>
      )}
    </div>
  );
}

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
    requiredInsuredAmount: form.creditLine?.requiredInsuredAmount,
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
      <div className={`mb-2 flex items-center justify-between rounded-xl px-3 py-2 ${loanType === 'MICROCREDIT'
        ? 'bg-warning-50 dark:bg-warning-500/10'
        : 'bg-brand-50 dark:bg-brand-500/10'}`}>
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Kredit turi</span>
        <span className={`text-base font-bold ${loanType === 'MICROCREDIT' ? 'text-warning-700 dark:text-warning-400' : 'text-brand-700 dark:text-brand-400'}`}>
          {loanType === 'MICROCREDIT' ? 'Mikrokredit' : 'Mikroqarz'}
        </span>
      </div>
      {row('Jami summa', amountTotal ? formatMoney(amountTotal) : '—')}
      {row('Transh muddati', form.creditLine?.tranche?.termMonths ? `${form.creditLine.tranche.termMonths} oy` : '—')}
      {row('Oylik to‘lov', form.creditLine?.tranche?.monthlyPayment ? formatMoney(form.creditLine.tranche.monthlyPayment) : '—')}
      {row('To‘lov kuni', form.creditLine?.tranche?.paymentDay ? `Har oyning ${form.creditLine.tranche.paymentDay}-kuni` : '—')}
      {row('Jami daromad', formatMoney(calc.totalIncome))}
      {row('Jami xarajat', formatMoney(calc.totalExpenses))}
      {/* DTI / Surplus / Min income only make sense once income is entered — otherwise Surplus just
          shows the negative monthly payment, which is confusing. */}
      {calc.totalIncome > 0 && (
        <>
          {row('Surplus', formatMoney(calc.surplus), calc.surplus < 0)}
          {row('Min kerakli daromad', formatMoney(calc.minRequiredIncome))}
        </>
      )}
      {row('Sug‘urta puli', formatMoney(calc.premium))}
      {row('Garov qoplami', amountTotal ? `${(calc.coverageRatio * 100).toFixed(0)}%` : '—')}
      {!calc.affordabilityOk && (calc.totalIncome > 0) && (
        <p className="mt-2 rounded-lg bg-error-50 px-3 py-2 text-xs font-medium text-error-700 dark:bg-error-600/10 dark:text-error-400">
          Daromad yetarli emas (surplus manfiy yoki 2.2× dan past) — ko‘rib chiqing.
        </p>
      )}

      <ScoreBreakdown form={form} />
    </Card>
  );
}
