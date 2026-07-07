import { loanRuleViolations } from '@credit-core/shared';

describe('loanRuleViolations', () => {
  it('accepts annuity ≤ 30 and differentiated ≤ 48', () => {
    expect(loanRuleViolations({ scheduleType: 'ANNUITY', trancheTermMonths: 30 })).toEqual([]);
    expect(loanRuleViolations({ scheduleType: 'DIFFERENTIATED', trancheTermMonths: 48 })).toEqual([]);
  });
  it('rejects an over-cap tranche (annuity 31, differentiated 49)', () => {
    expect(loanRuleViolations({ scheduleType: 'ANNUITY', trancheTermMonths: 31 })).toHaveLength(1);
    expect(loanRuleViolations({ scheduleType: 'DIFFERENTIATED', trancheTermMonths: 49 })).toHaveLength(1);
  });
  it('caps the РКЛ line at 60 months, independent of the tranche schedule', () => {
    // Line 60 with an annuity (30-cap) tranche is fine — the line cap is its own rule.
    expect(loanRuleViolations({ scheduleType: 'ANNUITY', trancheTermMonths: 30, lineTermMonths: 60 })).toEqual([]);
    expect(loanRuleViolations({ lineTermMonths: 61 })).toHaveLength(1);
    expect(loanRuleViolations({ lineTermMonths: 0 })).toHaveLength(1);
  });
  it('is silent when scheduleType or term is missing', () => {
    expect(loanRuleViolations({ trancheTermMonths: 99 })).toEqual([]);
    expect(loanRuleViolations({ scheduleType: 'ANNUITY' })).toEqual([]);
  });
});
