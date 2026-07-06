import sharp from 'sharp';
import { PassportService } from './passport.service';
import type { OcrFn } from './passport.service';

// Classic ICAO TD3 sample with valid check digits (mrz package README).
const VALID_TD3 = [
  'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<',
  'L898902C36UTO7408122F1204159ZE184226B<<<<<10',
].join('\n');

describe('PassportService', () => {
  const svc = new PassportService();
  // A realistic-scan-sized blank (OCR is stubbed, so content is irrelevant — but a 12px image would
  // be upscaled ~130× by preprocess, making these fast tests slow). Real photos are ~1000px+.
  let blankImage: Buffer;
  beforeAll(async () => {
    blankImage = await sharp({ create: { width: 1000, height: 700, channels: 3, background: '#fff' } }).png().toBuffer();
  });

  it('reads a valid MRZ (stubbed OCR) → 100% confidence and mapped name', async () => {
    const res = await svc.scan(blankImage, async () => VALID_TD3);
    expect(res.confidence).toBe(100);
    expect(res.format).toBe('TD3');
    expect(res.fields.fullName.startsWith('ERIKSSON')).toBe(true);
    expect(res.rawMrz).toHaveLength(2);
    expect(res.perField.length).toBeGreaterThan(0);
  });

  it('returns an empty result with a warning when no MRZ is found', async () => {
    const res = await svc.scan(blankImage, async () => 'no machine readable zone here');
    expect(res.confidence).toBe(0);
    expect(res.warnings).toContain('mrz_not_found');
  });

  it('recovers via the binarized second pass when the base pass is unreadable', async () => {
    let calls = 0;
    const flaky: OcrFn = async () => (++calls > 4 ? VALID_TD3 : 'blurry noise ####');
    const res = await svc.scan(blankImage, flaky);
    expect(res.confidence).toBe(100);
    expect(calls).toBeGreaterThan(4);
  });

  it('warns when the scanned passport is already expired', async () => {
    // VALID_TD3 expires 2012-04-15 → always in the past.
    const res = await svc.scan(blankImage, async () => VALID_TD3);
    expect(res.warnings).toContain('expired');
  });

  it('exposes a nationality string on the result fields', async () => {
    const res = await svc.scan(blankImage, async () => VALID_TD3);
    expect(typeof res.fields.nationality).toBe('string');
  });

  it('does NOT surface non-MRZ garbage: header text padded to a valid width parses at 0% → not found', async () => {
    // With the char whitelist, OCR of the passport HEADER can yield 44-char [A-Z0-9<] lines that
    // normalizeMrzLines makes parseable. Every check digit fails (conf 0) → must be treated as
    // not-found, never returned as fake borrower fields.
    // All-letter/filler fields: no numeric check position can validate → guaranteed conf 0.
    const headerGarbage = [
      'OZBEKISTONRESPUBLIKASI<REPUBLICOFUZBEKISTAN<',
      'PASSPORTPASSPORT<UZB<REPUBLIC<OF<UZBEKISTAN<',
    ].join('\n');
    const res = await svc.scan(blankImage, async () => headerGarbage);
    expect(res.confidence).toBe(0);
    expect(res.warnings).toContain('mrz_not_found');
    expect(res.fields.fullName).toBe('');
    expect(res.fields.passportSeries).toBe('');
  });

  it('recovers when OCR adds stray filler chars (wrong line length) — mrz.parse is strict on length', async () => {
    const [l1, l2] = VALID_TD3.split('\n');
    const noisy = [l1 + '<<', l2].join('\n'); // 46 + 44: raw parse() throws "unrecognized document format"
    const res = await svc.scan(blankImage, async () => noisy);
    expect(res.confidence).toBe(100);
  });
});
