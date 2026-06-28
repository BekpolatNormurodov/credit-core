import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { addBusinessDays, CaseStatus, DocumentType, hasDeadline, ProductType, Role } from '@credit-core/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../auth/current-user.decorator';
import { WorkflowService } from './workflow.service';
import { caseInclude, toCaseDto, toListItem } from './case.mapper';
import { CollateralInput, TransitionDto, UpsertCaseDto } from './dto';

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
    const count = await this.prisma.creditCase.count({ where: { number: { startsWith: prefix } } });
    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }

  private collateralCreate(c: CollateralInput): Prisma.CollateralCreateWithoutCaseInput {
    return {
      type: c.type,
      agreedValue: c.agreedValue ?? null,
      agreedValueWords: c.agreedValueWords ?? null,
      address: c.address ?? null,
      registryNo: c.registryNo ?? null,
      propertyType: c.propertyType ?? null,
      cadastreNo: c.cadastreNo ?? null,
      registrationDate: parseDate(c.registrationDate),
      totalAreaM2: c.totalAreaM2 ?? null,
      livingAreaM2: c.livingAreaM2 ?? null,
      roomNames: c.roomNames ?? null,
      roomCount: c.roomCount ?? null,
      techPassportNo: c.techPassportNo ?? null,
      techPassportDate: parseDate(c.techPassportDate),
      model: c.model ?? null,
      stateNumber: c.stateNumber ?? null,
      bodyType: c.bodyType ?? null,
      bodyNo: c.bodyNo ?? null,
      engineNo: c.engineNo ?? null,
      chassis: c.chassis ?? null,
      color: c.color ?? null,
      year: c.year ?? null,
      mileage: c.mileage ?? null,
      owners: { create: (c.owners ?? []).map((o) => ({ ...o, sharePercent: o.sharePercent ?? null })) },
    };
  }

  async createCase(user: RequestUser, dto: UpsertCaseDto) {
    const branch = user.branchId
      ? await this.prisma.branch.findUnique({ where: { id: user.branchId } })
      : null;
    const number = await this.nextNumber(branch?.symbol ?? null);
    const productType = dto.collaterals[0]?.type ?? ProductType.REAL_ESTATE;

    const created = await this.prisma.creditCase.create({
      data: {
        number,
        productType,
        status: CaseStatus.DRAFT,
        amount: dto.amount ?? null,
        termMonths: dto.termMonths ?? null,
        branchId: user.branchId,
        createdById: user.id,
        borrower: { create: { ...dto.borrower, birthDate: parseDate(dto.borrower.birthDate) } },
        guarantors: { create: (dto.guarantors ?? []).map((g) => ({ ...g })) },
        collaterals: { create: dto.collaterals.map((c) => this.collateralCreate(c)) },
      },
      include: caseInclude,
    });
    return toCaseDto(created);
  }

  async updateCase(id: string, user: RequestUser, dto: UpsertCaseDto) {
    const existing = await this.prisma.creditCase.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Ariza topilmadi');
    if (existing.status !== CaseStatus.DRAFT) {
      throw new ForbiddenException('Faqat qoralama holatidagi arizani tahrirlash mumkin');
    }
    if (user.role === Role.OPERATOR && existing.createdById !== user.id) {
      throw new ForbiddenException('Bu ariza sizga tegishli emas');
    }

    await this.prisma.$transaction([
      this.prisma.creditCase.update({
        where: { id },
        data: {
          amount: dto.amount ?? null,
          termMonths: dto.termMonths ?? null,
          productType: dto.collaterals[0]?.type ?? existing.productType,
        },
      }),
      this.prisma.borrower.upsert({
        where: { caseId: id },
        create: { caseId: id, ...dto.borrower, birthDate: parseDate(dto.borrower.birthDate) },
        update: { ...dto.borrower, birthDate: parseDate(dto.borrower.birthDate) },
      }),
      this.prisma.guarantor.deleteMany({ where: { caseId: id } }),
      ...(dto.guarantors ?? []).map((g) => this.prisma.guarantor.create({ data: { caseId: id, ...g } })),
      this.prisma.collateral.deleteMany({ where: { caseId: id } }),
      ...dto.collaterals.map((c) =>
        this.prisma.collateral.create({ data: { caseId: id, ...this.collateralCreate(c) } }),
      ),
    ]);

    return this.getOne(id);
  }

  async list(user: RequestUser, mineOnly = false): Promise<ReturnType<typeof toListItem>[]> {
    const where: Prisma.CreditCaseWhereInput = {};
    if (user.role === Role.OPERATOR) {
      where.createdById = user.id;
    } else if (user.role === Role.MODERATOR) {
      where.status = mineOnly
        ? CaseStatus.MODERATION
        : { in: [CaseStatus.MODERATION, CaseStatus.DIRECTOR_REVIEW, CaseStatus.ADMIN_FINALIZE, CaseStatus.FINALIZED, CaseStatus.CANCELLED] };
      // A moderator only sees cases from the branches assigned to them.
      const assigned = await this.prisma.branch.findMany({
        where: { moderators: { some: { id: user.id } } },
        select: { id: true },
      });
      where.branchId = { in: assigned.map((b) => b.id) };
    } else if (user.role === Role.DIRECTOR) {
      // Director oversees the whole active pipeline (may force-finalize/cancel any step).
      where.status = mineOnly
        ? CaseStatus.DIRECTOR_REVIEW
        : { in: [CaseStatus.MODERATION, CaseStatus.DIRECTOR_REVIEW, CaseStatus.ADMIN_FINALIZE, CaseStatus.FINALIZED, CaseStatus.CANCELLED] };
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

  /** Role-scoped visibility base (no mineOnly status narrowing). */
  private async scopeWhere(user: RequestUser): Promise<Prisma.CreditCaseWhereInput> {
    if (user.role === Role.OPERATOR) return { createdById: user.id };
    if (user.role === Role.MODERATOR) {
      const assigned = await this.prisma.branch.findMany({
        where: { moderators: { some: { id: user.id } } },
        select: { id: true },
      });
      return {
        branchId: { in: assigned.map((b) => b.id) },
        status: { in: [CaseStatus.MODERATION, CaseStatus.DIRECTOR_REVIEW, CaseStatus.ADMIN_FINALIZE, CaseStatus.FINALIZED, CaseStatus.CANCELLED] },
      };
    }
    if (user.role === Role.DIRECTOR) {
      return { status: { in: [CaseStatus.MODERATION, CaseStatus.DIRECTOR_REVIEW, CaseStatus.ADMIN_FINALIZE, CaseStatus.FINALIZED, CaseStatus.CANCELLED] } };
    }
    return {}; // ADMIN — all
  }

  /** Global search across number, borrower, guarantor, operator and branch. */
  async search(user: RequestUser, q: string): Promise<ReturnType<typeof toListItem>[]> {
    const term = q.trim();
    if (term.length < 2) return [];
    const scope = await this.scopeWhere(user);
    const cases = await this.prisma.creditCase.findMany({
      where: {
        AND: [
          scope,
          {
            OR: [
              { number: { contains: term } },
              { borrower: { fullName: { contains: term } } },
              { borrower: { passportNumber: { contains: term } } },
              { borrower: { pinfl: { contains: term } } },
              { guarantors: { some: { fullName: { contains: term } } } },
              { createdBy: { fullName: { contains: term } } },
              { branch: { name: { contains: term } } },
              { branch: { symbol: { contains: term } } },
            ],
          },
        ],
      },
      include: { branch: true, borrower: true },
      orderBy: { updatedAt: 'desc' },
      take: 8,
    });
    return cases.map(toListItem);
  }

  async getOne(id: string) {
    const c = await this.prisma.creditCase.findUnique({ where: { id }, include: caseInclude });
    if (!c) throw new NotFoundException('Ariza topilmadi');
    return toCaseDto(c);
  }

  /** Deadline/timer fields to write when a case enters `to` (any transition clears a pause). */
  private async stepTimerData(to: CaseStatus): Promise<Prisma.CreditCaseUpdateInput> {
    const now = new Date();
    if (!hasDeadline(to)) {
      // Terminal / draft — no timer.
      return { stepStartedAt: now, stepDeadlineAt: null, overdueNotified: false, pausedAt: null };
    }
    const setting = await this.prisma.stepSetting.findUnique({ where: { step: to } });
    const enabled = setting?.enabled ?? true;
    const days = setting?.businessDays ?? 2;
    if (!enabled) {
      // Step timer switched off by admin — no deadline.
      return { stepStartedAt: now, stepDeadlineAt: null, overdueNotified: false, pausedAt: null };
    }
    return { stepStartedAt: now, stepDeadlineAt: addBusinessDays(now, days), overdueNotified: false, pausedAt: null };
  }

  /** Put an active case on hold — suspends its SLA timer (moderator/director/admin). */
  async pause(id: string) {
    const c = await this.prisma.creditCase.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Ariza topilmadi');
    if (!hasDeadline(c.status)) throw new ForbiddenException('Faqat aktiv bosqichdagi arizani pauzaga qo‘yish mumkin');
    if (!c.pausedAt) await this.prisma.creditCase.update({ where: { id }, data: { pausedAt: new Date() } });
    return this.getOne(id);
  }

  /** Resume a paused case — shifts its deadline forward by the paused time (capped at maxPauseDays). */
  async resume(id: string) {
    const c = await this.prisma.creditCase.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Ariza topilmadi');
    if (!c.pausedAt) return this.getOne(id);
    const cfg = await this.prisma.appConfig.findUnique({ where: { id: 'default' } });
    const maxMs = (cfg?.maxPauseDays ?? 5) * 24 * 60 * 60 * 1000;
    const ext = Math.min(Date.now() - c.pausedAt.getTime(), maxMs);
    const newDeadline = c.stepDeadlineAt ? new Date(c.stepDeadlineAt.getTime() + ext) : null;
    await this.prisma.creditCase.update({
      where: { id },
      data: { pausedAt: null, stepDeadlineAt: newDeadline, overdueNotified: false },
    });
    return this.getOne(id);
  }

  async transition(id: string, user: RequestUser, dto: TransitionDto) {
    const c = await this.prisma.creditCase.findUnique({ where: { id }, include: { documents: true } });
    if (!c) throw new NotFoundException('Ariza topilmadi');

    const rule = this.workflow.resolve({
      currentStatus: c.status,
      role: user.role,
      decision: dto.decision,
      documentTypes: c.documents.map((d) => d.type as DocumentType),
    });

    const timer = await this.stepTimerData(rule.to);

    await this.prisma.$transaction([
      this.prisma.creditCase.update({ where: { id }, data: { status: rule.to, ...timer } }),
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
