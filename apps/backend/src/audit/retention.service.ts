import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

const DAYS = Number(process.env.QUERY_LOG_RETENTION_DAYS ?? 14);

/** Prunes the high-volume operational logs (QueryLog/RequestLog) past the retention window. */
@Injectable()
export class RetentionService {
  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async prune() {
    const cutoff = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);
    await this.prisma.queryLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
    await this.prisma.requestLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
  }
}
