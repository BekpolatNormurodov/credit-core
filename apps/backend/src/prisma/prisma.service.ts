import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  // ── Per-query DB logging is COMMENTED OUT — ERROR LOOP ──────────────────────────
  // It wrote a QueryLog row for every query. But a Prisma create emits
  //   BEGIN -> INSERT -> SELECT -> COMMIT
  // and the BEGIN/COMMIT were logged as new QueryLog inserts, whose own BEGIN/COMMIT were
  // logged again -> exponential recursion that pegged the backend CPU (>500%) and flooded
  // MySQL with writes. A logger must never persist into the DB it is logging. Left disabled
  // on purpose (see shouldLogQuery/sqlVerb in ./query-log.util if a safe logger is ever built).
  //
  //   constructor() {
  //     super({ log: [{ emit: 'event', level: 'query' }] });
  //   }
  //   async onModuleInit() {
  //     if (queryLogEnabled()) {
  //       this.$on('query', (e: Prisma.QueryEvent) => {
  //         if (shouldLogQuery(e.query)) {
  //           this.queryLog
  //             .create({ data: { model: null, action: sqlVerb(e.query), durationMs: Math.round(e.duration) } })
  //             .catch(() => undefined);
  //         }
  //       });
  //     }
  //     await this.$connect();
  //   }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
