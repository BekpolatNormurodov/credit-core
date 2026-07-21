import * as fs from 'fs';
import * as path from 'path';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { mockCaseDoc } from '../__fixtures__/case-doc.fixture';
import { DOC_REGISTRY } from '../registry';
import { sanitizeDocDefinition } from '../sanitize';

/**
 * Review pack — renders the full document set with COMPLETE, realistic test data (no "—" holes) into
 * a clean, numbered folder so the forms can be checked and signed off. Gated on REVIEW_PACK=1.
 *
 *   REVIEW_PACK=1 REVIEW_OUT="/c/Users/…/Downloads/hujjatlar-TASDIQLASH" \
 *   npx jest --config apps/backend/jest.config.js --rootDir apps/backend/src --runInBand review-pack
 *
 * One subfolder per collateral type; files are numbered in the «перечень» filing order.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PdfPrinter = require('pdfmake');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const vfsFontsModule = require('pdfmake/build/vfs_fonts');
const vfs =
  vfsFontsModule.vfs ?? vfsFontsModule.pdfMake?.vfs ?? vfsFontsModule.default?.vfs ?? vfsFontsModule.default ?? vfsFontsModule;
const printer = new PdfPrinter({
  Roboto: {
    normal: Buffer.from(vfs['Roboto-Regular.ttf'], 'base64'),
    bold: Buffer.from(vfs['Roboto-Medium.ttf'], 'base64'),
    italics: Buffer.from(vfs['Roboto-Italic.ttf'], 'base64'),
    bolditalics: Buffer.from(vfs['Roboto-MediumItalic.ttf'], 'base64'),
  },
});

function render(def: TDocumentDefinitions): Promise<Buffer> {
  const doc = printer.createPdfKitDocument(sanitizeDocDefinition(def));
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (d: Buffer) => chunks.push(d));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

/** Borrower/organisation data shared by all three variants — every field populated. */
const commonBorrower = {
  fullName: 'ЖЎЛДИБАЕВ РУСЛАН ОДИЛОВИЧ',
  passportSeries: 'AD',
  passportNumber: '4156235',
  passportIssuer: 'ТОШКЕНТ ШАҲАР ЧИЛОНЗОР ТУМАНИ ИИБ',
  passportIssueDate: new Date('2023-08-03T00:00:00.000Z'),
  pinfl: '52101901234567',
  birthDate: new Date('1990-05-12T00:00:00.000Z'),
  inn: '301456789',
  phone: '+998 90 123 45 67',
  address: 'Тошкент ш., Чилонзор тумани, Бунёдкор МФЙ, 12-уй',
  regAddress: 'Тошкент ш., Чилонзор тумани, Бунёдкор МФЙ, 12-уй, 34-хонадон',
  entrepreneurType: 'Якка тартибдаги тадбиркор',
  entrepreneurCertNo: '00114455',
};

const commonLine = {
  lineNumber: '1416',
  orderNumber: '2110 MFL 1416 PS',
  interestRate: 0.55,
  penaltyRate: 1.05,
};

const AUTO = mockCaseDoc({
  productType: 'AUTO' as never,
  contractNumber: '2110 MFL 1416 PS',
  borrower: commonBorrower as never,
  creditLine: {
    ...commonLine, loanType: 'MICROLOAN', amountTotal: 90_000_000, amountAuto: 90_000_000, amountPolis: 0, termMonths: 24,
    tranches: [{ termMonths: 24, principal: 90_000_000, scheduleType: 'ANNUITY' }],
  } as never,
  collaterals: [{
    type: 'AUTO', agreedValue: 98_000_000,
    model: 'CHEVROLET COBALT', bodyType: 'YENGIL SEDAN', bodyNo: 'XWBJA69VERA541765',
    engineNo: 'B15D212241522MTAX0454', chassis: 'RAKAMSIZ',
    techPassportNo: 'AAG 4268130', techPassportDate: new Date('2024-07-05T00:00:00.000Z'),
    stateNumber: '01 P 083 SC', color: 'OQ SUMMIT WHITE', year: 2024,
    address: '1-TRO VA IOB (YUNUSOBOD), Тошкент ш.',
    owners: [{ fullName: 'ЖЎЛДИБАЕВ РУСЛАН ОДИЛОВИЧ' }],
  }] as never,
});

