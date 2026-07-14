import type { TDocumentDefinitions, TableCell } from 'pdfmake/interfaces';
import { dateToUzbekWords } from '../../../common/sum-to-words.util';
import { CaseDocData } from '../case-document.loader';
import { orgHeader, docTitle, kv, kvTable, money, gridTable } from '../doc-layout';

const HEADER_ROW: TableCell[] = [
  { text: '№', bold: true, alignment: 'center' },
  { text: 'Тўлов санаси', bold: true },
  { text: 'Бошланғич қолдиқ', bold: true, alignment: 'right' },
  { text: 'Асосий қарз', bold: true, alignment: 'right' },
  { text: 'Фоиз', bold: true, alignment: 'right' },
  { text: 'Жами', bold: true, alignment: 'right' },
  { text: 'Кунлар', bold: true, alignment: 'center' },
];

/**
 * Тўлов жадвали (график) — the amortization/payment schedule for a tranche, one row per
 * installment plus a totals row. Null-safe: when no schedule has been generated for the tranche,
 * renders a guard paragraph instead of crashing or showing NaN.
 */
export function grafikTemplate(c: CaseDocData): TDocumentDefinitions {
  const contractNo = c.contractNumber ?? c.number ?? '—';
  const sched = c.creditLine?.tranches?.[0]?.schedule ?? null;

  const header = [orgHeader(c.organization), docTitle('ТЎЛОВ ЖАДВАЛИ (ГРАФИК)', `Иш № ${contractNo}`)];

  if (!sched || !sched.installments?.length) {
    return {
      defaultStyle: { font: 'Roboto', fontSize: 10 },
      pageMargins: [45, 50, 45, 50],
      content: [...header, { text: 'Тўлов жадвали ҳисобланмаган.', bold: true, margin: [0, 12, 0, 0] }],
    };
  }

  const installments = [...sched.installments].sort((a, b) => a.seq - b.seq);

  const rows: TableCell[][] = installments.map((i) => [
    { text: String(i.seq), alignment: 'center' },
    { text: dateToUzbekWords(i.dueDate) },
    { text: money(i.openingBalance), alignment: 'right' },
    { text: money(i.principal), alignment: 'right' },
    { text: money(i.interest), alignment: 'right' },
    { text: money(i.total), alignment: 'right' },
    { text: String(i.days), alignment: 'center' },
  ]);

  const totalPrincipal = installments.reduce((sum, i) => sum + Number(i.principal ?? 0), 0);
  const totalInterest = installments.reduce((sum, i) => sum + Number(i.interest ?? 0), 0);
  const totalAmount = installments.reduce((sum, i) => sum + Number(i.total ?? 0), 0);

  const totalsRow: TableCell[] = [
    { text: '', border: [true, true, true, true] },
    { text: 'ЖАМИ', bold: true },
    { text: '' },
    { text: money(totalPrincipal), bold: true, alignment: 'right' },
    { text: money(totalInterest), bold: true, alignment: 'right' },
    { text: money(totalAmount), bold: true, alignment: 'right' },
    { text: '' },
  ];

  return {
    defaultStyle: { font: 'Roboto', fontSize: 10 },
    pageMargins: [45, 50, 45, 50],
    content: [
      ...header,
      kvTable([
        kv('Асосий сумма', money(sched.principal)),
        kv('Муддат', `${sched.termMonths} ой`),
        kv('Йиллик фоиз', `${Math.round(Number(sched.annualRate) * 100)}%`),
        kv('Бериш санаси', dateToUzbekWords(sched.disbursementDate)),
        kv('Усул', sched.method === 'DIFFERENTIATED' ? 'Дифференциал' : 'Аннуитет'),
      ]),
      {
        table: {
          headerRows: 1,
          widths: [22, 80, '*', '*', '*', '*', 40],
          body: [HEADER_ROW, ...rows, totalsRow],
        },
        layout: gridTable,
        margin: [0, 8, 0, 4],
      },
    ],
  };
}
