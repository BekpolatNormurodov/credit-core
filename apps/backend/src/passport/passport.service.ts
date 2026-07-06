import { Injectable } from '@nestjs/common';
import path from 'path';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';

// Each scan preprocesses 8 one-shot images (4 orientations × 2 passes) that are never reused, so
// libvips' operation cache only piles up memory with no hit benefit — disable it.
sharp.cache(false);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { parse } = require('mrz');
import type { PassportScanResult } from '@credit-core/shared';
import { extractMrzLines, normalizeMrzLines, mapMrzToBorrower, scoreConfidence, expiryWarnings, MrzDetail } from './mrz.util';

/** OCR a preprocessed image buffer → raw text. Injectable so the pipeline is unit-testable. */
export type OcrFn = (image: Buffer) => Promise<string>;

const ORIENTATIONS = [0, 90, 180, 270];
const MRZ_WHITELIST = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<';
// Dedicated OCR-B / MRZ model (BSD-3, DoubangoTelecom/tesseractMRZ). The general 'eng' model
// misreads the MRZ font — '<' as K/C/L, A→4, Z→2 — so the header text wins; 'mrz' reads it cleanly.
const OCR_LANG = 'mrz';
// The 'mrz' model is not on the tesseract CDN, so a local traineddata dir is mandatory. Prod sets
// TESSDATA_PATH; otherwise resolve the bundled dir next to the backend root (works in dist + tests).
const TESSDATA_DIR = process.env.TESSDATA_PATH || path.join(__dirname, '..', '..', 'tessdata');

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
    // The MRZ model ships as a raw (non-gzipped) .traineddata under TESSDATA_DIR — read locally,
    // no CDN fetch and no cache needed. Run `npm run setup:ocr` once in dev to fetch it.
    const worker = await createWorker(OCR_LANG, 1, { langPath: TESSDATA_DIR, cacheMethod: 'none', gzip: false });
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
        // Prefer a fully-valid parse over a higher-conf-but-invalid one. MRZ check digits do NOT
        // cover the name field, so a parse with a corrupted name (stray leading char shifting line 1)
        // can still score 100%; only `valid` reflects a self-consistent, correctly-framed read.
        const better = !best || (parsed.valid && !best.parsed.valid) || (parsed.valid === best.parsed.valid && conf > best.conf);
        if (better) best = { parsed, conf, lines: norm };
        if (parsed.valid) return { best, done: true };
      }
      return { best, done: false };
    };

    // Base pass; if no fully-valid MRZ yet, retry binarized. Beyond recovering low-contrast/blurry
    // scans, the threshold pass also cleans filler noise that yields a check-valid-but-wrong name.
    let r = await attempt(false, null);
    if (!r.done) r = await attempt(true, r.best);
    const best = r.best;
    // No candidate, or one where EVERY check digit failed (conf 0), means OCR latched onto
    // non-MRZ text (e.g. the passport header) that normalizeMrzLines padded into a parseable
    // shape. Surface a clean "not found" so the UI prompts a retake instead of fake fields.
    if (!best || best.conf === 0) return emptyResult();

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
    // Upscale small scans too: a rotated phone photo often leaves the MRZ only ~800px wide, which
    // tesseract reads poorly. Targeting ~1600px gives it legible OCR-B glyphs.
    return img.resize({ width: 1600 }).toBuffer();
  }
}
