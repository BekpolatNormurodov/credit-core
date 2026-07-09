import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { sumToWordsUz, dateToUzbekWords } from '../../../common/sum-to-words.util';
import { CaseDocData } from '../case-document.loader';
import { orgHeader, kv, money } from '../doc-layout';

export function contractTemplate(c: CaseDocData): TDocumentDefinitions {
  const line = c.creditLine;
  const tr = line?.tranches?.[0];
  const b = c.borrower;
  const amount = Number(tr?.principal ?? line?.amountTotal ?? c.amount ?? 0);
  const totalCollateral = c.collaterals.reduce((s, x) => s + Number(x.agreedValue ?? 0), 0);
  return {
    defaultStyle: { font: 'Roboto', fontSize: 10 },
    pageMargins: [40, 50, 40, 50],
    content: [
      orgHeader(c.organization),
      { text: 'MIKROQARZ SHARTNOMASI', style: 'h1', alignment: 'center' },
      { text: `${c.contractNumber ?? line?.lineNumber ?? c.number}`, alignment: 'center', margin: [0, 0, 0, 4] },
      { text: line?.lineDate ? `Toshkent sh., ${dateToUzbekWords(line.lineDate)}` : '', alignment: 'center', margin: [0, 0, 0, 14] },
      { text: [c.organization?.nameMixed, ' (bundan keyin — "MMT") va ', b?.fullName, ' (bundan keyin — "Qarz oluvchi") quyidagilar haqida ushbu shartnomani tuzdilar:'].join(''), margin: [0, 0, 0, 10] },
      { text: '1. SHARTNOMA PREDMETI', style: 'h2' },
      { table: { widths: [180, '*'], body: [
        kv('Mikroqarz summasi', money(amount)),
        kv("Summa (so'z bilan)", amount ? sumToWordsUz(amount) : '—'),
        kv('Muddati', tr?.termMonths != null ? `${tr.termMonths} oy` : (line?.termMonths != null ? `${line.termMonths} oy` : '—')),
        kv('Yillik foiz stavkasi', line?.interestRate != null ? `${Number(line.interestRate) * 100}%` : '—'),
        kv("Muddati o'tgan uchun", line?.penaltyRate != null ? `${Number(line.penaltyRate) * 100}%` : '—'),
        kv("To'lov turi", tr?.scheduleType === 'DIFFERENTIATED' ? 'differensial' : 'annuitet'),
      ] } },
      { text: "2. TA'MINOT (GAROV)", style: 'h2' },
      { table: { widths: [180, '*'], body: [
        ...c.collaterals.flatMap((col) => [
          kv(col.type === 'AUTO' ? 'Avtotransport' : "Ko'chmas mulk", col.type === 'AUTO' ? (col.model ?? '—') : (col.address ?? '—')),
          kv('Kelishilgan qiymati', money(col.agreedValue)),
        ]),
        kv('Kelishilgan garov qiymati (jami)', money(totalCollateral)),
        kv("So'z bilan", totalCollateral ? sumToWordsUz(totalCollateral) : '—'),
      ] } },
      { text: '3. TOMONLAR REKVIZITLARI', style: 'h2' },
      { columns: [
        { width: '*', stack: [{ text: 'MMT:', bold: true }, { text: c.organization?.nameMixed ?? '—' }, { text: `h/r ${c.organization?.bankAccount ?? '—'}` }, { text: `MFO ${c.organization?.bankMfo ?? '—'}` }, { text: '\n\n_______________ (imzo)' }] },
        { width: '*', stack: [{ text: 'Qarz oluvchi:', bold: true }, { text: b?.fullName ?? '—' }, { text: `Pasport: ${[b?.passportSeries, b?.passportNumber].filter(Boolean).join(' ') || '—'}` }, { text: `JSHSHIR: ${b?.pinfl ?? '—'}` }, { text: '\n\n_______________ (imzo)' }] },
      ], margin: [0, 6, 0, 0] },
    ],
    styles: { h1: { fontSize: 15, bold: true, margin: [0, 0, 0, 6] }, h2: { fontSize: 12, bold: true, margin: [0, 12, 0, 6] } },
  };
}
