import { Controller, Get, HttpCode, Module, Query, UseGuards } from '@nestjs/common';
import { KatmReportType } from '@credit-core/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

/**
 * KATM (credit bureau) integration — PLACEHOLDER.
 * No real integration yet ("tez kunda"). Endpoints return a not-ready marker
 * so the admin UI can render the section with disabled actions.
 */
@UseGuards(JwtAuthGuard)
@Controller('katm')
class KatmController {
  @Get('status')
  status() {
    return {
      available: false,
      message: 'KATM integratsiyasi tez kunda ishga tushadi',
      reports: Object.values(KatmReportType),
    };
  }

  @Get('check')
  @HttpCode(200)
  check(@Query('pinfl') pinfl?: string, @Query('caseId') caseId?: string) {
    return {
      available: false,
      requested: { pinfl: pinfl ?? null, caseId: caseId ?? null },
      message: 'Tez kunda: KATM hisobotlari shu yerda ko‘rinadi',
    };
  }
}

@Module({ controllers: [KatmController] })
export class KatmModule {}
