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
const MODELS = ['mrz', 'eng'].map((m) => path.join(__dirname, '..', '..', 'tessdata', `${m}.traineddata`));
const ready = process.env.RUN_OCR_IT === '1' && existsSync(FIXTURE) && MODELS.every(existsSync);

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
    // VIZ (visible page) fields the MRZ lacks, read from the passport's printed side.
    expect(res.fields.placeOfBirth).toContain('QORAKO');
    expect(res.fields.passportIssueDate).toBe('2017-06-15T00:00:00.000Z');
    expect(res.fields.passportIssuer).toContain('IIB');
  }, 180000);

  it('reads a passport delivered as a PDF (first page rasterized)', async () => {
    // Wrap the passport image in a single-page PDF, then scan the PDF buffer.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const PdfPrinter = require('pdfmake');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const vfsMod = require('pdfmake/build/vfs_fonts');
    const vfs = vfsMod.vfs ?? vfsMod.pdfMake?.vfs ?? vfsMod.default?.vfs ?? vfsMod.default ?? vfsMod;
    const f = (n: string) => Buffer.from(vfs[n], 'base64');
    const printer = new PdfPrinter({ Roboto: { normal: f('Roboto-Regular.ttf'), bold: f('Roboto-Medium.ttf'), italics: f('Roboto-Italic.ttf'), bolditalics: f('Roboto-MediumItalic.ttf') } });
    const img = readFileSync(FIXTURE).toString('base64');
    const doc = printer.createPdfKitDocument({ pageMargins: [10, 10, 10, 10], content: [{ image: `data:image/jpeg;base64,${img}`, width: 560 }] });
    const pdf: Buffer = await new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      doc.on('data', (d: Buffer) => chunks.push(d));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.end();
    });
    const res = await svc.scan(pdf);
    expect(res.confidence).toBe(100);
    expect(res.fields.fullName).toBe('ISMOILOV KHURSHID');
    expect(res.fields.passportSeries).toBe('AB');
  }, 180000);
});
