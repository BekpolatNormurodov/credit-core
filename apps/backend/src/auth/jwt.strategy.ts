import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Role } from '@credit-core/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from './current-user.decorator';

export interface JwtPayload {
  sub: string;
  login: string;
  role: Role;
  branchId: string | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') ?? 'dev-secret',
    });
  }

  async validate(payload: JwtPayload): Promise<RequestUser> {
    // Re-check the account on every request so blocking takes effect immediately.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { isActive: true, role: true, branchId: true },
    });
    if (!user || !user.isActive) throw new UnauthorizedException('Hisob faol emas');
    return {
      id: payload.sub,
      login: payload.login,
      role: user.role,
      branchId: user.branchId,
    };
  }
}
