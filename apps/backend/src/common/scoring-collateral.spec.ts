import { scoreForCase } from '@credit-core/shared';

/** With several pledges the sheet has no answer, so both pledge factors read the primary one. */
describe('multi-collateral pledge factors', () => {
  const b = { fullName: 'A A' };
  const at = (cols: unknown[], key: string) =>
    scoreForCase({ borrower: b, collaterals: cols as never }).factors.find((f) => f.key === key)!;

  it('a house first, a car added as extra cover, still scores as property', () => {
    expect(at([{ type: 'REAL_ESTATE' }, { type: 'AUTO' }], 'collateral').points).toBe(4);
  });

  it('a car-backed loan still scores as a vehicle', () => {
    expect(at([{ type: 'AUTO' }, { type: 'REAL_ESTATE' }], 'collateral').points).toBe(2);
  });

  it('a third party owning a SECONDARY pledge no longer costs the borrower points', () => {
    expect(at([{ type: 'REAL_ESTATE', owners: [{ fullName: 'A A' }] },
               { type: 'AUTO', owners: [{ fullName: 'SOMEONE ELSE' }] }], 'pledgor').points).toBe(3);
  });

  it('but a third party owning the PRIMARY pledge does', () => {
    expect(at([{ type: 'REAL_ESTATE', owners: [{ fullName: 'SOMEONE ELSE' }] }], 'pledgor').points).toBe(1);
  });

  it('no owner entered means the borrower — the implied-owner rule', () => {
    expect(at([{ type: 'REAL_ESTATE', owners: [] }], 'pledgor').points).toBe(3);
  });
});
