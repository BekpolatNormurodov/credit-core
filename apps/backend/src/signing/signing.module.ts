import { Module } from '@nestjs/common';
import { PdfService } from '../output/pdf.service';
import { SigningController } from './signing.controller';
import { SigningService } from './signing.service';
import { SignedDocsStore } from './signed-docs.store';
import { VerifyController } from './verify.controller';

// PrismaModule and AuditModule are both @Global — their providers are already available here.
@Module({
  controllers: [SigningController, VerifyController],
  providers: [SigningService, SignedDocsStore, PdfService],
  exports: [SignedDocsStore],
})
export class SigningModule {}
