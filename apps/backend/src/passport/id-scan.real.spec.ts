import { existsSync, readFileSync } from 'fs';
import path from 'path';
import sharp from 'sharp';
import { PassportService } from './passport.service';

// Heavy real scan (front + back, real tesseract) — opt-in via RUN_OCR_IT=1, self-skips without
// the gitignored PII fixtures + models. Single-thread libvips to bound native memory under jest.
sharp.concurrency(1);

const FRONT = path.join(__dirname, '..', '..', 'test-fixtures', 'id-karta-front.jpg');
const BACK = path.join(__dirname, '..', '..', 'test-fixtures', 'id-karta-orqa.jpg');
const MODELS = ['mrz', 'eng'].map((m) => path.join(__dirname, '..', '..', 'tessdata', `${m}.traineddata`));
const ready = process.env.RUN_OCR_IT === '1' && existsSync(FRONT) && existsSync(BACK) && MODELS.every(existsSync);

(ready ? describe : describe.skip)('PassportService — real ID card OCR (front + back)', () => {
  it('reads verified numbers from the back and the clean name from the front', async () => {
    const svc = new PassportService();
    const res = await svc.scanIdCard(readFileSync(FRONT), readFileSync(BACK));
    expect(res.docType).toBe('ID');
    expect(res.fields.passportSeries).toBe('AE');
    expect(res.fields.passportNumber).toBe('1295616');
    expect(res.fields.pinfl).toBe('40807841080026');
    expect(res.fields.gender).toBe('FEMALE');
    expect(res.fields.fullName).toContain('QODIROVA');
    expect(res.fields.fullName).toContain('XOLISXON');
    expect(res.fields.placeOfBirth).toContain('QORAKO');
    expect(res.confidence).toBe(100);
  }, 180000);
});
