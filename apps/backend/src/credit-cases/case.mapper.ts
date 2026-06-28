import { Prisma } from '@prisma/client';
import { CreditCaseDto, CreditCaseListItem } from '@credit-core/shared';

export const caseInclude = {
  branch: true,
  createdBy: true,
  borrower: true,
  realEstate: { include: { owners: true } },
  documents: { orderBy: { createdAt: 'asc' } },
  events: { include: { actor: true }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.CreditCaseInclude;

type CaseWithRelations = Prisma.CreditCaseGetPayload<{ include: typeof caseInclude }>;

const num = (d: Prisma.Decimal | null): number | null => (d == null ? null : Number(d));
const iso = (d: Date | null): string | null => (d == null ? null : d.toISOString());

export function toCaseDto(c: CaseWithRelations): CreditCaseDto {
  return {
    id: c.id,
    number: c.number,
    productType: c.productType,
    status: c.status,
    amount: num(c.amount),
    termMonths: c.termMonths,
    katmPrice: num(c.katmPrice),
    branch: c.branch
      ? { id: c.branch.id, name: c.branch.name, symbol: c.branch.symbol, region: c.branch.region }
      : null,
    createdByName: c.createdBy.fullName,
    borrower: c.borrower
      ? {
          id: c.borrower.id,
          fullName: c.borrower.fullName,
          passportSeries: c.borrower.passportSeries,
          passportNumber: c.borrower.passportNumber,
          pinfl: c.borrower.pinfl,
          birthDate: iso(c.borrower.birthDate),
          address: c.borrower.address,
          phone: c.borrower.phone,
        }
      : null,
    realEstate: c.realEstate
      ? {
          id: c.realEstate.id,
          address: c.realEstate.address,
          registryNo: c.realEstate.registryNo,
          propertyType: c.realEstate.propertyType,
          cadastreNo: c.realEstate.cadastreNo,
          registrationDate: iso(c.realEstate.registrationDate),
          totalAreaM2: c.realEstate.totalAreaM2,
          livingAreaM2: c.realEstate.livingAreaM2,
          roomNames: c.realEstate.roomNames,
          roomCount: c.realEstate.roomCount,
          agreedValue: num(c.realEstate.agreedValue),
          agreedValueWords: c.realEstate.agreedValueWords,
          owners: c.realEstate.owners.map((o) => ({
            id: o.id,
            fullName: o.fullName,
            passportSeries: o.passportSeries,
            passportNumber: o.passportNumber,
            pinfl: o.pinfl,
            sharePercent: o.sharePercent,
          })),
        }
      : null,
    documents: c.documents.map((d) => ({
      id: d.id,
      type: d.type,
      fileName: d.fileName,
      isGenerated: d.isGenerated,
      uploadedAt: d.createdAt.toISOString(),
      url: `/api/documents/${d.id}/download`,
    })),
    events: c.events.map((e) => ({
      id: e.id,
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      decision: e.decision,
      actorName: e.actor.fullName,
      role: e.role,
      comment: e.comment,
      createdAt: e.createdAt.toISOString(),
    })),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export function toListItem(
  c: Prisma.CreditCaseGetPayload<{ include: { branch: true; borrower: true } }>,
): CreditCaseListItem {
  return {
    id: c.id,
    number: c.number,
    productType: c.productType,
    status: c.status,
    amount: num(c.amount),
    borrowerName: c.borrower?.fullName ?? null,
    branchSymbol: c.branch?.symbol ?? null,
    updatedAt: c.updatedAt.toISOString(),
  };
}
