import { Controller, Get, Module, UseGuards } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CaseStatus, ProductType, Role, StatsResponse } from '@credit-core/shared';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../auth/current-user.decorator';

async function scopeFor(prisma: PrismaService, user: RequestUser): Promise<Prisma.CreditCaseWhereInput> {
  if (user.role === Role.OPERATOR) return { createdById: user.id };
  if (user.role === Role.MODERATOR) {
    const assigned = await prisma.branch.findMany({ where: { moderators: { some: { id: user.id } } }, select: { id: true } });
    return { branchId: { in: assigned.map((b) => b.id) } };
  }
  return {};
}

@UseGuards(JwtAuthGuard)
@Controller('stats')
class StatsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async stats(@CurrentUser() user: RequestUser): Promise<StatsResponse> {
    const where = await scopeFor(this.prisma, user);

    const [byStatusRaw, all, branches, collaterals] = await Promise.all([
      this.prisma.creditCase.groupBy({ by: ['status'], where, _count: { _all: true } }),
      this.prisma.creditCase.findMany({
        where,
        select: { amount: true, katmPrice: true, status: true, branchId: true, productType: true, createdAt: true },
      }),
      this.prisma.branch.findMany({ select: { id: true, symbol: true } }),
      this.prisma.collateral.findMany({ where: { case: where }, select: { agreedValue: true } }),
    ]);

    const byStatus = (Object.values(CaseStatus) as CaseStatus[]).map((status) => ({
      status,
      count: byStatusRaw.find((b) => b.status === status)?._count._all ?? 0,
    }));

    const branchMap = new Map(branches.map((b) => [b.id, b.symbol]));
    const branchCounts = new Map<string, number>();
    const productAgg = new Map<ProductType, { count: number; amount: number }>();
    const monthAgg = new Map<string, { count: number; amount: number }>();
    let totalAmount = 0;
    let totalKatm = 0;
    for (const c of all) {
      const amt = c.amount ? Number(c.amount) : 0;
      totalAmount += amt;
      totalKatm += c.katmPrice ? Number(c.katmPrice) : 0;
      const key = c.branchId ? branchMap.get(c.branchId) ?? '—' : '—';
      branchCounts.set(key, (branchCounts.get(key) ?? 0) + 1);
      const p = c.productType as ProductType;
      const pa = productAgg.get(p) ?? { count: 0, amount: 0 };
      productAgg.set(p, { count: pa.count + 1, amount: pa.amount + amt });
      const mk = `${c.createdAt.getFullYear()}-${String(c.createdAt.getMonth() + 1).padStart(2, '0')}`;
      const ma = monthAgg.get(mk) ?? { count: 0, amount: 0 };
      monthAgg.set(mk, { count: ma.count + 1, amount: ma.amount + amt });
    }

    // Last 6 calendar months (oldest → newest), zero-filled.
    const now = new Date();
    const byMonth = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const v = monthAgg.get(mk) ?? { count: 0, amount: 0 };
      return { month: mk, count: v.count, amount: v.amount };
    });

    const totalCollateralValue = collaterals.reduce((s, c) => s + (c.agreedValue ? Number(c.agreedValue) : 0), 0);
    const finalizedCount = byStatus.find((s) => s.status === CaseStatus.FINALIZED)?.count ?? 0;
    const activeCount = all.length - finalizedCount - (byStatus.find((s) => s.status === CaseStatus.REJECTED)?.count ?? 0);

    const recentRaw = await this.prisma.creditCase.findMany({
      where,
      include: { branch: true, borrower: true },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    });

    return {
      byStatus,
      byBranch: [...branchCounts.entries()].map(([branch, count]) => ({ branch, count })),
      byProduct: (Object.values(ProductType) as ProductType[]).map((product) => ({
        product,
        count: productAgg.get(product)?.count ?? 0,
        amount: productAgg.get(product)?.amount ?? 0,
      })),
      byMonth,
      totalCases: all.length,
      totalAmount,
      totalKatm,
      totalCollateralValue,
      avgAmount: all.length ? Math.round(totalAmount / all.length) : 0,
      approvalRate: all.length ? finalizedCount / all.length : 0,
      finalizedCount,
      activeCount,
      recent: recentRaw.map((c) => ({
        id: c.id,
        number: c.number,
        productType: c.productType,
        status: c.status,
        amount: c.amount ? Number(c.amount) : null,
        borrowerName: c.borrower?.fullName ?? null,
        branchSymbol: c.branch?.symbol ?? null,
        updatedAt: c.updatedAt.toISOString(),
      })),
    };
  }
}

@Module({ controllers: [StatsController] })
export class StatsModule {}
