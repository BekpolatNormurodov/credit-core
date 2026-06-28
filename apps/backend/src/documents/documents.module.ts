import { Global, Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { StorageService } from './storage.service';

@Global()
@Module({
  controllers: [DocumentsController],
  providers: [StorageService],
  exports: [StorageService],
})
export class DocumentsModule {}
