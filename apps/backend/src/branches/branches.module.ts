import { Body, Controller, Get, Post, Put, Param, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, MinLength } from 'class-validator';
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
}

@UseGuards(JwtAuthGuard)
@Controller('branches')
class BranchesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.branch.findMany({ orderBy: { name: 'asc' } });
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: UpsertBranchDto) {
    return this.prisma.branch.create({ data: dto });
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpsertBranchDto) {
    return this.prisma.branch.update({ where: { id }, data: dto });
  }
}

@Module({ controllers: [BranchesController] })
export class BranchesModule {}
