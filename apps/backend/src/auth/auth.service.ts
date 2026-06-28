import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User, Branch } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuthUser, LoginResponse } from '@credit-core/shared';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from './jwt.strategy';

function toAuthUser(user: User & { branch: Branch | null }): AuthUser {
  return {
    id: user.id,
    fullName: user.fullName,
    login: user.login,
    role: user.role,
    branchId: user.branchId,
    phone: user.phone,
    hasAvatar: !!user.avatarPath,
    branch: user.branch
      ? { id: user.branch.id, name: user.branch.name, symbol: user.branch.symbol, region: user.branch.region }
      : null,
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(login: string, password: string): Promise<LoginResponse> {
    const user = await this.prisma.user.findUnique({ where: { login }, include: { branch: true } });
    if (!user || !user.isActive) throw new UnauthorizedException('Login yoki parol noto‘g‘ri');

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Login yoki parol noto‘g‘ri');

    const payload: JwtPayload = { sub: user.id, login: user.login, role: user.role, branchId: user.branchId };
    return { accessToken: await this.jwt.signAsync(payload), user: toAuthUser(user) };
  }

  /** Full current-user profile (called by GET /auth/me). */
  async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { branch: true } });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    return toAuthUser(user);
  }

  /** Self-service profile update (name / phone). */
  async updateProfile(userId: string, dto: { fullName?: string; phone?: string | null }): Promise<AuthUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { fullName: dto.fullName, phone: dto.phone === undefined ? undefined : dto.phone || null },
      include: { branch: true },
    });
    return toAuthUser(user);
  }

  async setAvatar(userId: string, storagePath: string): Promise<AuthUser> {
    const user = await this.prisma.user.update({ where: { id: userId }, data: { avatarPath: storagePath }, include: { branch: true } });
    return toAuthUser(user);
  }
}
