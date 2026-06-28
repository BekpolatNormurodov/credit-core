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

  /** Build the "Garov baholash akti" (valuation act) PDF for a case. */
  async valuationAct(c: CreditCaseDto): Promise<Buffer> {
    const re = c.realEstate;
    const value = c.realEstate?.agreedValue ?? c.amount ?? null;
    const words = re?.agreedValueWords ?? (value != null ? sumToWordsUz(value) : '—');

    const row = (label: string, val: string) => [
      { text: label, bold: true, margin: [0, 2, 0, 2] as [number, number, number, number] },
      { text: val || '—', margin: [0, 2, 0, 2] as [number, number, number, number] },
    ];

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
              row('Mahsulot', 'Uy-joy (ko‘chmas mulk)'),
              row('Manzil', re?.address ?? '—'),
              row('Reestr №', re?.registryNo ?? '—'),
              row('Kadastr №', re?.cadastreNo ?? '—'),
              row('Mulk turi', re?.propertyType ?? '—'),
              row('Umumiy maydon', re?.totalAreaM2 != null ? `${re.totalAreaM2} m²` : '—'),
              row('Yashash maydoni', re?.livingAreaM2 != null ? `${re.livingAreaM2} m²` : '—'),
              row('Xonalar', [re?.roomNames, re?.roomCount != null ? `(${re.roomCount} ta)` : ''].filter(Boolean).join(' ')),
              row('Kredit summasi', fmtMoney(c.amount)),
              row('Muddat', c.termMonths != null ? `${c.termMonths} oy` : '—'),
              row('KATM narxi', fmtMoney(c.katmPrice)),
              row('Kelishilgan garov qiymati', fmtMoney(value)),
              row('Prописью', words),
            ],
          },
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