const KVARTIRA = mockCaseDoc({
  contractNumber: '2110 MFL 1417 PS',
  borrower: commonBorrower as never,
  creditLine: {
    ...commonLine, loanType: 'MICROCREDIT', amountTotal: 150_000_000, amountAuto: 120_000_000, amountPolis: 30_000_000, termMonths: 33,
    tranches: [{ termMonths: 33, principal: 150_000_000, scheduleType: 'ANNUITY' }],
  } as never,
  collaterals: [{
    type: 'REAL_ESTATE', realtyKind: 'APARTMENT', propertyType: "KO'P QAVATLI UYDAGI XONADON",
    agreedValue: 266_000_000,
    address: 'TOSHKENT SHAHAR YUNUSOBOD TUMANI ADOLAT MFY 4-MAVZE 61-A-UY 51-XONADON',
    registryNo: '№ 1726266/R-A0000000 от 25.09.2023г.',
    cadastreNo: '№ 10:07:06:01:01:5091:0001:051 от 25.09.2023г.',
    totalAreaM2: 79.76, livingAreaM2: 52.89, usableAreaM2: 78.42, landAreaM2: 198,
    roomCount: 3, roomNames: 'зал, ошхона, 2 та ётоқхона',
    owners: [{ fullName: 'БАЙМИРЗАЕВА ГУЛНОРА МУРАТОВНА' }],
  }] as never,
});

const HOVLI = mockCaseDoc({
  contractNumber: '2110 MFL 1418 PS',
  borrower: commonBorrower as never,
  creditLine: {
    ...commonLine, loanType: 'MICROCREDIT', amountTotal: 150_000_000,
    amountAuto: 120_000_000, amountPolis: 30_000_000, termMonths: 60,
    tranches: [{ termMonths: 60, principal: 150_000_000, scheduleType: 'DIFFERENTIATED' }],
  } as never,
  collaterals: [{
    type: 'REAL_ESTATE', realtyKind: 'HOUSE', propertyType: 'YAKKA TARTIBDAGI TURAR JOY',
    agreedValue: 126_000_000,
    address: "TOSHKENT VILOYATI BO'STONLIQ TUMANI QO'SHQO'RG'ON MFY QO'SHQO'RG'ON KO'CHASI 104-UY",
    registryNo: '№1727224/Y-26006263 от 18.05.2026г.',
    cadastreNo: '№ 11:03:42:02:05:0396',
    totalAreaM2: 166.75, livingAreaM2: 77.75, usableAreaM2: 132.8, landAreaM2: 600,
    roomCount: 4, roomNames: 'зал, ошхона, 3 та ётоқхона',
    owners: [{ fullName: 'ИБРАГИМОВ ХОЛХЎЖА УМАРОВИЧ' }],
  }] as never,
});

/** Filing order from the «перечень» sheet, so the folder reads like the paper dossier. */
const ORDER: { key: string; name: string }[] = [
  { key: 'petition', name: '01-Murojaatnoma' },
  { key: 'scoreReport', name: '02-Skoring-tahlil' },
  { key: 'rklGen', name: '03-Bosh-kelishuv' },
  { key: 'act', name: '04-Baholash-dalolatnomasi' },
  { key: 'creditApplication', name: '05-Kredit-arizasi' },
  { key: 'contract', name: '06-Shartnoma' },
  { key: 'grafik', name: '07-Tolov-jadvali' },
  { key: 'prikaz', name: '08-Buyruq' },
  { key: 'protokol', name: '09-Protokol' },
  { key: 'obloshka', name: '10-Obloshka' },
  { key: 'cheklist', name: '11-Hujjatlar-royxati' },
  { key: 'disbursement', name: '12-Pul-otkazish-arizasi' },
  { key: 'accountantSplit', name: '13-Mablag-taqsimoti' },
  { key: 'monitoring1', name: '14-Monitoring-1-boshlangich' },
  { key: 'monitoring2', name: '15-Monitoring-2-6oy' },
  { key: 'monitoring3', name: '16-Monitoring-3-12oy' },
  { key: 'actNotary', name: '17-NOTARIUS-Dalolatnoma' },
  { key: 'prikazNotary', name: '18-NOTARIUS-Buyruq' },
  { key: 'rklGenNotary', name: '19-NOTARIUS-Bosh-kelishuv' },
];

const VARIANTS: [string, ReturnType<typeof mockCaseDoc>][] = [
  ['1-AVTO (mikroqarz)', AUTO],
  ['2-KVARTIRA (mikrokredit)', KVARTIRA],
  ['3-HOVLI (mikrokredit, differensial)', HOVLI],
];

const OUT = process.env.REVIEW_OUT || path.join(__dirname, '__review__');

(process.env.REVIEW_PACK === '1' ? describe : describe.skip)('review pack', () => {
  it('renders the complete document set with full test data', async () => {
    let n = 0;
    for (const [folder, c] of VARIANTS) {
      const dir = path.join(OUT, folder);
      fs.mkdirSync(dir, { recursive: true });
      for (const { key, name } of ORDER) {
        const tpl = DOC_REGISTRY[key];
        if (!tpl) throw new Error(`unknown registry key: ${key}`);
        fs.writeFileSync(path.join(dir, `${name}.pdf`), await render(tpl.build(c)));
        n++;
      }
    }
    // eslint-disable-next-line no-console
    console.log(`review pack: ${n} PDFs → ${OUT}`);
    expect(n).toBe(VARIANTS.length * ORDER.length);
  }, 180_000);
});
