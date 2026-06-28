import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Module,
  NotFoundException,
  Post,
  Put,
  Param,
  Query,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import * as bcrypt from 'bcryptjs';
import { Role } from '@credit-core/shared';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, RequestUser } from '../auth/current-user.decorator';
import { StorageService } from '../documents/storage.service';

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

// Admin-only controller, so returning the plaintext credential here is intentional
// (internal credential-distribution tool). Never expose this select to other roles.
const userSelect = {
  id: true,
  fullName: true,
  login: true,
  plainPassword: true,
  avatarPath: true,
  role: true,
  branchId: true,
  isActive: true,
  branch: { select: { id: true, name: true, symbol: true } },
};

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('users')
class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly jwt: JwtService,
  ) {}

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
        plainPassword: dto.password,
      },
      select: userSelect,
    });
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() actor: RequestUser) {
    // Lockout guards: don't let an admin block themselves or the last active admin.
    const deactivating = dto.isActive === false;
    const demoting = dto.role !== undefined && dto.role !== Role.ADMIN;
    if (deactivating || demoting) {
      const target = await this.prisma.user.findUnique({ where: { id }, select: { role: true, isActive: true } });
      if (!target) throw new NotFoundException('Foydalanuvchi topilmadi');
      if (deactivating && id === actor.id) throw new BadRequestException('O‘zingizni bloklay olmaysiz');
      if (target.role === Role.ADMIN && (deactivating || demoting)) {
        const activeAdmins = await this.prisma.user.count({ where: { role: Role.ADMIN, isActive: true } });
        if (activeAdmins <= 1) throw new BadRequestException('Oxirgi faol adminni bloklab yoki rolini o‘zgartirib bo‘lmaydi');
      }
    }

    const data: Record<string, unknown> = {
      fullName: dto.fullName,
      role: dto.role,
      branchId: dto.branchId === undefined ? undefined : dto.branchId || null,
      isActive: dto.isActive,
    };
    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 10);
      data.plainPassword = dto.password;
    }
    return this.prisma.user.update({ where: { id }, data, select: userSelect });
  }

  @Post(':id/avatar')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(@Param('id') id: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Rasm yuborilmadi');
    const stored = await this.storage.save(file.buffer, file.originalname, file.mimetype, `avatars/${id}`);
    return this.prisma.user.update({ where: { id }, data: { avatarPath: stored.storagePath }, select: userSelect });
  }

  /** Serves a user's avatar image; token via header or `?token=` (for <img src>). */
  @Get(':id/avatar')
  async getAvatar(@Param('id') id: string, @Res() res: Response, @Query('token') token?: string) {
    const header = (res.req.headers['authorization'] as string | undefined)?.replace(/^Bearer\s+/i, '');
    const raw = header || token;
    if (!raw) throw new UnauthorizedException();
    try { this.jwt.verify(raw); } catch { throw new UnauthorizedException(); }
    const user = await this.prisma.user.findUnique({ where: { id }, select: { avatarPath: true } });
    if (!user?.avatarPath) throw new NotFoundException('Avatar yo‘q');
    res.setHeader('Cache-Control', 'private, max-age=60');
    this.storage.stream(user.avatarPath).pipe(res);
  }
}

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ secret: config.get<string>('JWT_SECRET') ?? 'dev-secret' }),
    }),
  ],
  controllers: [UsersController],
})
export class UsersModule {}
