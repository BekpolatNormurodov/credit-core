import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditService } from './audit.service';
import { LoggingInterceptor } from './logging.interceptor';
import { RetentionService } from './retention.service';

@Global()
@Module({
  providers: [
    AuditService,
    RetentionService,
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
  exports: [AuditService],
})
export class AuditModule {}
