import { Injectable } from '@nestjs/common';
import path from 'path';
import sharp from 'sharp';
import { createWorker, PSM } from 'tesseract.js';

// Each scan preprocesses 8 one-shot images (4 orientations × 2 passes) that are never reused, so
// libvips' operation cache only piles up memory with no hit benefit — disable it.
sharp.cache(false);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { parse } = require('mrz');
import type { PassportScanResult } from '@credit-core/shared';
import { extractMrzLines, normalizeMrzLines, mapMrzToBorrower, scoreConfidence, expiryWarnings, MrzDetail } from './mrz.util';
import { extractIdFront, extractIdBackViz, mergeIdResult, extractPassportViz } from './id-fields.util';

/** OCR a preprocessed image buffer → raw text. Injectable so the pipeline is unit-testable. */
export type OcrFn = (image: Buffer) => Promise<string>;

// Ordered by likelihood so the early-exit fires sooner: upright, then the common phone-rotations.
const ORIENTATIONS = [0, 270, 90, 180];
const MRZ_WHITELIST = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<';
// Dedicated OCR-B / MRZ model (BSD-3, DoubangoTelecom/tesseractMRZ). The general 'eng' model
// misreads the MRZ font — '<' as K/C/L, A→4, Z→2 — so the header text wins; 'mrz' reads it cleanly.
const OCR_LANG = 'mrz';
// The 'mrz' model is not on the tesseract CDN, so a local traineddata dir is mandatory. Prod sets
// TESSDATA_PATH; otherwise resolve the bundled dir next to the backend root (works in dist + tests).
const TESSDATA_DIR = process.env.TESSDATA_PATH || path.join(__dirname, '..', '..', 'tessdata');

