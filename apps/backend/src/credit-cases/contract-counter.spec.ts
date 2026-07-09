import { nextCounter } from './contract-counter';

function fakeTx() {
  const rows = new Map<string, number>();
  return {
    rows,
    contractCounter: {
      upsert: async ({ where, create, update }: any) => {
        const cur = rows.get(where.id);
        const val = cur == null ? create.value : cur + update.value.increment;
        rows.set(where.id, val);
        return { id: where.id, value: val };
      },
    },
  };
}

describe('nextCounter', () => {
  it('starts at 1 and increments', async () => {
    const tx = fakeTx();
    expect(await nextCounter(tx as never, 'global')).toBe(1);
    expect(await nextCounter(tx as never, 'global')).toBe(2);
    expect(await nextCounter(tx as never, 'global')).toBe(3);
  });
  it('tracks separate ids independently', async () => {
    const tx = fakeTx();
    expect(await nextCounter(tx as never, 'global')).toBe(1);
    expect(await nextCounter(tx as never, '2026')).toBe(1);
    expect(await nextCounter(tx as never, 'global')).toBe(2);
    expect(await nextCounter(tx as never, '2026')).toBe(2);
  });
});
