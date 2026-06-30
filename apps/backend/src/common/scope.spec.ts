import { isCaseInScope } from '@credit-core/shared';

describe('isCaseInScope', () => {
  it('true only when the case branch is assigned', () => {
    expect(isCaseInScope(['b1', 'b2'], 'b2')).toBe(true);
    expect(isCaseInScope(['b1'], 'b2')).toBe(false);
    expect(isCaseInScope(['b1'], null)).toBe(false);
  });
});
