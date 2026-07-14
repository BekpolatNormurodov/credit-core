import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpsertCaseDto } from './dto';

/**
 * Regression: creating an ariza from step 1 (borrower) sends the whole form, including
 * `collaterals: []`, before the operator has reached the Garov step. @IsOptional only skips
 * null/undefined — an empty array must still pass validation. A stray @ArrayMinSize(1) here used to
 * reject it with "collaterals noto'g'ri". The ≥1-collateral rule lives at the submit gate, not the DTO.
 */
async function collateralErrors(collaterals: unknown) {
  const dto = plainToInstance(UpsertCaseDto, { borrower: { fullName: 'TEST' }, collaterals });
  const errs = await validate(dto);
  return errs.filter((e) => e.property === 'collaterals');
}

describe('UpsertCaseDto collaterals validation', () => {
  it('accepts an empty collaterals array (draft / step-1 create)', async () => {
    expect(await collateralErrors([])).toHaveLength(0);
  });

  it('accepts a missing collaterals field (per-step autosave omits it)', async () => {
    const dto = plainToInstance(UpsertCaseDto, { borrower: { fullName: 'TEST' } });
    const errs = await validate(dto);
    expect(errs.filter((e) => e.property === 'collaterals')).toHaveLength(0);
  });

  it('accepts a well-formed collateral', async () => {
    expect(await collateralErrors([{ type: 'REAL_ESTATE', agreedValue: 100 }])).toHaveLength(0);
  });

  it('still rejects a collateral with an invalid type (nested validation intact)', async () => {
    const errs = await collateralErrors([{ type: 'NOT_A_TYPE' }]);
    expect(errs).toHaveLength(1);
  });
});
