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
  list() {
    return this.prisma.branch.findMany({ orderBy: { name: 'asc' }, include: branchInclude });
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
