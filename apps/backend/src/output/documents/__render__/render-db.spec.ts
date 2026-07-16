import * as fs from 'fs';
import * as path from 'path';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { PrismaClient } from '@prisma/client';
import { loadCaseForDocs } from '../case-document.loader';
import { DOC_REGISTRY } from '../registry';
import { sanitizeDocDefinition } from '../sanitize';

/**
 * Real-data PDF render harness — renders documents from the actual database, NOT fixtures.
 * Gated on RENDER_DB=1 + DATABASE_URL so it never runs in the normal suite.
 *
 *   RENDER_DB=1 DATABASE_URL="mysql://root:root@localhost:3307/credit_core" \
 *   RENDER_OUT="/abs/out" CASE="<optional case number>" \
 *   npm test -w @credit-core/backend -- render-db
 *
 * Without CASE it renders the 3 most-recent cases that have collateral. Output files are named
 * real_<number>__<docKey>.pdf so they can be opened and diffed against the Excel sheets.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PdfPrinter = require('pdfmake');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const vfsFontsModule = require('pdfmake/build/vfs_fonts');
const vfs =
  vfsFontsModule.vfs ?? vfsFontsModule.pdfMake?.vfs ?? vfsFontsModule.default?.vfs ?? vfsFontsModule.default ?? vfsFontsModule;
const fonts = {
  Roboto: {
    normal: Buffer.from(vfs['Roboto-Regular.ttf'], 'base64'),
    bold: Buffer.from(vfs['Roboto-Medium.ttf'], 'base64'),
    italics: Buffer.from(vfs['Roboto-Italic.ttf'], 'base64'),
    bolditalics: Buffer.from(vfs['Roboto-MediumItalic.ttf'], 'base64'),
  },
};
const printer = new PdfPrinter(fonts);
function render(def: TDocumentDefinitions): Promise<Buffer> {
  // Mirror PdfService: sanitise font-less glyphs before rendering.
  const pdfDoc = printer.createPdfKitDocument(sanitizeDocDefinition(def));
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    pdfDoc.on('data', (d: Buffer) => chunks.push(d));
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
    pdfDoc.on('error', reject);
    pdfDoc.end();
  });
}

const OUT = process.env.RENDER_OUT || path.join(__dirname, '__out__');
const RUN = !!process.env.RENDER_DB && !!process.env.DATABASE_URL;

(RUN ? describe : describe.skip)('real-data PDF render', () => {
  it('renders every registry document from live case data', async () => {
    fs.mkdirSync(OUT, { recursive: true });
    const prisma = new PrismaClient();
    try {
      const want = process.env.CASE;
      const cases = want
        ? await prisma.creditCase.findMany({ where: { number: want }, select: { id: true, number: true } })
        : await prisma.creditCase.findMany({
            where: { collaterals: { some: {} } },
            select: { id: true, number: true },
            orderBy: { createdAt: 'desc' },
            take: 3,
          });
      // eslint-disable-next-line no-console
      console.log(`cases: ${cases.map((c) => c.number).join(', ') || '(none)'}`);
      let n = 0;
      for (const cc of cases) {
        // loadCaseForDocs only uses prisma.creditCase / prisma.organization — PrismaClient is compatible.
        const c = await loadCaseForDocs(prisma as never, cc.id);
        if (!c) continue;
        const safe = String(cc.number).replace(/[^\w-]+/g, '_');
        for (const [key, d] of Object.entries(DOC_REGISTRY)) {
          try {
            const buf = await render(d.build(c));
            fs.writeFileSync(path.join(OUT, `real_${safe}__${key}.pdf`), buf);
            n++;
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error(`FAILED ${key} for ${cc.number}:`, (e as Error).message);
          }
        }
      }
      // eslint-disable-next-line no-console
      console.log(`rendered ${n} PDFs → ${OUT}`);
      expect(n).toBeGreaterThan(0);
    } finally {
      await prisma.$disconnect();
    }
  }, 180_000);
});
