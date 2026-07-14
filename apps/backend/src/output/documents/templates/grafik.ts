import type { TDocumentDefinitions, TableCell } from 'pdfmake/interfaces';
import { CaseDocData } from '../case-document.loader';
import {
  orgHeader, docTitle, gridTable, plainMoney, shortDate, partyRequisites,
  DOC_DEFAULT_STYLE, DOC_PAGE_MARGINS,
} from '../doc-layout';
import { scheduleForCase, type DocInstallment } from '../schedule';

// Compact schedule table matching the Excel: №, payment date (dd.mm.yyyy), opening balance,
// principal, interest*, total* — no "Кунлар" column, plain numbers (no "so'm" suffix).
const HEADER_TOP: TableCell[] = [
  { text: '№', bold: true, alignment: 'center', rowSpan: 2 },
  { text: 'Тўлов санаси', bold: true, alignment: 'center', rowSpan: 2 },
  { text: 'Асосий қарз қолдиғи', bold: true, alignment: 'center', rowSpan: 2 },
  { text: 'Тўлов суммаси, сўм', bold: true, alignment: 'center', colSpan: 3 },
  {},
  {},
];
const HEADER_SUB: TableCell[] = [
  {}, {}, {},
  { text: 'асосий қарз', bold: true, alignment: 'center' },
  { text: 'фоизлар*', bold: true, alignment: 'center' },
  { text: 'Жами*', bold: true, alignment: 'center' },
];

/**
 * Тўлов жадвали (график) — the compact amortization schedule for a tranche, matching the Excel:
 * a totals (ИТОГО) row, the 2.4-band footnote, and the two-party requisites + signature block.
 * The schedule is computed on demand (scheduleForCase); a guard paragraph shows when inputs are
 * insufficient.
 */
export function grafikTemplate(c: CaseDocData): TDocumentDefinitions {
  const contractNo = c.contractNumber ?? c.number ?? '—';
  const sched = scheduleForCase(c);

  const header = [orgHeader(c.organization), docTitle('ТЎЛОВ ЖАДВАЛИ', `Иш № ${contractNo}`)];

  if (!sched || !sched.installments.length) {
    return {
      defaultStyle: DOC_DEFAULT_STYLE,
      pageMargins: DOC_PAGE_MARGINS,
      content: [...header, { text: 'Тўлов жадвали ҳисобланмаган.', bold: true, margin: [0, 12, 0, 0] }],
    };
  }

  const rows: TableCell[][] = sched.installments.map((i) => [
    { text: String(i.seq), alignment: 'center' },
    { text: shortDate(i.dueDate), alignment: 'center' },
    { text: plainMoney(i.openingBalance), alignment: 'right' },
    { text: plainMoney(i.principal), alignment: 'right' },
    { text: plainMoney(i.interest), alignment: 'right' },
    { text: plainMoney(i.total), alignment: 'right' },
  ]);

  const sum = (f: (n: DocInstallment) => number) =>
    sched.installments.reduce((s, i) => s + f(i), 0);
  const totalsRow: TableCell[] = [
    { text: 'ИТОГО', bold: true, colSpan: 3, alignment: 'center' },
    {},
    {},
    { text: plainMoney(sum((i) => i.principal)), bold: true, alignment: 'right' },
    { text: plainMoney(sum((i) => i.interest)), bold: true, alignment: 'right' },
    { text: plainMoney(sum((i) => i.total)), bold: true, alignment: 'right' },
  ];

  return {
    defaultStyle: DOC_DEFAULT_STYLE,
    pageMargins: DOC_PAGE_MARGINS,
    content: [
      ...header,
      {
        fontSize: 8.5,
        table: {
          headerRows: 2,
          widths: [18, 58, '*', '*', '*', '*'],
          body: [HEADER_TOP, HEADER_SUB, ...rows, totalsRow],
        },
        layout: gridTable,
        margin: [0, 4, 0, 6],
      },
      {
        text:
          '*Асосий қарзни тўлаш кечиктирилган тақдирда, фоизлар бўйича тўлов миқдори ўзгаради, чунки ' +
          'фоизлар мазкур шартноманинг 2.4. бандига мувофиқ асосий қарзнинг ҳақиқий қолдиғига ҳисобланади.',
        fontSize: 8,
        italics: true,
        margin: [0, 2, 0, 0],
      },
      partyRequisites(c),
    ],
  };
}
