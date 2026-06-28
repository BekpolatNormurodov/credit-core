import { Prisma } from '@prisma/client';
import { CollateralDto, CreditCaseDto, CreditCaseListItem } from '@credit-core/shared';

export const caseInclude = {
  branch: true,
  createdBy: true,
  borrower: true,
  collaterals: { include: { owners: true }, orderBy: { createdAt: 'asc' } },
  documents: { include: { uploadedBy: true }, orderBy: { createdAt: 'asc' } },
  events: { include: { actor: true }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.CreditCaseInclude;

type CaseWithRelations = Prisma.CreditCaseGetPayload<{ include: typeof caseInclude }>;
type CollateralRow = CaseWithRelations['collaterals'][number];

const num = (d: Prisma.Decimal | null): number | null => (d == null ? null : Number(d));
const iso = (d: Date | null): string | null => (d == null ? null : d.toISOString());

function toCollateral(c: CollateralRow): CollateralDto {
  return {
    id: c.id,
    type: c.type,
    agreedValue: num(c.agreedValue),
    agreedValueWords: c.agreedValueWords,
    address: c.address,
    registryNo: c.registryNo,
    propertyType: c.propertyType,
    cadastreNo: c.cadastreNo,
    registrationDate: iso(c.registrationDate),
    totalAreaM2: c.totalAreaM2,
    livingAreaM2: c.livingAreaM2,
    roomNames: c.roomNames,
    roomCount: c.roomCount,
    techPassportNo: c.techPassportNo,
    techPassportDate: iso(c.techPassportDate),
    model: c.model,
    stateNumber: c.stateNumber,
    bodyType: c.bodyType,
    bodyNo: c.bodyNo,
    engineNo: c.engineNo,
    chassis: c.chassis,
    color: c.color,
    year: c.year,
    mileage: c.mileage,
    owners: c.owners.map((o) => ({
      id: o.id,
      fullName: o.fullName,
      passportSeries: o.passportSeries,
      passportNumber: o.passportNumber,
      pinfl: o.pinfl,
      sharePercent: o.sharePercent,
    })),
  };
}

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
    collaterals: c.collaterals.map(toCollateral),
    documents: c.documents.map((d) => ({
      id: d.id,
      type: d.type,
      fileName: d.fileName,
      isGenerated: d.isGenerated,
      uploadedAt: d.createdAt.toISOString(),
      uploadedByName: d.uploadedBy?.fullName ?? null,
      mimeType: d.mimeType,
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
