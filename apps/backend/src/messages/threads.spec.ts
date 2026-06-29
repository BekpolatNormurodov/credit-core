import { dmPairKey, dmWhere, savedWhere } from './messages.module';

describe('message threads', () => {
  it('dm pair key is order-independent', () => {
    expect(dmPairKey('a', 'b')).toBe(dmPairKey('b', 'a'));
  });
  it('dm where matches both directions and excludes case messages', () => {
    const w = dmWhere('me', 'you') as { caseId: null; OR: unknown[] };
    expect(w.caseId).toBeNull();
    expect(w.OR).toEqual([
      { senderId: 'me', toUserId: 'you' },
      { senderId: 'you', toUserId: 'me' },
    ]);
  });
  it('saved where is self-to-self with no case', () => {
    expect(savedWhere('me')).toEqual({ caseId: null, senderId: 'me', toUserId: 'me' });
  });
});
