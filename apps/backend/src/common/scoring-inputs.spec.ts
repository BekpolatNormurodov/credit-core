import { scoreForCase } from '@credit-core/shared';

/**
 * The field mappings, checked against what the wizard actually writes.
 *
 * Every fault found in this area was of one kind: the score read a column nobody fills. The
 * formulas were right and the number was still wrong.
 */
const factor = (subject: object, key: string) =>
  scoreForCase(subject as never).factors.find((f) => f.key === key)!;

describe('inputs reach the factors that need them', () => {
  it('reads the residence band from either column', () => {
    // The wizard wrote `residenceDuration` while the score read `regTenure`, so this scored 0.
    expect(factor({ borrower: { residenceDuration: 'иное' } }, 'residence').points).toBe(3);
    expect(factor({ borrower: { regTenure: 'иное' } }, 'residence').points).toBe(3);
    expect(factor({ borrower: { regTenure: '1-5 лет' } }, 'residence').points).toBe(2);
  });

  it('counts all four income lines, as b3!D38 does', () => {
    const one = scoreForCase({ affordability: { mainActivityIncome: 4_000_000, newLoanPayment: 1_000_000 } } as never);
    const split = scoreForCase({
      affordability: {
        mainActivityIncome: 1_000_000, secondaryIncome: 1_000_000,
        familyIncome: 1_000_000, otherIncome: 1_000_000, newLoanPayment: 1_000_000,
      },
    } as never);
    // Same total income, so the same affordability ratios — secondary and family income count.
    expect(split.ratios.income).toBe(one.ratios.income);
    expect(split.factors.find((f) => f.key === 'trancheToIncome')!.points)
      .toBe(one.factors.find((f) => f.key === 'trancheToIncome')!.points);
  });

  it('counts existing debt service as an expense, as балл!C29 does via Д1!C48', () => {
    const base = { mainActivityIncome: 10_000_000, newLoanPayment: 2_000_000 };
    const clean = scoreForCase({ affordability: base } as never);
    const indebted = scoreForCase({ affordability: { ...base, existingCreditBurden: 3_000_000 } } as never);
    // The sheet adds b4!C9 into SUM(C46:C49); omitting it flattered anyone already paying a loan.
    expect(indebted.ratios.expenses).toBe(clean.ratios.expenses + 3_000_000);
    expect(indebted.ratios.surplus).toBeLessThan(clean.ratios.surplus);
    // …and it is also part of the tranche load, exactly as C27 counts it.
    expect(indebted.ratios.tranche).toBe(5_000_000);
  });

  it('falls back to the tranche payment when affordability has no new-loan figure', () => {
    const r = scoreForCase({ creditLine: { tranche: { monthlyPayment: 2_500_000 } } } as never);
    expect(r.ratios.tranche).toBe(2_500_000);
  });
});
