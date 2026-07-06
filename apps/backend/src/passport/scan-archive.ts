import { randomBytes } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import type { PassportScanResult } from '@credit-core/shared';

/** image/* mimetype → a safe file extension. */
export function extForMime(mimetype: string | undefined): string {
  const m = (mimetype || '').toLowerCase();
  if (m.includes('png')) return 'png';
  if (m.includes('webp')) return 'webp';
  if (m.includes('jpeg') || m.includes('jpg')) return 'jpg';
  return 'img';
}

/** A sortable, PII-free filename: <ISO-ish ts>__<ok|nomrz|lowconf>__conf<NN>__<rand>.<ext>. */
export function buildScanFilename(now: Date, result: PassportScanResult, ext: string): string {
  const ts = now.toISOString().replace(/[:.]/g, '-');
  const found = result.warnings.includes('mrz_not_found') ? false : result.confidence > 0;
  const status = !found ? 'nomrz' : result.confidence >= 60 ? 'ok' : 'lowconf';
  const conf = String(result.confidence).padStart(3, '0');
  return `${ts}__${status}__conf${conf}__${randomBytes(3).toString('hex')}.${ext}`;
}

/** One-line audit summary of a scan — what was read (or not), for the backend log. */
export function scanSummary(result: PassportScanResult, filename: string): string {
  const f = result.fields;
  const found = !result.warnings.includes('mrz_not_found');
  const who = found ? `name="${f.fullName}" doc=${f.passportSeries}${f.passportNumber} pinfl=${f.pinfl || '-'}` : 'MRZ not found';
  const warn = result.warnings.length ? ` warnings=[${result.warnings.join(',')}]` : '';
  return `passport-scan file=${filename} confidence=${result.confidence}% format=${result.format || '-'} ${who}${warn}`;
}

/**
 * Persist the uploaded image and return the saved path. Every upload is kept — successful or not —
 * for later audit/debugging. Best-effort: callers should treat a rejection as non-fatal.
 */
export async function archiveScan(dir: string, buffer: Buffer, mimetype: string | undefined, result: PassportScanResult, now: Date): Promise<string> {
  await mkdir(dir, { recursive: true });
  const filename = buildScanFilename(now, result, extForMime(mimetype));
  const full = path.join(dir, filename);
  await writeFile(full, buffer);
  return full;
}
