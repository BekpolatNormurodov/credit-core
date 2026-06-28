import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Role } from '@credit-core/shared';
import { RequestUser } from './current-user.decorator';

export interface JwtPayload {
  sub: string;
  login: string;
  role: Role;
  branchId: string | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') ?? 'dev-secret',
    });
  }

  async validate(payload: JwtPayload): Promise<RequestUser> {
    return {
      id: payload.sub,
      login: payload.login,
      role: payload.role,
      branchId: payload.branchId,
    };
  }
}
