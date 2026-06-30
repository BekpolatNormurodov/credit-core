import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { LoggingInterceptor } from './logging.interceptor';
import { RetentionService } from './retention.service';

@Global()
@Module({
  controllers: [AuditController],
  providers: [
    AuditService,
    RetentionService,
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
  exports: [AuditService],
})
export class AuditModule {}
