import {
  BadRequestException, Controller, Logger, Module, Post, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import path from 'path';
import type { PassportScanResult } from '@credit-core/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PassportService } from './passport.service';
import { archiveScan, scanSummary } from './scan-archive';

// Where uploaded scans are kept. Under uploads/ (gitignored). In prod, mount a volume here for
// persistence across restarts, or point PASSPORT_SCAN_DIR elsewhere.
const SCAN_DIR = process.env.PASSPORT_SCAN_DIR || path.join(process.cwd(), 'uploads', 'passport-scans');

@UseGuards(JwtAuthGuard)
@Controller('passport')
class PassportController {
  private readonly logger = new Logger('PassportScan');
  constructor(private readonly svc: PassportService) {}

  /** Scan an uploaded passport image → MRZ fields + check-digit confidence. Every upload is
   *  archived and its outcome logged (good or bad) for audit/debugging. */
  @Post('scan')
  @UseInterceptors(FileInterceptor('file'))
  async scan(@UploadedFile() file?: Express.Multer.File): Promise<PassportScanResult> {
    if (!file) throw new BadRequestException('Rasm yuborilmadi');
    if (!(file.mimetype || '').startsWith('image/')) throw new BadRequestException('Faqat rasm fayli qabul qilinadi');
    const result = await this.svc.scan(file.buffer);
    // Archiving/logging must never fail the scan response.
    try {
      const saved = await archiveScan(SCAN_DIR, file.buffer, file.mimetype, result, new Date());
      this.logger.log(scanSummary(result, path.basename(saved)));
    } catch (e) {
      this.logger.warn(`failed to archive scan: ${(e as Error).message}`);
    }
    return result;
  }
}

@Module({ controllers: [PassportController], providers: [PassportService] })
export class PassportModule {}
