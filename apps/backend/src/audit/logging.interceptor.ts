import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';

/** Pure builder for a RequestLog row (kept separate so it is unit-testable). */
export function requestLogEntry(method: string, path: string, userId: string | null, statusCode: number, durationMs: number, ip: string | null) {
  return { method, path, userId, statusCode, durationMs, ip };
}

/** Layer B — records every HTTP request (success AND error) with its final status, fire-and-forget. */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const start = Date.now();
    const req = ctx.switchToHttp().getRequest();
    const res = ctx.switchToHttp().getResponse();
    // 'finish' fires after the response (incl. the exception filter's status) is fully sent,
    // so every request is logged with its true final statusCode — failures included.
    res.once('finish', () => {
      const entry = requestLogEntry(req.method, req.originalUrl ?? req.url, req.user?.id ?? null, res.statusCode, Date.now() - start, req.ip ?? null);
      this.prisma.requestLog.create({ data: entry }).catch(() => undefined);
    });
    return next.handle();
  }
}
