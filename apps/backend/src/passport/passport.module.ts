import {
  BadRequestException, Controller, Module, Post, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { PassportScanResult } from '@credit-core/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PassportService } from './passport.service';

@UseGuards(JwtAuthGuard)
@Controller('passport')
class PassportController {
  constructor(private readonly svc: PassportService) {}

  /** Scan an uploaded passport image → MRZ fields + check-digit confidence. Persists nothing. */
  @Post('scan')
  @UseInterceptors(FileInterceptor('file'))
  async scan(@UploadedFile() file?: Express.Multer.File): Promise<PassportScanResult> {
    if (!file) throw new BadRequestException('Rasm yuborilmadi');
    if (!(file.mimetype || '').startsWith('image/')) throw new BadRequestException('Faqat rasm fayli qabul qilinadi');
    return this.svc.scan(file.buffer);
  }
}

@Module({ controllers: [PassportController], providers: [PassportService] })
export class PassportModule {}
