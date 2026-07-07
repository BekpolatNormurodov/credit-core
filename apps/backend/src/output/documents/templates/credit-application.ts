import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { dateToUzbekWords } from '../../../common/sum-to-words.util';
import { CaseDocData } from '../case-document.loader';
import { orgHeader, kv, money } from '../doc-layout';

export function creditApplicationTemplate(c: CaseDocData): TDocumentDefinitions {
  const line = c.creditLine;
  const tr = line?.tranches?.[0];
  const b = c.borrower;
  const phones = Array.isArray(b?.phones) ? (b!.phones as Array<{ number?: string }>) : [];
  return {
    defaultStyle: { font: 'Roboto', fontSize: 10 },
    pageMargins: [40, 50, 40, 50],
    content: [
      orgHeader(c.organization),
      { text: 'KREDIT ARIZASI', style: 'h1', alignment: 'center', margin: [0, 0, 0, 14] },
      { table: { widths: [180, '*'], body: [
        kv('F.I.SH.', b?.fullName ?? '—'),
        kv('Pasport', [b?.passportSeries, b?.passportNumber].filter(Boolean).join(' ') || '—'),
        kv('JSHSHIR', b?.pinfl ?? '—'),
        kv('Manzil', b?.regAddress ?? b?.address ?? '—'),
        kv('Telefon', phones.length ? String(phones[0]?.number ?? '—') : '—'),
        kv("So'ralayotgan summa", money(tr?.principal ?? line?.amountTotal)),
        kv('Muddati', tr?.termMonths != null ? `${tr.termMonths} oy` : '—'),
        kv('Ariza raqami', tr?.applicationNo ?? '—'),
        kv('Ariza sanasi', tr?.applicationDate ? dateToUzbekWords(tr.applicationDate) : '—'),
        kv("To'lov kuni", tr?.paymentDay != null ? `Har oyning ${tr.paymentDay}-kuni` : '—'),
      ] } },
      { text: "Men yuqoridagi ma'lumotlarning to'g'riligini tasdiqlayman.", margin: [0, 16, 0, 0] },
      { text: '\nImzo: _______________', margin: [0, 12, 0, 0] },
    ],
    styles: { h1: { fontSize: 14, bold: true } },
  };
}
