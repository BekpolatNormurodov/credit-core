import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { parse } = require('mrz');
import type { PassportScanResult } from '@credit-core/shared';
import { extractMrzLines, normalizeMrzLines, mapMrzToBorrower, scoreConfidence, expiryWarnings, MrzDetail } from './mrz.util';

/** OCR a preprocessed image buffer → raw text. Injectable so the pipeline is unit-testable. */
export type OcrFn = (image: Buffer) => Promise<string>;

const ORIENTATIONS = [0, 90, 180, 270];
const MRZ_WHITELIST = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<';

/** One orientation's parse result plus its check-digit confidence. */
interface Candidate {
  parsed: any;
  conf: number;
  lines: string[];
}

function emptyResult(): PassportScanResult {
  return {
    confidence: 0,
    fields: { fullName: '', passportSeries: '', passportNumber: '', birthDate: null, passportExpiry: null, gender: '', nationality: '', pinfl: '' },
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
    // Prod image bundles raw .traineddata at TESSDATA_PATH → gzip:false, no cache needed.
    // Local dev (no TESSDATA_PATH) falls back to tesseract's CDN, which serves gzipped data
    // and must be cached — using gzip:false there requests a non-existent URL and 404s.
    const langPath = process.env.TESSDATA_PATH;
    const worker = await createWorker('eng', 1, {
      langPath: langPath || undefined,
      cacheMethod: langPath ? 'none' : 'write',
      gzip: langPath ? false : true,
    });
    try {
      await worker.setParameters({ tessedit_char_whitelist: MRZ_WHITELIST });
      return await this.run(file, async (img) => (await worker.recognize(img)).data.text);
    } finally {
      await worker.terminate();
    }
  }

  /** Two passes: base preprocessing, then binarized, each across all orientations. Best MRZ wins. */
  private async run(file: Buffer, ocr: OcrFn): Promise<PassportScanResult> {
    // Scan every orientation, carrying the best MRZ found so far; stop early on a fully-valid parse.
    const attempt = async (binarize: boolean, carried: Candidate | null): Promise<{ best: Candidate | null; done: boolean }> => {
      let best = carried;
      for (const angle of ORIENTATIONS) {
        const img = await this.preprocess(file, angle, binarize);
        const text = await ocr(img);
        const lines = extractMrzLines(text);
        if (lines.length < 2) continue;
        // OCR rarely nails the exact 44/36/30-char width; the strict parser throws otherwise.
        const norm = normalizeMrzLines(lines);
        let parsed: any;
        try {
          parsed = parse(norm);
        } catch {
          continue;
        }
        const conf = scoreConfidence((parsed.details ?? []) as MrzDetail[]);
        if (!best || conf > best.conf) best = { parsed, conf, lines: norm };
        if (parsed.valid) return { best, done: true };
      }
      return { best, done: false };
    };

    // Base pass; if nothing confident, retry binarized (recovers low-contrast / blurry scans).
    let r = await attempt(false, null);
    if (!r.done && (!r.best || r.best.conf < 60)) r = await attempt(true, r.best);
    const best = r.best;
    if (!best) return emptyResult();

    const fields = mapMrzToBorrower(best.parsed.fields ?? {});
    const perField = ((best.parsed.details ?? []) as MrzDetail[])
      .filter((d) => d.field.endsWith('CheckDigit'))
      .map((d) => ({ key: d.field, value: String(d.value ?? ''), valid: !!d.valid }));
    const warnings: string[] = [];
    if (best.conf < 60) warnings.push('low_confidence');
    warnings.push(...expiryWarnings(fields.passportExpiry));
    return { confidence: best.conf, fields, perField, format: best.parsed.format ?? '', rawMrz: best.lines, warnings };
  }

  /** Rotate + grayscale + normalize + sharpen (+ optional threshold) + upscale for a legible MRZ read. */
  private async preprocess(file: Buffer, angle: number, binarize: boolean): Promise<Buffer> {
    let img = sharp(file, { failOn: 'none' }).rotate(angle).grayscale().normalize().sharpen();
    if (binarize) img = img.threshold(140);
    return img.resize({ width: 1500, withoutEnlargement: true }).toBuffer();
  }
}
