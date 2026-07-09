import { formatContractNumber } from '@credit-core/shared';

describe('formatContractNumber', () => {
  it('joins global MFL yearly branch with single spaces', () => {
    expect(formatContractNumber(2012, 1320, 'PS')).toBe('2012 MFL 1320 PS');
  });
  it('handles small numbers', () => {
    expect(formatContractNumber(1, 1, 'BR')).toBe('1 MFL 1 BR');
  });
});
