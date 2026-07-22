import {
  resolveOwners, primaryOwnerName, ownerIsImplied, collateralOwnerErrors,
} from '@credit-core/shared';

const borrower = {
  fullName: 'JOLDIBAYEV RUSLAN ODILOVICH',
  passportSeries: 'AD',
  passportNumber: '4156235',
  pinfl: '52101901234567',
};

describe('resolveOwners', () => {
  it('falls back to the borrower at 100% when no owner was entered', () => {
    const [o] = resolveOwners([], borrower);
    expect(o!.fullName).toBe('JOLDIBAYEV RUSLAN ODILOVICH');
    expect(o!.sharePercent).toBe(100);
    expect(o!.isBorrowerOwner).toBe(true);
  });

  it('carries the borrower\'s passport and PINFL into the implied owner', () => {
    const [o] = resolveOwners(null, borrower);
    expect(o!.passportNumber).toBe('4156235');
    expect(o!.pinfl).toBe('52101901234567');
  });

  it('leaves an entered owner completely alone', () => {
    const entered = [{ fullName: 'BAYMIRZAYEVA GULNORA MURATOVNA', sharePercent: 60 }];
    expect(resolveOwners(entered, borrower)).toEqual(entered);
  });

  it('does not force entered shares to total 100 — co-owners may pledge a part', () => {
    const entered = [{ fullName: 'A A', sharePercent: 40 }, { fullName: 'B B', sharePercent: 35 }];
    expect(resolveOwners(entered, borrower).map((o) => o.sharePercent)).toEqual([40, 35]);
  });

  it('ignores blank owner rows the wizard leaves behind', () => {
    const [o] = resolveOwners([{ fullName: '   ' }], borrower);
    expect(o!.fullName).toBe('JOLDIBAYEV RUSLAN ODILOVICH');
  });

  it('returns nothing when there is no owner and no borrower name to stand in', () => {
    expect(resolveOwners([], { fullName: '  ' })).toEqual([]);
    expect(resolveOwners(undefined, null)).toEqual([]);
  });
});

describe('primaryOwnerName', () => {
  it('names the entered owner', () => {
    expect(primaryOwnerName([{ fullName: 'X Y' }], borrower)).toBe('X Y');
  });
  it('names the borrower when none was entered', () => {
    expect(primaryOwnerName([], borrower)).toBe('JOLDIBAYEV RUSLAN ODILOVICH');
  });
  it('is null when nobody can be named', () => {
    expect(primaryOwnerName([], null)).toBeNull();
  });
});

describe('ownerIsImplied', () => {
  it('is true only when the borrower is standing in', () => {
    expect(ownerIsImplied([], borrower)).toBe(true);
    expect(ownerIsImplied([{ fullName: 'X Y' }], borrower)).toBe(false);
    expect(ownerIsImplied([], null)).toBe(false);
  });
});

describe('collateralOwnerErrors', () => {
  it('says nothing while the borrower can stand in', () => {
    expect(collateralOwnerErrors([{ owners: [] }, { owners: [] }], borrower)).toEqual([]);
  });

  it('complains per collateral once the borrower has no name either', () => {
    const errs = collateralOwnerErrors([{ owners: [] }, { owners: [{ fullName: 'X Y' }] }], null);
    expect(errs).toHaveLength(1);
    expect(errs[0]).toContain('Garov 1');
    expect(errs[0]).toContain('mulk egasi');
  });

  it('numbers each failing collateral', () => {
    const errs = collateralOwnerErrors([{ owners: [] }, { owners: [] }], null);
    expect(errs.map((e) => e.slice(0, 7))).toEqual(['Garov 1', 'Garov 2']);
  });
});
