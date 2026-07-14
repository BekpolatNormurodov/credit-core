import { PrismaService } from '../../prisma/prisma.service';

/** Load a case with all SP-1 relations needed to render documents. */
export async function loadCaseForDocs(prisma: PrismaService, id: string) {
  const c = await prisma.creditCase.findUnique({
    where: { id },
    include: {
      branch: true,
      borrower: true,
      collaterals: { include: { owners: true } },
      creditLine: {
        include: {
          tranches: {
            orderBy: { trancheNo: 'asc' },
            include: { schedule: { include: { installments: { orderBy: { seq: 'asc' } } } } },
          },
          insurance: true,
        },
      },
      affordability: true,
      creditHistory: true,
      scoring: { include: { factors: true } },
      incomeCertificate: { include: { months: true } },
      disbursement: true,
      documents: true,
    },
  });
  if (!c) return null;
  const organization = await prisma.organization.findUnique({ where: { id: 'default' } });
  return { ...c, organization };
}

export type CaseDocData = NonNullable<Awaited<ReturnType<typeof loadCaseForDocs>>>;
