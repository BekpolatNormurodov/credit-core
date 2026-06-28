import { Module } from '@nestjs/common';
import { CreditCasesController } from './credit-cases.controller';
import { CreditCasesService } from './credit-cases.service';
import { WorkflowService } from './workflow.service';

@Module({
  controllers: [CreditCasesController],
  providers: [CreditCasesService, WorkflowService],
  exports: [CreditCasesService],
})
export class CreditCasesModule {}
