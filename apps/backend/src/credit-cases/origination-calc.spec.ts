import { originationCalc, originationPersistedValues } from '@credit-core/shared';

describe('originationCalc insured-sum override', () => {
  it('uses ×1.3 when no override', () => {
    const c = originationCalc({ loanUnderPolicy: 100_000_000, policyTermMonths: 12 });
    expect(c.insuredSum).toBe(130_000_000);
    expect(c.premium).toBe(2_600_000); // 130M × 2% (≤24 oy)
  });
  it('honours requiredInsuredAmount override for insuredSum AND premium', () => {
    const c = originationCalc({ loanUnderPolicy: 100_000_000, policyTermMonths: 12, requiredInsuredAmount: 200_000_000 });
    expect(c.insuredSum).toBe(200_000_000);
    expect(c.premium).toBe(4_000_000); // 200M × 2%
  });
  it('originationPersistedValues forwards the override', () => {
    const d = originationPersistedValues({ amountTotal: 100_000_000, loanUnderPolicy: 100_000_000, policyTermMonths: 12, requiredInsuredAmount: 50_000_000 });
    expect(d.insuredSum).toBe(50_000_000);
    expect(d.premium).toBe(1_000_000); // 50M × 2%
  });
});
