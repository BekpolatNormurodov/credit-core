import { loanRuleViolations } from '@credit-core/shared';

describe('loanRuleViolations', () => {
  it('accepts annuity ≤ 30 and differentiated ≤ 48', () => {
    expect(loanRuleViolations({ scheduleType: 'ANNUITY', trancheTermMonths: 30 })).toEqual([]);
    expect(loanRuleViolations({ scheduleType: 'DIFFERENTIATED', trancheTermMonths: 48 })).toEqual([]);
  });
  it('rejects annuity 31 and differentiated 49 (tranche and line)', () => {
    expect(loanRuleViolations({ scheduleType: 'ANNUITY', trancheTermMonths: 31 })).toHaveLength(1);
    expect(loanRuleViolations({ scheduleType: 'DIFFERENTIATED', lineTermMonths: 49 })).toHaveLength(1);
  });
  it('is silent when scheduleType or term is missing', () => {
    expect(loanRuleViolations({ trancheTermMonths: 99 })).toEqual([]);
    expect(loanRuleViolations({ scheduleType: 'ANNUITY' })).toEqual([]);
  });
});
