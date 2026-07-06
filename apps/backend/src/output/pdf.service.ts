import { Injectable } from '@nestjs/common';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { CreditCaseDto } from '@credit-core/shared';
import { sumToWordsUz } from '../common/sum-to-words.util';

// pdfmake server-side: PdfPrinter + Roboto (covers Cyrillic & Latin).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PdfPrinter = require('pdfmake');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const vfsFontsModule = require('pdfmake/build/vfs_fonts');
// Across pdfmake versions the vfs map may be the module itself, or nested
// under .vfs / .pdfMake.vfs / .default.
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

const fmtMoney = (n: number | null): string =>
  n == null ? '—' : new Intl.NumberFormat('ru-RU').format(n) + " so'm";

@Injectable()
export class PdfService {
  private readonly printer = new PdfPrinter(fonts);

  /** Render any pdfmake document definition to a Buffer. */
  async render(def: TDocumentDefinitions): Promise<Buffer> {
    const pdfDoc = this.printer.createPdfKitDocument(def);
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      pdfDoc.on('data', (d: Buffer) => chunks.push(d));
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
      pdfDoc.on('error', reject);
      pdfDoc.end();
    });
  }

  /** Build the "Garov baholash akti" (valuation act) PDF for a case. */
  async valuationAct(c: CreditCaseDto): Promise<Buffer> {
    const totalCollateral = c.collaterals.reduce((s, x) => s + (x.agreedValue ?? 0), 0);
    const value = totalCollateral || c.amount || 0;
    const words = value ? sumToWordsUz(value) : '—';

    const row = (label: string, val: string) => [
      { text: label, bold: true, margin: [0, 2, 0, 2] as [number, number, number, number] },
      { text: val || '—', margin: [0, 2, 0, 2] as [number, number, number, number] },
    ];

    const collateralBlocks = c.collaterals.flatMap((col, i) => {
      const isHouse = col.realtyKind === 'HOUSE';
      const realtyLabel = col.type === 'AUTO' ? 'Avtotransport' : `Uy-joy — ${isHouse ? 'Hovli' : 'Kvartira'}`;
      const head = {
        text: `Garov ${i + 1} — ${realtyLabel}`,
        bold: true,
        margin: [0, 12, 0, 4] as [number, number, number, number],
      };
      const rows =
        col.type === 'AUTO'
          ? [
              row('Model', col.model ?? '—'),
              row('Davlat raqami', col.stateNumber ?? '—'),
              row('Tex passport', col.techPassportNo ?? '—'),
              row('Kuzov / dvigatel', `${col.bodyNo ?? '—'} / ${col.engineNo ?? '—'}`),
              row('Rang / yil', `${col.color ?? '—'} / ${col.year ?? '—'}`),
              row('Probeg', col.mileage != null ? `${col.mileage} km` : '—'),
              row('Garov qiymati', fmtMoney(col.agreedValue)),
            ]
          : [
              row('Manzil', col.address ?? '—'),
              row('Kadastr №', col.cadastreNo ?? '—'),
              row('Reestr №', col.registryNo ?? '—'),
              row('Mulk turi', col.propertyType ?? '—'),
              ...(isHouse ? [row('Yer maydoni', col.landAreaM2 != null ? `${col.landAreaM2} m²` : '—')] : []),
              row(isHouse ? 'Umumiy / foydali maydon' : 'Umumiy maydon', isHouse ? `${col.totalAreaM2 ?? '—'} / ${col.usableAreaM2 ?? '—'} m²` : `${col.totalAreaM2 ?? '—'} m²`),
              row('Yashash maydoni', col.livingAreaM2 != null ? `${col.livingAreaM2} m²` : '—'),
              row('Xonalar', [isHouse ? null : col.roomNames, col.roomCount != null ? `(${col.roomCount})` : ''].filter(Boolean).join(' ') || '—'),
              row('Garov qiymati', fmtMoney(col.agreedValue)),
            ];
      return [head, { table: { widths: [180, '*'], body: rows } }];
    });

    const def: TDocumentDefinitions = {
      defaultStyle: { font: 'Roboto', fontSize: 10 },
      pageMargins: [40, 50, 40, 50],
      content: [
        { text: 'GAROV BAHOLASH AKTI', style: 'h1', alignment: 'center' },
        { text: `№ ${c.number}`, alignment: 'center', margin: [0, 0, 0, 16] },
        {
          table: {
            widths: [180, '*'],
            body: [
              row('Filial', c.branch ? `${c.branch.name} (${c.branch.symbol})` : '—'),
              row('Qarz oluvchi', c.borrower?.fullName ?? '—'),
              row('Pasport', [c.borrower?.passportSeries, c.borrower?.passportNumber].filter(Boolean).join(' ') || '—'),
              row('Kredit summasi', fmtMoney(c.amount)),
              row('Muddat', c.termMonths != null ? `${c.termMonths} oy` : '—'),
              row('KATM narxi', fmtMoney(c.katmPrice)),
              row('Garovlar soni', String(c.collaterals.length)),
            ],
          },
        },
        ...collateralBlocks,
        {
          table: {
            widths: [180, '*'],
            body: [row('Jami garov qiymati', fmtMoney(value)), row('Prописью', words)],
          },
          margin: [0, 12, 0, 0],
        },
        {
          text: '\n\nImzolar: __________________ (Direktor)        __________________ (Administrator)',
          margin: [0, 30, 0, 0],
        },
        { text: `Sana: ${new Date().toLocaleDateString('ru-RU')}`, margin: [0, 10, 0, 0] },
      ],
      styles: { h1: { fontSize: 16, bold: true, margin: [0, 0, 0, 8] } },
    };

    const pdfDoc = this.printer.createPdfKitDocument(def);
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      pdfDoc.on('data', (d: Buffer) => chunks.push(d));
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
      pdfDoc.on('error', reject);
      pdfDoc.end();
    });
  }
}
