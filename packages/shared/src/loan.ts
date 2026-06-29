/**
 * Loan economics — annual-rate (annuity) model so the math stays sound for any term.
 *
 * The client pays an **annual** interest rate (`markupPercent`, e.g. 0.41 = 41%/yil) as a
 * monthly annuity on the declining principal — exactly like the bank charges its annual
 * `bankRate`. Both sides scale with the term, so company profit stays positive for short AND
 * long loans (the earlier "flat markup vs annual bank rate" model went negative past ~18 months).
 *
 * Example: principal 150 000 000, markup 41%/yil, bank 28%/yil, 60 oy →
 *   oylik ≈ 5 911 000, klient jami ≈ 354 700 000, bank xarajati ≈ 130 000 000,
 *   yalpi foyda ≈ 74 700 000, sof foyda ≈ 59 100 000 (musbat).
 */

export interface LoanConfig {
  markupPercent: number; // klient YILLIK foiz stavkasi (e.g. 0.41)
  bankRate: number; // bank YILLIK foiz stavkasi (e.g. 0.28)
  taxRate: number; // daromad solig'i (e.g. 0.12)
  nplRate: number; // NPL (to'lanmaslik) foizi (e.g. 0.05)
}

export interface LoanScheduleRow {
  month: number;
  payment: number; // oylik to'lov (annuitet)
  principal: number; // shu oyda asosiy qism (payment − foiz)
  balance: number; // qoldiq (asosiy qarz)
}

export interface LoanCalc {
  principal: number;
  termMonths: number;
  markupPercent: number;
  clientTotal: number; // monthlyPayment * term
  markupAmount: number; // clientTotal − principal (klient to'laydigan jami foiz)
  monthlyPayment: number; // PMT(markupPercent/12, term, principal)
  schedule: LoanScheduleRow[];
  // Kompaniya / bank tomoni
  bankRate: number;
  bankMonthly: number; // PMT(bankRate/12, term, principal)
  bankTotal: number;
  bankInterest: number; // bankTotal − principal
  grossProfit: number; // markupAmount − bankInterest
  nplLoss: number; // principal * nplRate
  ebt: number; // grossProfit − nplLoss
  tax: number; // max(0, ebt) * taxRate
  netProfit: number; // ebt − tax
}

/** Excel PMT — annuity payment for a present value at a per-period rate. */
export function pmt(ratePerPeriod: number, nper: number, pv: number): number {
  if (nper <= 0) return 0;
  if (ratePerPeriod === 0) return pv / nper;
  return (pv * ratePerPeriod) / (1 - Math.pow(1 + ratePerPeriod, -nper));
}

/** Compute the full loan breakdown for a case, or null when inputs are insufficient. */
export function computeLoan(amount: number | null | undefined, termMonths: number | null | undefined, cfg: LoanConfig): LoanCalc | null {
  if (!amount || amount <= 0 || !termMonths || termMonths <= 0) return null;
  const principal = amount;

  // Client side: annuity on the principal at the annual markup rate.
  const cRate = cfg.markupPercent / 12;
  const monthlyPayment = pmt(cRate, termMonths, principal);
  const clientTotal = monthlyPayment * termMonths;
  const markupAmount = clientTotal - principal;

  // Amortization schedule (interest on the declining balance; principal = payment − interest).
  const schedule: LoanScheduleRow[] = [];
  let balance = principal;
  for (let m = 1; m <= termMonths; m++) {
    const interest = balance * cRate;
    let principalPortion = monthlyPayment - interest;
    if (m === termMonths) principalPortion = balance; // close out rounding on the last row
    balance = Math.max(0, balance - principalPortion);
    schedule.push({ month: m, payment: monthlyPayment, principal: principalPortion, balance });
  }

  // Bank side: the company funds the principal and repays the bank at its annual rate.
  const bankMonthly = pmt(cfg.bankRate / 12, termMonths, principal);
  const bankTotal = bankMonthly * termMonths;
  const bankInterest = bankTotal - principal;

  const grossProfit = markupAmount - bankInterest;
  const nplLoss = principal * cfg.nplRate;
  const ebt = grossProfit - nplLoss;
  const tax = Math.max(0, ebt) * cfg.taxRate;
  const netProfit = ebt - tax;

  return {
    principal, termMonths, markupPercent: cfg.markupPercent,
    clientTotal, markupAmount, monthlyPayment, schedule,
    bankRate: cfg.bankRate, bankMonthly, bankTotal, bankInterest,
    grossProfit, nplLoss, ebt, tax, netProfit,
  };
}
