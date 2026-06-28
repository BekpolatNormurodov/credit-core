import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { DocumentsController } from './documents.controller';
import { StorageService } from './storage.service';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') ?? 'dev-secret',
      }),
    }),
  ],
  controllers: [DocumentsController],
  providers: [StorageService],
  exports: [StorageService],
})
export class DocumentsModule {}
