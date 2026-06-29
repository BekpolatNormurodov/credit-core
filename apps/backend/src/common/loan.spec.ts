import { computeLoan } from '@credit-core/shared';

describe('computeLoan (annual-rate model)', () => {
  const cfg = { markupPercent: 0.41, bankRate: 0.28, taxRate: 0.12, nplRate: 0.05 };

  it('stays positive for a long (60-month) loan', () => {
    const l = computeLoan(150_000_000, 60, cfg)!;
    expect(l.grossProfit).toBeGreaterThan(0);
    expect(l.netProfit).toBeGreaterThan(0);
    expect(l.clientTotal).toBeGreaterThan(l.principal);
  });

  it('client interest exceeds the bank cost (markup > bankInterest)', () => {
    const l = computeLoan(150_000_000, 60, cfg)!;
    expect(l.markupAmount).toBeGreaterThan(l.bankInterest);
  });

  it('amortization schedule closes to zero', () => {
    const l = computeLoan(150_000_000, 60, cfg)!;
    expect(l.schedule).toHaveLength(60);
    expect(Math.round(l.schedule[59].balance)).toBe(0);
  });

  it('returns null for missing inputs', () => {
    expect(computeLoan(0, 60, cfg)).toBeNull();
    expect(computeLoan(150_000_000, 0, cfg)).toBeNull();
  });
});
