/**
 * Loan economics — the formulas from the source workbook (kredit_liniya_hisob,
 * "BITTA KREDIT" tab) implemented as a pure function so the UI and exports share
 * one source of truth. Verified against the workbook: amount 1 000 000, ustama 41%,
 * bank 28%, 12 oy → jami 1 410 000, oylik 117 500, bank foizi 222 881, sof foyda 120 664.
 */

export interface LoanConfig {
  markupPercent: number; // klient ustama foizi (e.g. 0.41)
  bankRate: number; // bank yillik foiz stavkasi (e.g. 0.28)
  taxRate: number; // daromad solig'i (e.g. 0.12)
  nplRate: number; // NPL (to'lanmaslik) foizi (e.g. 0.05)
}

export interface LoanScheduleRow {
  month: number;
  payment: number; // oylik to'lov
  principal: number; // shu oyda asosiy qism (annuitetda teng)
  balance: number; // qoldiq
}

export interface LoanCalc {
  principal: number;
  termMonths: number;
  markupPercent: number;
  clientTotal: number; // amount * (1 + markup)
  markupAmount: number; // amount * markup
  monthlyPayment: number; // clientTotal / term (annuitet)
  schedule: LoanScheduleRow[];
  // Kompaniya / bank tomoni
  bankRate: number;
  bankMonthly: number; // PMT(bankRate/12, term, clientTotal)
  bankTotal: number;
  bankInterest: number; // bankTotal - clientTotal
  grossProfit: number; // markupAmount - bankInterest
  nplLoss: number; // amount * nplRate
  ebt: number; // grossProfit - nplLoss
  tax: number; // max(0, ebt) * taxRate
  netProfit: number; // ebt - tax
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
  const markupAmount = principal * cfg.markupPercent;
  const clientTotal = principal + markupAmount;
  const monthlyPayment = clientTotal / termMonths;
  const monthlyPrincipal = principal / termMonths;

  const schedule: LoanScheduleRow[] = [];
  let balance = clientTotal;
  for (let m = 1; m <= termMonths; m++) {
    balance = Math.max(0, balance - monthlyPayment);
    schedule.push({ month: m, payment: monthlyPayment, principal: monthlyPrincipal, balance });
  }

  const bankMonthly = pmt(cfg.bankRate / 12, termMonths, clientTotal);
  const bankTotal = bankMonthly * termMonths;
  const bankInterest = bankTotal - clientTotal;
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
