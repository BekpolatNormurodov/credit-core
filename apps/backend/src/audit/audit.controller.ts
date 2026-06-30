import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '@credit-core/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuditService } from './audit.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(
    @Query('caseId') caseId?: string,
    @Query('actorId') actorId?: string,
    @Query('action') action?: string,
  ) {
    return this.audit.list({ caseId, actorId, action });
  }
}
