import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { parse } = require('mrz');
import type { PassportScanResult } from '@credit-core/shared';
import { extractMrzLines, mapMrzToBorrower, scoreConfidence, MrzDetail } from './mrz.util';

/** OCR a preprocessed image buffer → raw text. Injectable so the pipeline is unit-testable. */
export type OcrFn = (image: Buffer) => Promise<string>;

const ORIENTATIONS = [0, 90, 180, 270];
const MRZ_WHITELIST = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<';

function emptyResult(): PassportScanResult {
  return {
    confidence: 0,
    fields: { fullName: '', passportSeries: '', passportNumber: '', birthDate: null, passportExpiry: null, gender: '', pinfl: '' },
    perField: [],
    format: '',
    rawMrz: [],
    warnings: ['mrz_not_found'],
  };
}

@Injectable()
export class PassportService {
  /** Scan a passport image buffer. Pass `ocr` in tests to stub OCR; production uses tesseract.js. */
  async scan(file: Buffer, ocr?: OcrFn): Promise<PassportScanResult> {
    if (ocr) return this.run(file, ocr);
    const worker = await createWorker('eng', 1, {
      langPath: process.env.TESSDATA_PATH || undefined,
      cacheMethod: 'none',
      gzip: false,
    });
    try {
      await worker.setParameters({ tessedit_char_whitelist: MRZ_WHITELIST });
      return await this.run(file, async (img) => (await worker.recognize(img)).data.text);
    } finally {
      await worker.terminate();
    }
  }

  /** Try each orientation, keep the highest-scoring MRZ read, short-circuit on a fully-valid parse. */
  private async run(file: Buffer, ocr: OcrFn): Promise<PassportScanResult> {
    let best: { parsed: any; conf: number; lines: string[] } | null = null;
    for (const angle of ORIENTATIONS) {
      const img = await this.preprocess(file, angle);
      const text = await ocr(img);
      const lines = extractMrzLines(text);
      if (lines.length < 2) continue;
      let parsed: any;
      try {
        parsed = parse(lines);
      } catch {
        continue;
      }
      const conf = scoreConfidence((parsed.details ?? []) as MrzDetail[]);
      if (!best || conf > best.conf) best = { parsed, conf, lines };
      if (parsed.valid) break;
    }
    if (!best) return emptyResult();

    const fields = mapMrzToBorrower(best.parsed.fields ?? {});
    const perField = ((best.parsed.details ?? []) as MrzDetail[])
      .filter((d) => d.field.endsWith('CheckDigit'))
      .map((d) => ({ key: d.field, value: String(d.value ?? ''), valid: !!d.valid }));
    const warnings: string[] = [];
    if (best.conf < 60) warnings.push('low_confidence');
    return { confidence: best.conf, fields, perField, format: best.parsed.format ?? '', rawMrz: best.lines, warnings };
  }

  /** Rotate + grayscale + normalize + downscale for a fast, legible MRZ read. */
  private async preprocess(file: Buffer, angle: number): Promise<Buffer> {
    return sharp(file).rotate(angle).grayscale().normalize().resize({ width: 1000, withoutEnlargement: true }).toBuffer();
  }
}
