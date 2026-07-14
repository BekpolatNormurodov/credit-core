import * as fs from 'fs';
import * as path from 'path';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { mockCaseDoc } from '../__fixtures__/case-doc.fixture';
import { DOC_REGISTRY } from '../registry';

/**
 * Local PDF render harness — NOT part of the normal test suite (gated on RENDER_PDFS=1).
 *
 * It renders every registry document for auto / kvartira / hovli fixtures into real .pdf files so
 * the generated forms can be opened and diffed cell-by-cell against the reference Excel sheets.
 *
 *   RENDER_PDFS=1 RENDER_OUT="/abs/out/dir" npm test -w @credit-core/backend -- render-harness
 *
 * Reuses the exact same pdfmake + Roboto font path as PdfService so output matches production.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PdfPrinter = require('pdfmake');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const vfsFontsModule = require('pdfmake/build/vfs_fonts');
const vfs =
  vfsFontsModule.vfs ??
  vfsFontsModule.pdfMake?.vfs ??
  vfsFontsModule.default?.vfs ??
  vfsFontsModule.default ??
  vfsFontsModule;
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
  const pdfDoc = printer.createPdfKitDocument(def);
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    pdfDoc.on('data', (d: Buffer) => chunks.push(d));
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
    pdfDoc.on('error', reject);
    pdfDoc.end();
  });
}

// Single-collateral fixtures so each form's collateral block is unambiguous.
const AUTO = mockCaseDoc({
  productType: 'AUTO' as unknown as never,
  collaterals: [{
    type: 'AUTO' as unknown as never,
    agreedValue: 98_000_000 as unknown as never,
    model: 'CHEVROLET COBALT' as unknown as never,
    bodyType: 'YENGIL SEDAN' as unknown as never,
    bodyNo: 'XWBJA69VERA541765' as unknown as never,
    engineNo: 'B15D212241522MTAX0454' as unknown as never,
    chassis: 'RAKAMSIZ' as unknown as never,
    techPassportNo: 'AAG 4268130' as unknown as never,
    techPassportDate: new Date('2024-07-05T00:00:00.000Z') as unknown as never,
    stateNumber: '01 P 083 SC' as unknown as never,
    color: 'OQ SUMMIT WHITE' as unknown as never,
    year: 2024 as unknown as never,
    owners: [{ fullName: 'UBAYDULLAYEV ZUXRIDDIN NASRIDDINOVICH' } as unknown as never],
  }],
});
const KVARTIRA = mockCaseDoc({
  productType: 'REAL_ESTATE' as unknown as never,
  collaterals: [{
    type: 'REAL_ESTATE' as unknown as never,
    realtyKind: 'APARTMENT' as unknown as never,
    agreedValue: 266_000_000 as unknown as never,
    address: 'TOSHKENT SHAHRI YUNUSOBOD TUMANI, 21-uy' as unknown as never,
    registryNo: '1727224/Y-26006263' as unknown as never,
    cadastreNo: '11:03:42:02:05:0396' as unknown as never,
    totalAreaM2: 166.75 as unknown as never,
    livingAreaM2: 77.75 as unknown as never,
    roomCount: 4 as unknown as never,
    owners: [{ fullName: 'BAYMIRZAYEVA GULNORA MURATOVNA' } as unknown as never],
  }],
});
const HOVLI = mockCaseDoc({
  productType: 'REAL_ESTATE' as unknown as never,
  collaterals: [{
    type: 'REAL_ESTATE' as unknown as never,
    realtyKind: 'HOUSE' as unknown as never,
    agreedValue: 126_000_000 as unknown as never,
    address: "TOSHKENT VILOYATI BO'STONLIQ TUMANI QO'SHQO'RG'ON MFY, KO'CHASI 104-UY" as unknown as never,
    registryNo: '1727224/Y-26006263' as unknown as never,
    cadastreNo: '11:03:42:02:05:0396' as unknown as never,
    totalAreaM2: 166.75 as unknown as never,
    livingAreaM2: 77.75 as unknown as never,
    landAreaM2: 600 as unknown as never,
    roomCount: 4 as unknown as never,
    owners: [{ fullName: 'IBIRAGIMOV XOLXOJA UMAROVICH' } as unknown as never],
  }],
});

const VARIANTS = { auto: AUTO, kvartira: KVARTIRA, hovli: HOVLI };
const OUT = process.env.RENDER_OUT || path.join(__dirname, '__out__');

(process.env.RENDER_PDFS ? describe : describe.skip)('PDF render harness', () => {
  it('renders every registry document for auto / kvartira / hovli', async () => {
    fs.mkdirSync(OUT, { recursive: true });
    let n = 0;
    for (const [vk, c] of Object.entries(VARIANTS)) {
      for (const [key, d] of Object.entries(DOC_REGISTRY)) {
        const buf = await render(d.build(c));
        fs.writeFileSync(path.join(OUT, `${vk}__${key}.pdf`), buf);
        n++;
      }
    }
    // eslint-disable-next-line no-console
    console.log(`rendered ${n} PDFs → ${OUT}`);
    expect(n).toBeGreaterThan(0);
  }, 120_000);
});
