import { mockCaseDoc, flattenDocText } from './__fixtures__/case-doc.fixture';
import { DOC_REGISTRY } from './registry';

/**
 * The bug this guards: with no owner entered, every document printed «—» where the pledgor belongs.
 * The borrower pledging their own property is the common case, so that was most documents.
 */
describe('implied collateral owner', () => {
  const noOwners = mockCaseDoc({ collaterals: [{ owners: [] as never }, { owners: [] as never }] });
  const borrowerName = noOwners.borrower!.fullName;

  it('stands the borrower in at 100% when no owner was entered', () => {
    expect(noOwners.collaterals[0]!.owners[0]!.fullName).toBe(borrowerName);
    expect(noOwners.collaterals[0]!.owners[0]!.sharePercent).toBe(100);
  });

  it('names an owner in every document that prints one', () => {
    // The templates that carry an «эгаси / egasi / гаровга берувчи» line.
    for (const key of ['act', 'contract', 'protokol', 'creditApplication', 'rklGen', 'monitoring1']) {
      const text = flattenDocText(DOC_REGISTRY[key]!.build(noOwners));
      expect({ key, hasOwner: text.includes(borrowerName) }).toEqual({ key, hasOwner: true });
    }
  });

  it('leaves an entered owner alone — the borrower does not override it', () => {
    const c = mockCaseDoc({ collaterals: [{ owners: [{ fullName: 'BAYMIRZAYEVA GULNORA MURATOVNA' }] as never }] });
    expect(c.collaterals[0]!.owners[0]!.fullName).toBe('BAYMIRZAYEVA GULNORA MURATOVNA');
    expect(flattenDocText(DOC_REGISTRY.act!.build(c))).toContain('BAYMIRZAYEVA');
  });
});
