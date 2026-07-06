import { existsSync, readFileSync } from 'fs';
import path from 'path';
import sharp from 'sharp';
import { PassportService } from './passport.service';

// This heavy real scan (8 orientations × real tesseract) OOMs libvips under jest's constrained
// worker at default concurrency; single-threading the vips pool keeps peak native memory bounded.
sharp.concurrency(1);

// End-to-end OCR against a REAL passport photo, using the bundled MRZ traineddata (no stub).
// The fixture is a real document (PII), the model is large, and a full real scan is heavy — so this
// is opt-in and never runs in the default parallel suite (where it would starve the fast tests).
// Run it deliberately:  npm run test:ocr -w @credit-core/backend
const FIXTURE = path.join(__dirname, '..', '..', 'test-fixtures', 'passport-uz.jpg');
const MODEL = path.join(__dirname, '..', '..', 'tessdata', 'mrz.traineddata');
const ready = process.env.RUN_OCR_IT === '1' && existsSync(FIXTURE) && existsSync(MODEL);

(ready ? describe : describe.skip)('PassportService — real image OCR (mrz model)', () => {
  const svc = new PassportService();

  it('reads the UZ passport MRZ cleanly across any orientation → ideal fields', async () => {
    const res = await svc.scan(readFileSync(FIXTURE));
    expect(res.confidence).toBe(100);
    expect(res.format).toBe('TD3');
    // Name is not check-digit protected — the whole point of the mrz model is to read it clean.
    expect(res.fields.fullName).toBe('ISMOILOV KHURSHID');
    expect(res.fields.passportSeries).toBe('AB');
    expect(res.fields.passportNumber).toBe('6935244');
    expect(res.fields.gender).toBe('MALE');
    expect(res.fields.birthDate).toBe('2000-07-31T00:00:00.000Z');
    expect(res.fields.passportExpiry).toBe('2027-06-14T00:00:00.000Z');
    expect(res.fields.pinfl).toBe('53107005320039');
    expect(res.fields.nationality).toContain('zbekiston');
  }, 180000);
});
