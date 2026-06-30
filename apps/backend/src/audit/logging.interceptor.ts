import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';

/** Pure builder for a RequestLog row (kept separate so it is unit-testable). */
export function requestLogEntry(method: string, path: string, userId: string | null, statusCode: number, durationMs: number, ip: string | null) {
  return { method, path, userId, statusCode, durationMs, ip };
}

/** Layer B — records every HTTP request (fire-and-forget). */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const start = Date.now();
    const req = ctx.switchToHttp().getRequest();
    return next.handle().pipe(
      tap(() => {
        const res = ctx.switchToHttp().getResponse();
        const entry = requestLogEntry(req.method, req.originalUrl ?? req.url, req.user?.id ?? null, res.statusCode, Date.now() - start, req.ip ?? null);
        this.prisma.requestLog.create({ data: entry }).catch(() => undefined);
      }),
    );
  }
}
