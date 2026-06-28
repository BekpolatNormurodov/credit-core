import { Body, Controller, Get, Injectable, Module, Put, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsEnum, IsInt, IsNumber, Max, Min, ValidateNested } from 'class-validator';
import { addBusinessDays, AppConfigDto, CaseStatus, DEADLINE_STEPS, StepDeadlineSetting } from '@credit-core/shared';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@credit-core/shared';

class DeadlineItemDto {
  @IsEnum(CaseStatus) step!: CaseStatus;
  @IsInt() @Min(1) @Max(60) businessDays!: number;
  @IsBoolean() enabled!: boolean;
}

class UpdateDeadlinesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DeadlineItemDto)
  items!: DeadlineItemDto[];
}

class ConfigDto {
  @IsInt() @Min(0) @Max(60) maxPauseDays!: number;
  @IsNumber() @Min(0) @Max(5) markupPercent!: number;
  @IsNumber() @Min(0) @Max(5) bankRate!: number;
  @IsNumber() @Min(0) @Max(5) taxRate!: number;
  @IsNumber() @Min(0) @Max(5) nplRate!: number;
}

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** All deadline steps with their configured business days + enabled (defaults: 2, on). */
  async getDeadlines(): Promise<StepDeadlineSetting[]> {
    const rows = await this.prisma.stepSetting.findMany();
    const byStep = new Map(rows.map((r) => [r.step as CaseStatus, r]));
    return DEADLINE_STEPS.map((step) => {
      const r = byStep.get(step);
      return { step, businessDays: r?.businessDays ?? 2, enabled: r?.enabled ?? true };
    });
  }

  async updateDeadlines(items: DeadlineItemDto[]): Promise<StepDeadlineSetting[]> {
    const valid = items.filter((i) => DEADLINE_STEPS.includes(i.step));
    for (const i of valid) {
      await this.prisma.stepSetting.upsert({
        where: { step: i.step },
        create: { step: i.step, businessDays: i.businessDays, enabled: i.enabled },
        update: { businessDays: i.businessDays, enabled: i.enabled },
      });
      if (!i.enabled) {
        // Timer off: drop deadlines for cases currently sitting in this step.
        await this.prisma.creditCase.updateMany({
          where: { status: i.step, stepDeadlineAt: { not: null } },
          data: { stepDeadlineAt: null, overdueNotified: false },
        });
      } else {
        // Timer on: fill missing deadlines for in-flight cases from their step-entry time.
        const pending = await this.prisma.creditCase.findMany({
          where: { status: i.step, stepDeadlineAt: null, stepStartedAt: { not: null } },
          select: { id: true, stepStartedAt: true },
        });
        for (const c of pending) {
          await this.prisma.creditCase.update({
            where: { id: c.id },
            data: { stepDeadlineAt: addBusinessDays(new Date(c.stepStartedAt as Date), i.businessDays), overdueNotified: false },
          });
        }
      }
    }
    return this.getDeadlines();
  }

  /** Singleton global config (pause limit + loan rates), seeded with defaults. */
  async getConfig(): Promise<AppConfigDto> {
    const c = await this.prisma.appConfig.upsert({ where: { id: 'default' }, create: { id: 'default' }, update: {} });
    return { maxPauseDays: c.maxPauseDays, markupPercent: c.markupPercent, bankRate: c.bankRate, taxRate: c.taxRate, nplRate: c.nplRate };
  }

  async updateConfig(dto: ConfigDto): Promise<AppConfigDto> {
    await this.prisma.appConfig.upsert({ where: { id: 'default' }, create: { id: 'default', ...dto }, update: { ...dto } });
    return this.getConfig();
  }
}

@UseGuards(JwtAuthGuard)
@Controller('settings')
class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get('deadlines')
  getDeadlines() {
    return this.service.getDeadlines();
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Put('deadlines')
  updateDeadlines(@Body() dto: UpdateDeadlinesDto) {
    return this.service.updateDeadlines(dto.items);
  }

  @Get('config')
  getConfig() {
    return this.service.getConfig();
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Put('config')
  updateConfig(@Body() dto: ConfigDto) {
    return this.service.updateConfig(dto);
  }
}

@Module({
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
