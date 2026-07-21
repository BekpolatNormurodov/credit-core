/**
 * Dev-only: create a fully populated case parked at DIRECTOR_REVIEW so the director's E-IMZO
 * signing can be exercised end to end without walking the whole operator wizard first.
 *
 * Data mirrors the reference workbooks (Latin names and addresses, Cyrillic form text), so the
 * documents it produces are the ones the forms were checked against.
 *
 *   DATABASE_URL="mysql://root:root@localhost:3307/credit_core" npx ts-node prisma/seed-sign-test.ts
 *
 * Re-runnable: it removes its own previous case first.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const NUMBER = 'TEST-SIGN-001';

async function main() {
  const director = await prisma.user.findFirst({ where: { role: 'DIRECTOR' } });
  const operator = await prisma.user.findFirst({ where: { role: 'OPERATOR' } });
  const branch = await prisma.branch.findFirst();
  if (!director || !operator) throw new Error('Run `npm run db:seed` first — no users found.');

  await prisma.creditCase.deleteMany({ where: { number: NUMBER } });

  const c = await prisma.creditCase.create({
    data: {
      number: NUMBER,
      productType: 'REAL_ESTATE',
      status: 'DIRECTOR_REVIEW',
      amount: 150_000_000,
      termMonths: 33,
      contractGlobalNo: 2110,
      contractYearlyNo: 1416,
      contractBranchSym: branch?.symbol ?? 'BR',
      contractNumber: '2110 MFL 1416 PS',
      branchId: branch?.id ?? null,
      createdById: operator.id,
      stepStartedAt: new Date(),

      borrower: {
        create: {
          fullName: 'JOLDIBAYEV RUSLAN ODILOVICH',
          passportSeries: 'AD',
          passportNumber: '4156235',
          passportIssuer: 'TOSHKENT SHAHAR CHILONZOR TUMANI IIB',
          passportIssueDate: new Date('2023-08-03T00:00:00.000Z'),
          pinfl: '52101901234567',
          birthDate: new Date('1990-05-12T00:00:00.000Z'),
          inn: '301456789',
          phone: '+998 90 123 45 67',
          address: 'TOSHKENT SHAHAR CHILONZOR TUMANI BUNYODKOR MFY 12-UY',
          regAddress: 'TOSHKENT SHAHAR CHILONZOR TUMANI BUNYODKOR MFY 12-UY 34-XONADON',
          entrepreneurType: "O'ZINI O'ZI BAND QILGAN FUQARO",
          entrepreneurCertNo: '0013546591',
        },
      },

      creditLine: {
        create: {
          lineNumber: '1416',
          orderNumber: '2110 MFL 1416 PS',
          lineDate: new Date('2026-01-05T00:00:00.000Z'),
          loanType: 'MICROCREDIT',
          amountAuto: 120_000_000,
          amountPolis: 30_000_000,
          amountTotal: 150_000_000,
          termMonths: 33,
          interestRate: 0.55,
          penaltyRate: 1.05,
          tranches: {
            create: [{
              trancheNo: 1,
              applicationDate: new Date('2026-01-05T00:00:00.000Z'),
              principal: 150_000_000,
              termMonths: 33,
              scheduleType: 'ANNUITY',
              paymentDay: 5,
            }],
          },
        },
      },

      collaterals: {
        create: [{
          type: 'REAL_ESTATE',
          realtyKind: 'APARTMENT',
          propertyType: "KO'P QAVATLI UYDAGI XONADON",
          agreedValue: 266_000_000,
          address: 'TOSHKENT SHAHAR YUNUSOBOD TUMANI ADOLAT MFY 4-MAVZE 61-A-UY 51-XONADON',
          registryNo: '№ 1726266/R-A0000000 от 25.09.2023г.',
          cadastreNo: '№ 10:07:06:01:01:5091:0001:051 от 25.09.2023г.',
          totalAreaM2: 79.76,
          livingAreaM2: 52.89,
          usableAreaM2: 78.42,
          landAreaM2: 198,
          roomCount: 3,
          roomNames: 'ZAL, OSHXONA, 2 TA YOTOQXONA',
          owners: { create: [{ fullName: 'BAYMIRZAYEVA GULNORA MURATOVNA' }] },
        }],
      },
    },
  });

  // eslint-disable-next-line no-console
  console.log(`✅ Ariza tayyor: ${c.number} (${c.id}) — status DIRECTOR_REVIEW`);
  // eslint-disable-next-line no-console
  console.log(`   director/parol123 bilan kiring va «Kalit bilan imzolash» ni bosing.`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
