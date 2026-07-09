/** Minimal transaction-client shape this helper needs (real Prisma tx satisfies it). */
export interface CounterTx {
  contractCounter: {
    upsert(args: {
      where: { id: string };
      create: { id: string; value: number };
      update: { value: { increment: number } };
    }): Promise<{ id: string; value: number }>;
  };
}

/**
 * Atomically bump the counter row `id` by 1 and return the NEW value. Creates the
 * row at 1 when missing (so a new year's row auto-starts at 1). The upsert runs under
 * the row lock inside the caller's transaction, so concurrent submits never collide.
 */
export async function nextCounter(tx: CounterTx, id: string): Promise<number> {
  const row = await tx.contractCounter.upsert({
    where: { id },
    create: { id, value: 1 },
    update: { value: { increment: 1 } },
  });
  return row.value;
}