/** One orientation's parse result plus its check-digit confidence and the orientation it came from. */
interface Candidate {
  parsed: any;
  conf: number;
  lines: string[];
  angle: number;
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
    // Crop the bottom MRZ band FIRST: a strip has far less for the model to process (~1.3s/call vs
    // ~5s for a full page), so a well-framed passport reads in a few seconds instead of ~20s. Full
    // frame is the fallback for a passport small/high in the frame (MRZ not at the bottom).
    if (ocr) return this.run(file, ocr, [true, false]);
    // mrz model reads the MRZ; eng model reads the visible page (VIZ) for the fields the MRZ lacks
    // (place of birth, issue date, issuer). Both ship as raw .traineddata under TESSDATA_DIR.
    const [mrzWorker, textWorker] = await Promise.all([
      createWorker(OCR_LANG, 1, { langPath: TESSDATA_DIR, cacheMethod: 'none', gzip: false }),
      createWorker('eng', 1, { langPath: TESSDATA_DIR, cacheMethod: 'none', gzip: false }),
    ]);
    try {
      await mrzWorker.setParameters({ tessedit_char_whitelist: MRZ_WHITELIST });
      const best = await this.findBestMrz(file, async (img) => (await mrzWorker.recognize(img)).data.text, [true, false]);
      const result = this.mrzToResult(best);
      // Fill the VIZ-only fields the MRZ lacks by OCR-ing the visible page at the orientation the MRZ
      // was found. Best-effort: a VIZ hiccup must never fail the (verified) MRZ result.
      if (best && best.conf > 0) {
        try {
          const vizText = (await textWorker.recognize(await this.preprocessViz(file, best.angle, 1500))).data.text;
          const viz = extractPassportViz(vizText);
          const unverified: string[] = [];
          if (viz.placeOfBirth) { result.fields.placeOfBirth = viz.placeOfBirth; unverified.push('placeOfBirth'); }
          if (viz.issueDate) { result.fields.passportIssueDate = viz.issueDate; unverified.push('passportIssueDate'); }
          if (viz.issuer) { result.fields.passportIssuer = viz.issuer; unverified.push('passportIssuer'); }
          result.docType = 'PASSPORT';
          if (unverified.length) result.unverifiedFields = unverified;
        } catch {
          /* VIZ is best-effort; keep the verified MRZ result */
        }
      }
      return result;
    } finally {
      await Promise.all([mrzWorker.terminate(), textWorker.terminate()]);
    }
  }

  /**
   * Find the best MRZ candidate across orientations/bands (or null). `bands`: `false` = full frame,
   * `true` = cropped bottom MRZ band. Exposes the winning orientation so the passport VIZ can be
   * OCR'd at the same angle. Prefers a fully-valid parse; ID back stops early on high confidence.
   */
  private async findBestMrz(file: Buffer, ocr: OcrFn, bands: boolean[] = [false], earlyExitConf?: number): Promise<Candidate | null> {
    const attempt = async (binarize: boolean, cropBand: boolean, carried: Candidate | null): Promise<{ best: Candidate | null; done: boolean }> => {
      let best = carried;
      for (const angle of ORIENTATIONS) {
        const img = await this.preprocess(file, angle, binarize, cropBand);
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
        if (better) best = { parsed, conf, lines: norm, angle };
        // Stop early on a fully-valid parse, or (ID back only) once check-digit confidence is high
        // enough — its MRZ name line is corrupt so `valid` never trips, but the numbers are solid.
        if (parsed.valid || (earlyExitConf != null && conf >= earlyExitConf)) return { best, done: true };
      }
      return { best, done: false };
    };

    // Each band: base pass; if no fully-valid MRZ yet, retry binarized (recovers low-contrast/blur
    // and cleans filler noise). Stop as soon as a band yields a valid parse.
    let r: { best: Candidate | null; done: boolean } = { best: null, done: false };
    for (const band of bands) {
      r = await attempt(false, band, r.best);
      if (!r.done) r = await attempt(true, band, r.best);
      if (r.done) break;
    }
    return r.best;
  }

  /** Map the best MRZ candidate to the API result (or an empty "not found" result). */
  private mrzToResult(best: Candidate | null): PassportScanResult {
    // conf 0 = every check digit failed → OCR latched onto non-MRZ text (e.g. the passport header)
    // that normalizeMrzLines padded into a parseable shape. Surface a clean "not found".
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

  /** MRZ read → API result. `bands`: full-frame and/or bottom-band crop. */
  private async run(file: Buffer, ocr: OcrFn, bands: boolean[] = [false], earlyExitConf?: number): Promise<PassportScanResult> {
    return this.mrzToResult(await this.findBestMrz(file, ocr, bands, earlyExitConf));
  }

  /** Scan the BACK of an ID card → TD1 MRZ fields (name is ignored by callers — taken from front). */
  async scanIdBack(file: Buffer, ocr?: OcrFn): Promise<PassportScanResult> {
    // Try the cropped MRZ band first (that is where the ID-back MRZ reads cleanly), full frame as
    // a fallback (e.g. the card small in frame). PSM 4 (single column of variable-size text) reads
    // the cropped MRZ block far better than the default layout analysis.
    if (ocr) return this.run(file, ocr, [true, false], 90);
    const worker = await createWorker(OCR_LANG, 1, { langPath: TESSDATA_DIR, cacheMethod: 'none', gzip: false });
    try {
      await worker.setParameters({ tessedit_char_whitelist: MRZ_WHITELIST, tessedit_pageseg_mode: PSM.SINGLE_COLUMN });
      return await this.run(file, async (img) => (await worker.recognize(img)).data.text, [true, false], 90);
    } finally {
      await worker.terminate();
    }
  }

  /**
   * Scan an ID card (front + back) → merged fields. `mrzOcr` reads the back MRZ (mrz model),
   * `textOcr` reads the printed front/back text (eng model). Inject both in tests.
   */
  async scanIdCard(front: Buffer, back: Buffer, mrzOcr?: OcrFn, textOcr?: OcrFn): Promise<PassportScanResult> {
    if (mrzOcr && textOcr) return this.mergeId(front, back, mrzOcr, textOcr);
    // Create both workers concurrently (the eng model load is a fixed per-scan cost).
    const [mrzWorker, textWorker] = await Promise.all([
      createWorker(OCR_LANG, 1, { langPath: TESSDATA_DIR, cacheMethod: 'none', gzip: false }),
      createWorker('eng', 1, { langPath: TESSDATA_DIR, cacheMethod: 'none', gzip: false }),
    ]);
    try {
      await mrzWorker.setParameters({ tessedit_char_whitelist: MRZ_WHITELIST, tessedit_pageseg_mode: PSM.SINGLE_COLUMN });
      const mrzOcrFn: OcrFn = async (img) => (await mrzWorker.recognize(img)).data.text;
      const textOcrFn: OcrFn = async (img) => (await textWorker.recognize(img)).data.text;
      return await this.mergeId(front, back, mrzOcrFn, textOcrFn);
    } finally {
      await Promise.all([mrzWorker.terminate(), textWorker.terminate()]);
    }
  }

  private async mergeId(front: Buffer, back: Buffer, mrzOcr: OcrFn, textOcr: OcrFn): Promise<PassportScanResult> {
    // The back MRZ (mrz worker) runs in parallel with the front/back VIZ text (eng worker); the two
    // text reads share one worker so stay sequential, but overlap the MRZ read.
    const [backMrz, texts] = await Promise.all([
      this.scanIdBack(back, mrzOcr),
      (async () => ({
        frontText: await textOcr(await this.preprocessViz(front)),
        backText: await textOcr(await this.preprocessViz(back)),
      }))(),
    ]);
    const merged = mergeIdResult(backMrz, extractIdFront(texts.frontText), extractIdBackViz(texts.backText));
    if (backMrz.warnings.includes('mrz_not_found')) {
      merged.warnings = [...merged.warnings.filter((w) => w !== 'mrz_not_found'), 'id_back_mrz_not_found'];
    }
    return merged;
  }

  /** Preprocess the printed (VIZ) side for the eng text OCR: the labels/values are large and upright,
   *  so grayscale/normalize/sharpen at ~1300px reads cleanly and fast (bigger only adds latency). */
  private async preprocessViz(file: Buffer, angle = 0, width = 1300): Promise<Buffer> {
    return sharp(file, { failOn: 'none' }).rotate(angle).grayscale().normalize().sharpen().resize({ width }).toBuffer();
  }

  /** Rotate + grayscale + normalize + sharpen (+ optional threshold/band crop) + upscale. */
  private async preprocess(file: Buffer, angle: number, binarize: boolean, cropBand = false): Promise<Buffer> {
    let img = sharp(file, { failOn: 'none' }).rotate(angle).grayscale().normalize().sharpen();
    if (binarize) img = img.threshold(140);
    if (cropBand) {
      // The ID-back MRZ sits at the bottom over a security pattern; crop the bottom band (drops the
      // QR/chip/hologram noise that shifts the lines) at FULL resolution, THEN upscale the band to
      // ~1600px — far bigger OCR-B glyphs than cropping a pre-shrunk image. Materialize first so
      // metadata reflects the applied rotation (metadata() on a lazy .rotate() returns input dims).
      const base = await img.toBuffer();
      const meta = await sharp(base).metadata();
      const h = meta.height ?? 0;
      if (h > 0) {
        const top = Math.round(h * 0.66);
        return sharp(base).extract({ left: 0, top, width: meta.width ?? 1, height: h - top }).resize({ width: 1600 }).toBuffer();
      }
      return sharp(base).resize({ width: 1600 }).toBuffer();
    }
    // Upscale small scans too: a rotated phone photo often leaves the MRZ only ~800px wide, which
    // tesseract reads poorly. Targeting ~1600px gives it legible OCR-B glyphs.
    return img.resize({ width: 1600 }).toBuffer();
  }
}
