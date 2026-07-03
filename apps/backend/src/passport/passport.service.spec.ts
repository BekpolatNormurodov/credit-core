import sharp from 'sharp';
import { PassportService } from './passport.service';

// Classic ICAO TD3 sample with valid check digits (mrz package README).
const VALID_TD3 = [
  'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<',
  'L898902C36UTO7408122F1204159ZE184226B<<<<<10',
].join('\n');

describe('PassportService', () => {
  const svc = new PassportService();
  let tinyImage: Buffer;
  beforeAll(async () => {
    tinyImage = await sharp({ create: { width: 12, height: 12, channels: 3, background: '#fff' } }).png().toBuffer();
  });

  it('reads a valid MRZ (stubbed OCR) → 100% confidence and mapped name', async () => {
    const res = await svc.scan(tinyImage, async () => VALID_TD3);
    expect(res.confidence).toBe(100);
    expect(res.format).toBe('TD3');
    expect(res.fields.fullName.startsWith('ERIKSSON')).toBe(true);
    expect(res.rawMrz).toHaveLength(2);
    expect(res.perField.length).toBeGreaterThan(0);
  });

  it('returns an empty result with a warning when no MRZ is found', async () => {
    const res = await svc.scan(tinyImage, async () => 'no machine readable zone here');
    expect(res.confidence).toBe(0);
    expect(res.warnings).toContain('mrz_not_found');
  });
});
