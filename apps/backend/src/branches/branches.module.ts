import { Body, Controller, Get, Post, Put, Param, UseGuards } from '@nestjs/common';
import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';
import { Module } from '@nestjs/common';
import { Role } from '@credit-core/shared';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

class UpsertBranchDto {
  @IsString() @MinLength(1) name!: string;
  @IsString() @MinLength(1) symbol!: string;
  @IsOptional() @IsString() region?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) moderatorIds?: string[];
}

const branchInclude = { moderators: { select: { id: true, fullName: true }, orderBy: { fullName: 'asc' as const } } };

@UseGuards(JwtAuthGuard)
@Controller('branches')
class BranchesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list() {
    const [branches, sums] = await Promise.all([
      this.prisma.branch.findMany({
        orderBy: { name: 'asc' },
        include: { ...branchInclude, _count: { select: { cases: true } } },
      }),
      this.prisma.creditCase.groupBy({ by: ['branchId'], _sum: { amount: true } }),
    ]);
    const sumByBranch = new Map(sums.map((s) => [s.branchId, s._sum.amount ? Number(s._sum.amount) : 0]));
    return branches.map((b) => ({
      id: b.id,
      name: b.name,
      symbol: b.symbol,
      region: b.region,
      moderators: b.moderators,
      caseCount: b._count.cases,
      totalAmount: sumByBranch.get(b.id) ?? 0,
    }));
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: UpsertBranchDto) {
    const { moderatorIds, ...rest } = dto;
    return this.prisma.branch.create({
      data: { ...rest, moderators: moderatorIds?.length ? { connect: moderatorIds.map((id) => ({ id })) } : undefined },
      include: branchInclude,
    });
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpsertBranchDto) {
    const { moderatorIds, ...rest } = dto;
    return this.prisma.branch.update({
      where: { id },
      // `set` replaces the full moderator list when moderatorIds is provided.
      data: { ...rest, moderators: moderatorIds ? { set: moderatorIds.map((mid) => ({ id: mid })) } : undefined },
      include: branchInclude,
    });
  }
}

@Module({ controllers: [BranchesController] })
export class BranchesModule {}
