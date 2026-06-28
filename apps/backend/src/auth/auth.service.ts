import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { LoginResponse } from '@credit-core/shared';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from './jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(login: string, password: string): Promise<LoginResponse> {
    const user = await this.prisma.user.findUnique({
      where: { login },
      include: { branch: true },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Login yoki parol noto‘g‘ri');
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Login yoki parol noto‘g‘ri');
    }

    const payload: JwtPayload = {
      sub: user.id,
      login: user.login,
      role: user.role,
      branchId: user.branchId,
    };

    return {
      accessToken: await this.jwt.signAsync(payload),
      user: {
        id: user.id,
        fullName: user.fullName,
        login: user.login,
        role: user.role,
        branchId: user.branchId,
        branch: user.branch
          ? {
              id: user.branch.id,
              name: user.branch.name,
              symbol: user.branch.symbol,
              region: user.branch.region,
            }
          : null,
      },
    };
  }
}
