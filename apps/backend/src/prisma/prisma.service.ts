import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { shouldLogQuery, queryLogEnabled, sqlVerb } from './query-log.util';

@Injectable()
export class PrismaService extends PrismaClient<{ log: [{ emit: 'event'; level: 'query' }] }> implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({ log: [{ emit: 'event', level: 'query' }] });
  }

  async onModuleInit() {
    if (queryLogEnabled()) {
      // Layer C — log every query to a separate store (recursion-guarded, fire-and-forget).
      this.$on('query', (e: Prisma.QueryEvent) => {
        if (shouldLogQuery(e.query)) {
          this.queryLog
            .create({ data: { model: null, action: sqlVerb(e.query), durationMs: Math.round(e.duration) } })
            .catch(() => undefined);
        }
      });
    }
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
