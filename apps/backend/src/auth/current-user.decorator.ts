import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from '@credit-core/shared';

export interface RequestUser {
  id: string;
  login: string;
  role: Role;
  branchId: string | null;
}

export const CurrentUser = createParamDecorator(
  (data: keyof RequestUser | undefined, ctx: ExecutionContext): RequestUser | unknown => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as RequestUser;
    return data ? user?.[data] : user;
  },
);
