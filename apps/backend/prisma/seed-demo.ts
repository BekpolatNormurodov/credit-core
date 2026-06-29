import { PrismaClient, ProductType, Gender, LoanType, RepaymentMethod, ScoringVerdict, CaseStatus } from '@prisma/client';

const prisma = new PrismaClient();
const DEMO_NUMBER = 'DEMO-1199-TR';

async function main() {
  await prisma.creditCase.deleteMany({ where: { number: DEMO_NUMBER } });

  await prisma.organization.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      nameMixed: 'МЧЖ «CLEVER Mikromoliya Tashkiloti»',
      nameUpper: 'МЧЖ «CLEVER MIKROMOLIYA TASHKILOTI»',
      nameSuffix: '«CLEVER MIKROMOLIYA TASHKILOTI» МЧЖ',
      directorShort: 'Б.Исмоилов',
      directorFull: 'Исмоилов Баҳромжон Ахрор ўғли',
      address: 'Тошкент шахар, Олмазор тумани, Сагбон 30 берк кўча, 6 уй',
      bankAccount: '20216000105068380006',
      bankMfo: '01183',
      bankName: 'АЖ «ANORBANK»',
      inn: '306365847',
      licenseNo: '61',
      licenseDate: new Date('2019-06-22T00:00:00Z'),
    },
  });

  const operator = await prisma.user.findUniqueOrThrow({ where: { login: 'operator' } });
  const branch = await prisma.branch.findUniqueOrThrow({ where: { symbol: 'BR' } });

  await prisma.creditCase.create({
    data: {
      number: DEMO_NUMBER,
      productType: ProductType.REAL_ESTATE,
      status: CaseStatus.MODERATION,
      amount: '150000000',
      termMonths: 60,
      branchId: branch.id,
      createdById: operator.id,
      borrower: {
        create: {
          fullName: 'TADJIYEV ATABEK JANGIROVICH',
          gender: Gender.MALE,
          citizenship: 'Ўзбекистон Республикаси',
          placeOfBirth: "TO'RTKO'L SHAHRI",
          birthDate: new Date('1979-06-24T00:00:00Z'),
          pinfl: '32406793420044',
          passportSeries: 'KA',
          passportNumber: '1191531',
          passportIssuer: "QORAQALPOG'ISTON RESPUBLIKASI TO'RTKO'L TUMANI IIB",
          passportExpiry: new Date('2028-08-07T00:00:00Z'),
          regAddress: "QORAQALPOG'ISTON RESPUBLIKASI TO'RTKO'L TUMANI TINCHLIK MFY ERKIN KO'CHASI 33-UY",
          phones: [{ number: '91-269-79-00', owner: 'OZI' }],
          maritalStatus: 'турмуш курган',
          familySize: 5,
          childrenCount: 3,
          education: 'олий',
        },
      },
      affordability: { create: { avgMonthlyIncome: '18838000', dtiRatio: 0.4545, surplus: '8336647', netAfterDebt: '10275647' } },
      creditHistory: { create: { repaidLoansCount: 2, activeLoansCount: 0, overdueSubstandardFlag: 0, otherObligations: 0, totalOutstandingDebt: '4654239', avgMonthlyPaymentExisting: '502353', committeeProtocolRef: '73-2020' } },
      scoring: {
        create: {
          totalScore: 77, maxScore: 100, verdict: ScoringVerdict.APPROVED, age: 47,
          factors: { create: [{ factorNo: 19, name: 'Транш/доход', points: 22, maxPoints: 22 }] },
        },
      },
      incomeCertificate: { create: { employer: 'XususiyTadbirkor', certNo: 'SPR-1', certDate: new Date('2026-06-20T00:00:00Z'), avgMonthlyNet: '18838000' } },
      creditLine: {
        create: {
          lineNumber: '№ 1199 TR', loanType: LoanType.MICROCREDIT,
          amountAuto: '90000000', amountPolis: '60000000', amountTotal: '150000000',
          termMonths: 60, lineDate: new Date('2026-06-25T00:00:00Z'), interestRate: '0.5500', penaltyRate: '1.0500', orderNumber: '1881 MFL 1199 TR',
          insurance: { create: { insured: true, company: 'АО "TRUST INSURANCE"', policyTermMonths: 24, loanUnderPolicy: '60000000', insuredSum: '78000000', insuranceRate: '0.0200', premium: '3120000' } },
          tranches: { create: [{ trancheNo: 1, applicationNo: '№ 1881 MFL 1199 TR', applicationDate: new Date('2026-06-25T00:00:00Z'), principal: '130000000', termMonths: 30, scheduleType: RepaymentMethod.ANNUITY, monthlyPayment: '8060000', insurancePayment: '3120000' }] },
        },
      },
      collaterals: {
        create: [{
          type: ProductType.REAL_ESTATE, agreedValue: '126000000', position: 1,
          address: "QORAQALPOG'ISTON RESPUBLIKASI TO'RTKO'L TUMANI", propertyType: 'YAKKA TARTIBDAGI TURAR JOY',
          cadastreNo: '35:04:0000', totalAreaM2: 120.5, livingAreaM2: 85, roomCount: 4,
          owners: { create: [{ fullName: 'TADJIYEV ATABEK JANGIROVICH', isBorrowerOwner: true, sharePercent: 100 }] },
        }],
      },
    },
  });

  // eslint-disable-next-line no-console
  console.log('✅ Demo case seeded:', DEMO_NUMBER, '(status MODERATION — documents available + watermarked)');
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
