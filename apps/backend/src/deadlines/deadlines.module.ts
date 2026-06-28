import { Injectable, Logger, Module } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CaseStatus, DEADLINE_STEPS, Role, STATUS_LABEL } from '@credit-core/shared';
import { PrismaService } from '../prisma/prisma.service';

/** The role whose inbox a step belongs to (the "mas'ul xodim"). */
const STEP_ASSIGNEE: Record<string, Role> = {
  [CaseStatus.MODERATION]: Role.MODERATOR,
  [CaseStatus.DIRECTOR_REVIEW]: Role.DIRECTOR,
  [CaseStatus.ADMIN_FINALIZE]: Role.ADMIN,
};

/**
 * Watches step SLA deadlines. When a case in an active step passes its
 * deadline, it notifies the step's assignee + the director ONCE (overdueNotified
 * guards against repeats). No automatic status change — purely a "belgi + bildirishnoma".
 */
@Injectable()
export class DeadlineService {
  private readonly logger = new Logger(DeadlineService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async checkOverdue(): Promise<void> {
    const now = new Date();

    // Auto-resume cases paused longer than the admin-configured max.
    const cfg = await this.prisma.appConfig.findUnique({ where: { id: 'default' } });
    const maxMs = (cfg?.maxPauseDays ?? 5) * 24 * 60 * 60 * 1000;
    const expired = await this.prisma.creditCase.findMany({
      where: { pausedAt: { not: null, lt: new Date(now.getTime() - maxMs) } },
      select: { id: true, stepDeadlineAt: true },
    });
    for (const c of expired) {
      await this.prisma.creditCase.update({
        where: { id: c.id },
        data: {
          pausedAt: null,
          stepDeadlineAt: c.stepDeadlineAt ? new Date(c.stepDeadlineAt.getTime() + maxMs) : null,
          overdueNotified: false,
        },
      });
    }

    const overdue = await this.prisma.creditCase.findMany({
      where: {
        status: { in: DEADLINE_STEPS },
        overdueNotified: false,
        pausedAt: null, // paused cases don't go overdue
        stepDeadlineAt: { not: null, lt: now },
      },
      select: { id: true, number: true, status: true },
    });
    if (overdue.length === 0) return;

    const systemId = await this.ensureSystemUser();

    for (const c of overdue) {
      const assignee = STEP_ASSIGNEE[c.status];
      const roles = Array.from(new Set([assignee, Role.DIRECTOR].filter(Boolean) as Role[]));
      const text = `"${c.number}" arizasi "${STATUS_LABEL[c.status as CaseStatus]}" bosqichida belgilangan muddatdan o'tib ketdi.`;
      await this.prisma.$transaction([
        ...roles.map((role) =>
          this.prisma.message.create({
            data: { caseId: c.id, senderId: systemId, toRole: role, text, readBy: systemId },
          }),
        ),
        this.prisma.creditCase.update({ where: { id: c.id }, data: { overdueNotified: true } }),
      ]);
    }
    this.logger.log(`Muddati o'tgan ${overdue.length} ta ariza bo'yicha bildirishnoma yuborildi`);
  }

  /** Find-or-create the disabled "Tizim" account used as the sender of system notifications. */
  private async ensureSystemUser(): Promise<string> {
    const user = await this.prisma.user.upsert({
      where: { login: 'system' },
      create: { login: 'system', fullName: 'Tizim', role: Role.ADMIN, passwordHash: 'disabled', isActive: false },
      update: {},
      select: { id: true },
    });
    return user.id;
  }
}

@Module({ providers: [DeadlineService] })
export class DeadlinesModule {}
