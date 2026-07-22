import { caseSubmitErrors, scoreForCase, TRANSITIONS } from '@credit-core/shared';
import type { CreditCaseDto } from '@credit-core/shared';

/**
 * The score informs; it does not decide.
 *
 * A case with a failing score must still reach the moderator and the director — whether to refuse
 * on the number is a decision for a later stage, and a human's. This locks that in, because a
 * score gate is the kind of thing that gets added later "for safety" and quietly strands
 * applications in DRAFT.
 */

/** A complete application that scores badly: nothing optional filled, a vehicle pledge. */
const lowScoringCase = (): CreditCaseDto =>
  ({
    id: 'c1',
    number: 'BR-2026-0001',
    amount: 50_000_000,
    borrower: {
      fullName: 'PAST BALL TEST',
      pinfl: '52101901234567',
      passportSeries: 'AD',
      passportNumber: '7654321',
      phone: '+998901112233',
      closeContacts: [
        { relation: 'Ota', fullName: 'OTA OTAYEV', phone: '+998901112234' },
        { relation: 'Aka', fullName: 'AKA AKAYEV', phone: '+998901112235' },
      ],
    },
    collaterals: [{
      type: 'AUTO', agreedValue: 80_000_000, model: 'CHEVROLET COBALT',
      stateNumber: '01 A 111 AA', techPassportNo: 'AAG 1111111', owners: [],
    }],
    creditLine: {
      amountAuto: 50_000_000, amountPolis: 0, amountTotal: 50_000_000, termMonths: 24,
      tranche: { scheduleType: 'ANNUITY', termMonths: 24, principal: 50_000_000 },
    },
    creditHistory: {
      repaidLoansCount: 0, activeLoansCount: 0, overdueSubstandardFlag: 0, otherObligations: 0,
      loansOver5MFlag: 'Мавжуд эмас', priorMfiPawnshopFlag: 'Мавжуд эмас',
      totalOutstandingDebt: 0, avgMonthlyPaymentExisting: 0,
    },
  }) as unknown as CreditCaseDto;

describe('a failing score does not gate the workflow', () => {
  const c = lowScoringCase();

  it('really does score badly — otherwise this test proves nothing', () => {
    const r = scoreForCase(c as never);
    expect(r.total).toBeLessThan(60);
    expect(r.verdict).toBe('BELOW_MIN');
  });

  it('still passes submit validation', () => {
    expect(caseSubmitErrors(c)).toEqual([]);
  });

  it('submit validation never mentions the score at all', () => {
    // Break every field, then check the resulting complaints are about data, not creditworthiness.
    const empty = { collaterals: [], borrower: {}, creditLine: {} } as unknown as CreditCaseDto;
    const problems = caseSubmitErrors(empty).join(' ').toLowerCase();
    expect(problems).not.toContain('skoring');
    expect(problems).not.toContain('ball');
    expect(problems).not.toContain('score');
  });

  it('no workflow transition is conditioned on a score', () => {
    // TransitionRule carries requiresFinalDocs and override — and nothing about scoring.
    for (const t of TRANSITIONS) {
      expect(Object.keys(t)).toEqual(
        expect.not.arrayContaining(['minScore', 'requiresScore', 'score', 'verdict']),
      );
    }
  });
});
