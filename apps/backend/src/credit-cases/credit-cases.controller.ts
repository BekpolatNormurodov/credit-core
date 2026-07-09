import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Role } from '@credit-core/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, RequestUser } from '../auth/current-user.decorator';
import { CreditCasesService } from './credit-cases.service';
import { exportCasesListToExcel } from '../output/excel-export.util';
import { CaseSectionDto, DeleteCaseDto, ReMflCreateDto, ReMflSearchDto, SetKatmPriceDto, SetRateDto, SetSplitDto, TransitionDto, UpsertCaseDto } from './dto';

@UseGuards(JwtAuthGuard)
@Controller('cases')
export class CreditCasesController {
  constructor(private readonly service: CreditCasesService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Query('inbox') inbox?: string) {
    return this.service.list(user, inbox === '1' || inbox === 'true');
  }

  // Must precede the ':id' route so '/cases/search' isn't captured as an id.
  @Get('search')
  search(@CurrentUser() user: RequestUser, @Query('q') q?: string) {
    return this.service.search(user, q ?? '');
  }

  // Qayta MFL: search existing clients (must precede ':id').
  @UseGuards(RolesGuard)
  @Roles(Role.OPERATOR, Role.ADMIN)
  @Get('re-mfl/search')
  searchReMfl(@Query() dto: ReMflSearchDto) {
    return this.service.searchReMfl(dto.term);
  }

  // Arxiv: archived (soft-deleted) drafts, searchable (must precede ':id').
  @UseGuards(RolesGuard)
  @Roles(Role.OPERATOR, Role.ADMIN)
  @Get('archived')
  archived(@CurrentUser() user: RequestUser, @Query('q') q?: string) {
    return this.service.listArchived(user, q ?? '');
  }

  // Qayta MFL: create a new draft linked to the chosen source contract.
  @UseGuards(RolesGuard)
  @Roles(Role.OPERATOR, Role.ADMIN)
  @Post('re-mfl')
  createReMfl(@CurrentUser() user: RequestUser, @Body() dto: ReMflCreateDto) {
    return this.service.createReMfl(user, dto.sourceCaseId);
  }

  /** Export all visible cases (role-scoped) to a single .xlsx. */
  @Get('export/excel')
  async exportExcel(@CurrentUser() user: RequestUser, @Res() res: Response) {
    const rows = await this.service.list(user, false);
    const buffer = await exportCasesListToExcel(rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Arizalar.xlsx"');
    res.send(buffer);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.service.getOne(id);
  }

  @Get(':id/participants')
  participants(@Param('id') id: string) {
    return this.service.participants(id);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.OPERATOR, Role.ADMIN)
  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: UpsertCaseDto) {
    return this.service.createCase(user, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.OPERATOR, Role.ADMIN)
  @Put(':id')
  update(@Param('id') id: string, @CurrentUser() user: RequestUser, @Body() dto: UpsertCaseDto) {
    return this.service.updateCase(id, user, dto);
  }

  // Operator archives their own draft; admin any draft. Guarded again in the service.
  // A reason is required and recorded in the audit log.
  @UseGuards(RolesGuard)
  @Roles(Role.OPERATOR, Role.ADMIN)
  @Delete(':id')
  delete(@Param('id') id: string, @CurrentUser() user: RequestUser, @Body() dto: DeleteCaseDto) {
    return this.service.deleteCase(id, user, dto.reason);
  }

  // Restore (re-activate) an archived draft. Operator restores their own; admin any.
  @UseGuards(RolesGuard)
  @Roles(Role.OPERATOR, Role.ADMIN)
  @Post(':id/restore')
  restore(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.restoreCase(id, user);
  }

  @Post(':id/transition')
  transition(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: TransitionDto,
  ) {
    return this.service.transition(id, user, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.MODERATOR, Role.DIRECTOR, Role.ADMIN)
  @Post(':id/pause')
  pause(@Param('id') id: string, @CurrentUser() user: RequestUser, @Body() body?: { days?: number }) {
    return this.service.pause(id, user, body?.days);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.MODERATOR, Role.DIRECTOR, Role.ADMIN)
  @Post(':id/resume')
  resume(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.resume(id, user);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Put(':id/katm-price')
  setKatmPrice(@Param('id') id: string, @CurrentUser() user: RequestUser, @Body() dto: SetKatmPriceDto) {
    return this.service.setKatmPrice(id, user, dto.katmPrice);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.OPERATOR, Role.ADMIN)
  @Patch(':id/section')
  saveSection(@Param('id') id: string, @CurrentUser() user: RequestUser, @Body() dto: CaseSectionDto) {
    return this.service.saveSection(id, user, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.MODERATOR, Role.ADMIN)
  @Patch(':id/rate')
  setRate(@Param('id') id: string, @CurrentUser() user: RequestUser, @Body() dto: SetRateDto) {
    return this.service.setRate(id, user, dto.interestRate, dto.reason);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.DIRECTOR, Role.ADMIN)
  @Patch(':id/split')
  setSplit(@Param('id') id: string, @CurrentUser() user: RequestUser, @Body() dto: SetSplitDto) {
    return this.service.setSplit(id, user, dto.amountAuto, dto.amountPolis, dto.reason);
  }
}
