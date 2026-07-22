import { SECTOR_OTHER, SECTOR_RISK, sectorRiskCode, scoreForCase, caseSubmitErrors } from '@credit-core/shared';
import type { CreditCaseDto } from '@credit-core/shared';

describe('«Boshqa» sector', () => {
  it('is not one of the seventeen risk-coded activities', () => {
    expect(SECTOR_RISK.map((s) => s.label)).not.toContain(SECTOR_OTHER);
    expect(SECTOR_RISK).toHaveLength(17);
  });

  it('has no risk code — we cannot rate an activity we were not told', () => {
    expect(sectorRiskCode(SECTOR_OTHER)).toBeNull();
    expect(sectorRiskCode('Юриспруденция')).toBe(12);
    expect(sectorRiskCode(null)).toBeNull();
  });

  it('scores nothing for the sector, without disturbing the rest', () => {
    const withOther = scoreForCase({ employment: { sector: SECTOR_OTHER, sectorRiskCode: null } } as never);
    const f = withOther.factors.find((x) => x.key === 'sector')!;
    expect(f.points).toBe(0);
    expect(f.max).toBe(6);
  });

  it('still scores a coded sector normally', () => {
    const coded = scoreForCase({ employment: { sectorRiskCode: 5 } } as never);
    expect(coded.factors.find((x) => x.key === 'sector')!.points).toBe(6);
  });

  it('never blocks submit — the sector is optional at any amount', () => {
    const complete = (sector: string | null): CreditCaseDto => ({
      borrower: {
        fullName: 'A A', pinfl: '52101901234567', passportSeries: 'AD', passportNumber: '1234567',
        phone: '+998901112233',
        closeContacts: [
          { relation: 'Ota', fullName: 'X X', phone: '+998901112234' },
          { relation: 'Ona', fullName: 'Y Y', phone: '+998901112235' },
        ],
      },
      collaterals: [{
        type: 'AUTO', agreedValue: 80_000_000, model: 'M', stateNumber: '01 A 111 AA',
        techPassportNo: 'AAG 1111111', owners: [],
      }],
      creditLine: {
        amountTotal: 50_000_000, termMonths: 24,
        tranche: { scheduleType: 'ANNUITY', termMonths: 24, principal: 50_000_000 },
      },
      employment: { sector },
      creditHistory: {
        repaidLoansCount: 0, activeLoansCount: 0, overdueSubstandardFlag: 0, otherObligations: 0,
        loansOver5MFlag: 'Мавжуд эмас', priorMfiPawnshopFlag: 'Мавжуд эмас',
        totalOutstandingDebt: 0, avgMonthlyPaymentExisting: 0,
      },
    }) as unknown as CreditCaseDto;

    expect(caseSubmitErrors(complete(SECTOR_OTHER))).toEqual([]);
    expect(caseSubmitErrors(complete(null))).toEqual([]);
  });
});
