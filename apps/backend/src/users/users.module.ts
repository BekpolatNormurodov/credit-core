import { Body, Controller, Get, Module, Post, Put, Param, UseGuards } from '@nestjs/common';
import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import * as bcrypt from 'bcryptjs';
import { Role } from '@credit-core/shared';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

class CreateUserDto {
  @IsString() @MinLength(1) fullName!: string;
  @IsString() @MinLength(3) login!: string;
  @IsString() @MinLength(4) password!: string;
  @IsEnum(Role) role!: Role;
  @IsOptional() @IsString() branchId?: string;
}

class UpdateUserDto {
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsEnum(Role) role?: Role;
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() @MinLength(4) password?: string;
}

const userSelect = {
  id: true,
  fullName: true,
  login: true,
  role: true,
  branchId: true,
  isActive: true,
  branch: { select: { id: true, name: true, symbol: true } },
};

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('users')
class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.user.findMany({ select: userSelect, orderBy: { fullName: 'asc' } });
  }

  @Post()
  async create(@Body() dto: CreateUserDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        login: dto.login,
        role: dto.role,
        branchId: dto.branchId ?? null,
        passwordHash,
      },
      select: userSelect,
    });
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    const data: Record<string, unknown> = {
      fullName: dto.fullName,
      role: dto.role,
      branchId: dto.branchId,
      isActive: dto.isActive,
    };
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.update({ where: { id }, data, select: userSelect });
  }
}

@Module({ controllers: [UsersController] })
export class UsersModule {}
