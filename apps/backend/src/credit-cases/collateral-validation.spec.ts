import { collateralComplete, collateralMissing, collateralErrors } from '@credit-core/shared';
import { ProductType } from '@credit-core/shared';
import type { CollateralDto } from '@credit-core/shared';

const auto = (over: Partial<CollateralDto> = {}): CollateralDto => ({
  type: ProductType.AUTO, agreedValue: 50_000_000, agreedValueWords: null, owners: [],
  model: 'SPARK', stateNumber: '10 A 111 AA', techPassportNo: 'AAS1234567', ...over,
});
const realEstate = (over: Partial<CollateralDto> = {}): CollateralDto => ({
  type: ProductType.REAL_ESTATE, agreedValue: 200_000_000, agreedValueWords: null, owners: [],
  realtyKind: 'APARTMENT', address: 'Toshkent', cadastreNo: '10:01:05:03:01:1234', ...over,
});

describe('collateral validation', () => {
  it('a fully-filled auto collateral is complete', () => {
    expect(collateralComplete(auto())).toBe(true);
    expect(collateralMissing(auto())).toEqual([]);
  });
  it('auto without stateNumber or techPassport is incomplete', () => {
    const c = auto({ stateNumber: null, techPassportNo: '' });
    expect(collateralComplete(c)).toBe(false);
    expect(collateralMissing(c).map((m) => m.field)).toEqual(['stateNumber', 'techPassportNo']);
  });
  it('a fully-filled real-estate collateral is complete', () => {
    expect(collateralComplete(realEstate())).toBe(true);
  });
  it('real-estate without cadastreNo is incomplete but does NOT require realtyKind', () => {
    const c = realEstate({ cadastreNo: null, realtyKind: null });
    expect(collateralMissing(c).map((m) => m.field)).toEqual(['cadastreNo']);
  });
  it('agreedValue of 0 is missing', () => {
    expect(collateralMissing(auto({ agreedValue: 0 }))[0].field).toBe('agreedValue');
  });
  it('collateralErrors maps fields to "<Label> majburiy"', () => {
    expect(collateralErrors(auto({ model: null }))).toEqual({ model: 'Model majburiy' });
  });
});
