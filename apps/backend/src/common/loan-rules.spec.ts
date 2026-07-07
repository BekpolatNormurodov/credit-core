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
  it('does NOT cap the РКЛ line duration by the tranche schedule (line can run 60mo)', () => {
    // Only the tranche term is passed; a longer line term is not this rule's concern.
    expect(loanRuleViolations({ scheduleType: 'ANNUITY', trancheTermMonths: 30 })).toEqual([]);
  });
  it('is silent when scheduleType or term is missing', () => {
    expect(loanRuleViolations({ trancheTermMonths: 99 })).toEqual([]);
    expect(loanRuleViolations({ scheduleType: 'ANNUITY' })).toEqual([]);
  });
});
