import { insurancePremiumRate, originationCalc, INSURANCE_MAX_MONTHS } from '@credit-core/shared';

describe('insurancePremiumRate (flat bracket)', () => {
  it('≤24 months → 2%', () => {
    expect(insurancePremiumRate(12)).toBe(0.02);
    expect(insurancePremiumRate(18)).toBe(0.02);
    expect(insurancePremiumRate(24)).toBe(0.02);
  });
  it('24–48 months → 4%', () => {
    expect(insurancePremiumRate(25)).toBe(0.04);
    expect(insurancePremiumRate(48)).toBe(0.04);
  });
  it('0 / absent → 0', () => {
    expect(insurancePremiumRate(0)).toBe(0);
    expect(insurancePremiumRate(null)).toBe(0);
  });
  it('max term is 48 months (4 years)', () => {
    expect(INSURANCE_MAX_MONTHS).toBe(48);
  });
});

describe('originationCalc premium (flat bracket)', () => {
  it('200M polis, ≤2yr → 260M insured × 2% = 5.2M', () => {
    const c = originationCalc({ loanUnderPolicy: 200_000_000, policyTermMonths: 24 });
    expect(c.insuredSum).toBe(260_000_000);
    expect(c.premium).toBe(5_200_000);
  });
  it('same 200M polis, 2–4yr → 260M × 4% = 10.4M', () => {
    const c = originationCalc({ loanUnderPolicy: 200_000_000, policyTermMonths: 36 });
    expect(c.premium).toBe(10_400_000);
  });
});
