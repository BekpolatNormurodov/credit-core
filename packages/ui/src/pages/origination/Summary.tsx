import { useState } from 'react';
import {
  originationCalc, loanTypeFor, scoreForCase, SCORE_VERDICT_LABEL, COLLATERAL_COVERAGE_TARGET,
  type ScorableCase, type UpsertCasePayload,
} from '@credit-core/shared';
import { Button, Card } from '../../components/primitives';
import { Modal } from '../../components/Modal';
import { Chart } from '../../lib/icons';
import { cn, formatMoney } from '../../lib/cn';

/** Tone for the score total — matches the verdict bands (<60 refuse, 70+ approve). */
function scoreTone(verdict: string): string {
  if (verdict === 'APPROVED') return 'text-success-700 dark:text-success-400';
  if (verdict === 'BELOW_MIN' || verdict === 'FAILED_PROBLEM_LOANS') return 'text-error-600 dark:text-error-500';
  return 'text-warning-700 dark:text-warning-400';
}

/**
 * The score in the summary card: the total, a one-line verdict, and a way to see the working.
 *
 * The breakdown lives in a dialog rather than an accordion inside the card. The card is a sticky
 * column beside the wizard and twenty more rows do not fit in it — expanding pushed the whole
 * summary off screen. A dialog also gives the table room to be read rather than squinted at.
 *
 * On a half-entered case most factors have no data yet, and a bare "0 / 5" reads as a refusal.
 * Those rows say «kiritilmagan» instead, and the card counts them, so a low score on an unfinished
 * application is legible as unfinished.
 */
function ScorePanel({ form, coverageRatio, collateralTotal }: {
  form: UpsertCasePayload; coverageRatio: number; collateralTotal: number;
}) {
  const [open, setOpen] = useState(false);
  const r = scoreForCase(form as unknown as ScorableCase);
  const tone = scoreTone(r.verdict);
  const cols = form.collaterals.length;
  const coveragePct = Math.round(coverageRatio * 100);
  const coverageOk = coverageRatio >= COLLATERAL_COVERAGE_TARGET;

  return (
    <div className="mt-2 border-t border-gray-200 pt-2 dark:border-white/10">
      <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
        <span className="text-gray-500 dark:text-gray-400">Skoring balli</span>
        <span className={cn('nums font-bold', tone)}>{r.total} / {r.max}</span>
      </div>

      <p className={cn('text-right text-xs font-medium leading-snug', tone)}>
        {SCORE_VERDICT_LABEL[r.verdict]}
      </p>

      {r.missingCount > 0 && (
        <p className="mt-1 text-right text-[11px] leading-snug text-gray-400 dark:text-gray-500">
          {r.missingCount} ta ko‘rsatkich to‘ldirilmagan — ball to‘liq emas
        </p>
      )}

      <Button variant="secondary" className="mt-2 w-full" onClick={() => setOpen(true)}>
        <Chart className="h-4 w-4" /> Ballarni to‘liq ko‘rish
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title="Skoring tahlili"
        description="Har bir ko‘rsatkich va undan olingan ball"
      >
        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-4 py-3 dark:border-white/10">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Jami ball</p>
            <p className={cn('text-sm font-medium', tone)}>{SCORE_VERDICT_LABEL[r.verdict]}</p>
          </div>
          <span className={cn('nums text-2xl font-bold', tone)}>{r.total} / {r.max}</span>
        </div>

        {r.missingCount > 0 && (
          <p className="mb-3 rounded-lg bg-warning-50 px-3 py-2 text-xs leading-relaxed text-warning-800 dark:bg-warning-500/10 dark:text-warning-300">
            <b>{r.missingCount} ta ko‘rsatkich</b> hali to‘ldirilmagan. Ular hozircha 0 ball beryapti —
            maydonlar to‘lgach ball o‘zgaradi.
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 dark:border-white/10 dark:text-gray-400">
                <th className="w-8 py-2 text-left font-medium">№</th>
                <th className="py-2 text-left font-medium">Ko‘rsatkich</th>
                <th className="w-24 py-2 text-right font-medium">Ball</th>
              </tr>
            </thead>
            <tbody>
              {r.factors.map((f) => (
                <tr key={f.key} className="border-b border-gray-100 last:border-0 dark:border-white/5">
                  <td className="py-1.5 tabular-nums text-gray-400 dark:text-gray-500">{f.no}</td>
                  <td className="py-1.5 text-gray-700 dark:text-gray-200">
                    {f.label}
                    {f.missing && (
                      <span className="ml-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-white/10 dark:text-gray-400">
                        kiritilmagan
                      </span>
                    )}
                  </td>
                  <td
                    className={cn(
                      'nums py-1.5 text-right font-semibold',
                      // A penalty, an unfilled field and an earned zero must not look alike.
                      f.points < 0 ? 'text-error-600 dark:text-error-500'
                        : f.missing ? 'text-gray-300 dark:text-gray-600'
                          : f.points === 0 ? 'text-gray-400 dark:text-gray-500'
                            : f.points === f.max ? 'text-success-700 dark:text-success-400'
                              : 'text-gray-700 dark:text-gray-200',
                    )}
                  >
                    {f.points} / {f.max}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/*
          Where the collateral amounts actually count. The workbook's 100 points read only the
          pledge's TYPE and whether the borrower owns it — never its value, and never a second
          pledge. The sum is checked separately, as a pass/fail cover requirement, and saying so
          here stops the score looking as though it ignores the money altogether.
        */}
        <div className="mt-4 rounded-xl border border-gray-200 px-4 py-3 dark:border-white/10">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Garov qiymati — ballga kirmaydi
          </p>
          <div className="mt-1.5 space-y-1 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-gray-500 dark:text-gray-400">Garovlar soni</span>
              <span className="nums font-medium">{cols} ta</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-gray-500 dark:text-gray-400">Jami garov qiymati</span>
              <span className="nums font-medium">{formatMoney(collateralTotal)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-gray-500 dark:text-gray-400">Qoplama (kerak {Math.round(COLLATERAL_COVERAGE_TARGET * 100)}%)</span>
              <span className={cn('nums font-semibold', coverageOk ? 'text-success-700 dark:text-success-400' : 'text-error-600 dark:text-error-500')}>
                {coveragePct}%
              </span>
            </div>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
            Ballda faqat garov <b>turi</b> (uy-joy 4 / avto 2) va <b>egasi</b> (o‘zi 3 / boshqa 1)
            hisobga olinadi — Excel shunday. Summalar qo‘shilib mana shu qoplama talabida tekshiriladi.
          </p>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
          Oxirgi ikki ko‘rsatkich (transh/daromad va daromad-xarajat/transh) birgalikda <b>43 ball</b> —
          ballning eng katta qismi. 60 balldan past — rad etiladi, 70 va undan yuqori — ma’qullanadi.
        </p>
      </Modal>
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

      <ScorePanel form={form} coverageRatio={calc.coverageRatio} collateralTotal={collateralTotal} />
    </Card>
  );
}
