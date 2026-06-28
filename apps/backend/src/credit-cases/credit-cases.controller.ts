import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Role } from '@credit-core/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, RequestUser } from '../auth/current-user.decorator';
import { CreditCasesService } from './credit-cases.service';
import { SetKatmPriceDto, TransitionDto, UpsertCaseDto } from './dto';

@UseGuards(JwtAuthGuard)
@Controller('cases')
export class CreditCasesController {
  constructor(private readonly service: CreditCasesService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Query('inbox') inbox?: string) {
    return this.service.list(user, inbox === '1' || inbox === 'true');
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.service.getOne(id);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.OPERATOR)
  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: UpsertCaseDto) {
    return this.service.createCase(user, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.OPERATOR)
  @Put(':id')
  update(@Param('id') id: string, @CurrentUser() user: RequestUser, @Body() dto: UpsertCaseDto) {
    return this.service.updateCase(id, user, dto);
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
  @Roles(Role.ADMIN)
  @Put(':id/katm-price')
  setKatmPrice(@Param('id') id: string, @Body() dto: SetKatmPriceDto) {
    return this.service.setKatmPrice(id, dto.katmPrice);
  }
}
