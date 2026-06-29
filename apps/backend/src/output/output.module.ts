import { Module } from '@nestjs/common';
import { CreditCasesModule } from '../credit-cases/credit-cases.module';
import { OutputController } from './output.controller';
import { CaseDocumentsController } from './case-documents.controller';
import { PdfService } from './pdf.service';

@Module({
  imports: [CreditCasesModule],
  controllers: [OutputController, CaseDocumentsController],
  providers: [PdfService],
})
export class OutputModule {}
