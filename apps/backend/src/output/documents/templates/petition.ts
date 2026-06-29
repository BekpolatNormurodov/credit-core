import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { dateToUzbekWords, sumToWordsUz } from '../../../common/sum-to-words.util';
import { CaseDocData } from '../case-document.loader';
import { orgHeader, kv, money } from '../doc-layout';

export function petitionTemplate(c: CaseDocData): TDocumentDefinitions {
  const line = c.creditLine;
  const amount = Number(line?.amountTotal ?? c.amount ?? 0);
  return {
    defaultStyle: { font: 'Roboto', fontSize: 10 },
    pageMargins: [40, 50, 40, 50],
    content: [
      orgHeader(c.organization),
      { text: `${c.organization?.directorFull ?? 'Ijrochi direktor'}ga`, alignment: 'right', margin: [0, 0, 0, 12] },
      { text: "MIKROMOLIYA LINIYASINI OCHISH TO'G'RISIDA MUROJAATNOMA", style: 'h1', alignment: 'center', margin: [0, 0, 0, 14] },
      { text: `Qarz oluvchi ${c.borrower?.fullName ?? '—'} uchun quyidagi shartlarda mikromoliya liniyasini ochishni so'rayman:`, margin: [0, 0, 0, 8] },
      { table: { widths: [180, '*'], body: [
        kv('Liniya raqami', line?.lineNumber ?? '—'),
        kv('Summa', money(amount)),
        kv("Summa (so'z bilan)", amount ? sumToWordsUz(amount) : '—'),
        kv('Muddati', line?.termMonths != null ? `${line.termMonths} oy` : '—'),
        kv('Filial', c.branch ? `${c.branch.name} (${c.branch.symbol})` : '—'),
      ] } },
      { text: line?.lineDate ? `Sana: ${dateToUzbekWords(line.lineDate)}` : '', margin: [0, 24, 0, 0] },
      { text: '\nKredit menejeri: _______________', margin: [0, 12, 0, 0] },
    ],
    styles: { h1: { fontSize: 13, bold: true } },
  };
}
