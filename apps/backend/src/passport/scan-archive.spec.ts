import { existsSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import type { PassportScanResult } from '@credit-core/shared';
import { archiveScan, buildScanFilename, extForMime, scanSummary } from './scan-archive';

const result = (over: Partial<PassportScanResult> = {}): PassportScanResult => ({
  confidence: 100,
  fields: { fullName: 'ISMOILOV KHURSHID', passportSeries: 'AB', passportNumber: '6935244', birthDate: null, passportExpiry: null, gender: 'MALE', nationality: 'UZB', pinfl: '53107005320039' },
  perField: [],
  format: 'TD3',
  rawMrz: [],
  warnings: [],
  ...over,
});

describe('extForMime', () => {
  it('maps common image types', () => {
    expect(extForMime('image/jpeg')).toBe('jpg');
    expect(extForMime('image/png')).toBe('png');
    expect(extForMime('image/webp')).toBe('webp');
    expect(extForMime(undefined)).toBe('img');
  });
});

describe('buildScanFilename', () => {
  const now = new Date('2026-07-06T12:30:05.123Z');
  it('marks a confident read "ok" with a padded confidence', () => {
    const name = buildScanFilename(now, result(), 'jpg');
    expect(name).toMatch(/^2026-07-06T12-30-05-123Z__ok__conf100__[0-9a-f]{6}\.jpg$/);
  });
  it('marks a not-found read "nomrz"', () => {
    const name = buildScanFilename(now, result({ confidence: 0, warnings: ['mrz_not_found'] }), 'png');
    expect(name).toContain('__nomrz__conf000__');
  });
  it('marks a weak read "lowconf"', () => {
    const name = buildScanFilename(now, result({ confidence: 42, warnings: ['low_confidence'] }), 'jpg');
    expect(name).toContain('__lowconf__conf042__');
  });
});

describe('scanSummary', () => {
  it('summarizes a successful read', () => {
    expect(scanSummary(result(), 'x.jpg')).toContain('name="ISMOILOV KHURSHID" doc=AB6935244');
  });
  it('summarizes a not-found read', () => {
    expect(scanSummary(result({ confidence: 0, warnings: ['mrz_not_found'] }), 'x.jpg')).toContain('MRZ not found');
  });
});

describe('archiveScan', () => {
  it('writes the uploaded bytes and returns the path', async () => {
    const dir = path.join(tmpdir(), `scan-archive-test-${process.pid}`);
    try {
      const buf = Buffer.from('fake-image-bytes');
      const saved = await archiveScan(dir, buf, 'image/jpeg', result(), new Date('2026-07-06T12:30:05.123Z'));
      expect(existsSync(saved)).toBe(true);
      expect(readFileSync(saved).equals(buf)).toBe(true);
      expect(saved.endsWith('.jpg')).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
