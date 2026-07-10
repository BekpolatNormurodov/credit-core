import {
  BadRequestException, Controller, Logger, Module, Post, UploadedFile, UploadedFiles, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FileFieldsInterceptor } from '@nestjs/platform-express';
import path from 'path';
import type { PassportScanResult, TexScanResult } from '@credit-core/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PassportService } from './passport.service';
import { archiveScan, scanSummary } from './scan-archive';

// Where uploaded scans are kept. In prod, UPLOAD_DIR (/data/uploads) is a persistent volume, so
// default under it; otherwise a local uploads/ dir (gitignored). Override with PASSPORT_SCAN_DIR.
const SCAN_DIR =
  process.env.PASSPORT_SCAN_DIR ||
  path.join(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'), 'passport-scans');

/** Accept image uploads and PDF scans (rendered to an image server-side). */
const isScannable = (m?: string) => (m || '').startsWith('image/') || (m || '').includes('pdf');

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
    if (!isScannable(file.mimetype)) throw new BadRequestException('Faqat rasm yoki PDF fayli qabul qilinadi');
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

  /** Scan an ID card: front + back images → merged fields (verified numbers from the back MRZ,
   *  name + a few fields from the front). Both images are archived and the outcome logged. */
  @Post('scan-id')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'front', maxCount: 1 }, { name: 'back', maxCount: 1 }]))
  async scanId(@UploadedFiles() files: { front?: Express.Multer.File[]; back?: Express.Multer.File[] }): Promise<PassportScanResult> {
    const front = files?.front?.[0];
    const back = files?.back?.[0];
    if (!front || !back) throw new BadRequestException('Old va orqa tomon rasmlari kerak');
    if (!isScannable(front.mimetype) || !isScannable(back.mimetype)) {
      throw new BadRequestException('Faqat rasm yoki PDF fayllari qabul qilinadi');
    }
    const result = await this.svc.scanIdCard(front.buffer, back.buffer);
    const now = new Date();
    try {
      await archiveScan(SCAN_DIR, front.buffer, front.mimetype, result, now, 'front');
      const saved = await archiveScan(SCAN_DIR, back.buffer, back.mimetype, result, now, 'back');
      this.logger.log(scanSummary(result, path.basename(saved)));
    } catch (e) {
      this.logger.warn(`failed to archive id scan: ${(e as Error).message}`);
    }
    return result;
  }

  /** Scan a vehicle-registration certificate (tex passport): front + back → AUTO collateral fields. */
  @Post('scan-tex')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'front', maxCount: 1 }, { name: 'back', maxCount: 1 }]))
  async scanTex(@UploadedFiles() files: { front?: Express.Multer.File[]; back?: Express.Multer.File[] }): Promise<TexScanResult> {
    const front = files?.front?.[0];
    const back = files?.back?.[0];
    if (!front || !back) throw new BadRequestException('Old va orqa tomon rasmlari kerak');
    if (!isScannable(front.mimetype) || !isScannable(back.mimetype)) {
      throw new BadRequestException('Faqat rasm yoki PDF fayllari qabul qilinadi');
    }
    const result = await this.svc.scanTex(front.buffer, back.buffer);
    this.logger.log(`tex scan: conf=${result.confidence} plate=${result.fields.stateNumber || '—'} vin=${result.fields.bodyNo || '—'}`);
    return result;
  }
}

@Module({ controllers: [PassportController], providers: [PassportService] })
export class PassportModule {}
