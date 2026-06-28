import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CaseStatus, DocumentType, ProductType, Role, ROLE_INBOX_STATUS } from '@credit-core/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../auth/current-user.decorator';
import { WorkflowService } from './workflow.service';
import { caseInclude, toCaseDto, toListItem } from './case.mapper';
import { RealEstateInput, TransitionDto, UpsertRealEstateCaseDto } from './dto';

const parseDate = (s?: string | null): Date | null => (s ? new Date(s) : null);

@Injectable()
export class CreditCasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflow: WorkflowService,
  ) {}

  private async nextNumber(branchSymbol: string | null): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `${branchSymbol ?? 'GEN'}-${year}-`;
    const count = await this.prisma.creditCase.count({
      where: { number: { startsWith: prefix } },
    });
    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }

  private realEstateData(re: RealEstateInput) {
    return {
      address: re.address,
      registryNo: re.registryNo ?? null,
      propertyType: re.propertyType ?? null,
      cadastreNo: re.cadastreNo ?? null,
      registrationDate: parseDate(re.registrationDate),
      totalAreaM2: re.totalAreaM2 ?? null,
      livingAreaM2: re.livingAreaM2 ?? null,
      roomNames: re.roomNames ?? null,
      roomCount: re.roomCount ?? null,
      agreedValue: re.agreedValue ?? null,
      agreedValueWords: re.agreedValueWords ?? null,
    };
  }

  async createRealEstate(user: RequestUser, dto: UpsertRealEstateCaseDto) {
    const branch = user.branchId
      ? await this.prisma.branch.findUnique({ where: { id: user.branchId } })
      : null;
    const number = await this.nextNumber(branch?.symbol ?? null);

    const owners = dto.realEstate.owners ?? [];

    const created = await this.prisma.creditCase.create({
      data: {
        number,
        productType: ProductType.REAL_ESTATE,
        status: CaseStatus.DRAFT,
        amount: dto.amount ?? null,
        termMonths: dto.termMonths ?? null,
        branchId: user.branchId,
        createdById: user.id,
        borrower: { create: { ...dto.borrower, birthDate: parseDate(dto.borrower.birthDate) } },
        realEstate: {
          create: {
            ...this.realEstateData(dto.realEstate),
            owners: { create: owners.map((o) => ({ ...o, sharePercent: o.sharePercent ?? null })) },
          },
        },
      },
      include: caseInclude,
    });
    return toCaseDto(created);
  }

  async updateRealEstate(id: string, user: RequestUser, dto: UpsertRealEstateCaseDto) {
    const existing = await this.prisma.creditCase.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Ish topilmadi');
    if (existing.status !== CaseStatus.DRAFT) {
      throw new ForbiddenException('Faqat qoralama holatidagi ishni tahrirlash mumkin');
    }
    if (user.role === Role.OPERATOR && existing.createdById !== user.id) {
      throw new ForbiddenException('Bu ish sizga tegishli emas');
    }

    const owners = dto.realEstate.owners ?? [];
    await this.prisma.$transaction([
      this.prisma.creditCase.update({
        where: { id },
        data: { amount: dto.amount ?? null, termMonths: dto.termMonths ?? null },
      }),
      this.prisma.borrower.upsert({
        where: { caseId: id },
        create: { caseId: id, ...dto.borrower, birthDate: parseDate(dto.borrower.birthDate) },
        update: { ...dto.borrower, birthDate: parseDate(dto.borrower.birthDate) },
      }),
      this.prisma.collateralOwner.deleteMany({ where: { collateral: { caseId: id } } }),
      this.prisma.realEstateCollateral.upsert({
        where: { caseId: id },
        create: {
          caseId: id,
          ...this.realEstateData(dto.realEstate),
          owners: { create: owners.map((o) => ({ ...o, sharePercent: o.sharePercent ?? null })) },
        },
        update: {
          ...this.realEstateData(dto.realEstate),
          owners: { create: owners.map((o) => ({ ...o, sharePercent: o.sharePercent ?? null })) },
        },
      }),
    ]);

    return this.getOne(id);
  }

  /** Role-scoped list: each role sees its inbox + (operators) their own drafts. */
  async list(user: RequestUser, mineOnly = false): Promise<ReturnType<typeof toListItem>[]> {
    const where: Prisma.CreditCaseWhereInput = {};

    if (user.role === Role.OPERATOR) {
      where.createdById = user.id;
    } else if (user.role === Role.MODERATOR) {
      where.status = mineOnly ? CaseStatus.MODERATION : { in: [CaseStatus.MODERATION, CaseStatus.DIRECTOR_REVIEW, CaseStatus.ADMIN_FINALIZE, CaseStatus.FINALIZED] };
      if (user.branchId) where.branchId = user.branchId;
    } else if (user.role === Role.DIRECTOR) {
      where.status = mineOnly ? CaseStatus.DIRECTOR_REVIEW : { in: [CaseStatus.DIRECTOR_REVIEW, CaseStatus.ADMIN_FINALIZE, CaseStatus.FINALIZED] };
    } else if (user.role === Role.ADMIN && mineOnly) {
      where.status = CaseStatus.ADMIN_FINALIZE;
    }

    const cases = await this.prisma.creditCase.findMany({
      where,
      include: { branch: true, borrower: true },
      orderBy: { updatedAt: 'desc' },
    });
    return cases.map(toListItem);
  }

  async getOne(id: string) {
    const c = await this.prisma.creditCase.findUnique({ where: { id }, include: caseInclude });
    if (!c) throw new NotFoundException('Ish topilmadi');
    return toCaseDto(c);
  }

  async transition(id: string, user: RequestUser, dto: TransitionDto) {
    const c = await this.prisma.creditCase.findUnique({
      where: { id },
      include: { documents: true },
    });
    if (!c) throw new NotFoundException('Ish topilmadi');

    const rule = this.workflow.resolve({
      currentStatus: c.status,
      role: user.role,
      decision: dto.decision,
      documentTypes: c.documents.map((d) => d.type as DocumentType),
    });

    await this.prisma.$transaction([
      this.prisma.creditCase.update({ where: { id }, data: { status: rule.to } }),
      this.prisma.workflowEvent.create({
        data: {
          caseId: id,
          fromStatus: c.status,
          toStatus: rule.to,
          decision: dto.decision,
          actorId: user.id,
          role: user.role,
          comment: dto.comment ?? null,
        },
      }),
    ]);

    return this.getOne(id);
  }

  async setKatmPrice(id: string, katmPrice: number) {
    await this.prisma.creditCase.update({ where: { id }, data: { katmPrice } });
    return this.getOne(id);
  }
}
