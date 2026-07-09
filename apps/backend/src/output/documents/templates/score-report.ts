import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { dateToUzbekWords } from '../../../common/sum-to-words.util';
import { CaseDocData } from '../case-document.loader';
import { orgHeader, kv, money } from '../doc-layout';

const VERDICT_LABEL: Record<string, string> = {
  APPROVED: 'Ma’qullandi',
  REVIEW: 'Kredit qo‘mitasi qaroriga havola',
  REJECTED: 'Rad etildi',
};

/** Score отчет — the underwriting scoring summary for the case. */
export function scoreReportTemplate(c: CaseDocData): TDocumentDefinitions {
  const line = c.creditLine;
  const b = c.borrower;
  const s = c.scoring;
  const amount = Number(line?.amountTotal ?? c.amount ?? 0);
  const ratePct = line?.interestRate != null ? Math.round(Number(line.interestRate) * 100) : 55;
  const OK = 'Talablarga mos keladi';

  return {
    defaultStyle: { font: 'Roboto', fontSize: 10 },
    pageMargins: [40, 50, 40, 50],
    content: [
      orgHeader(c.organization),
      { text: 'SKORING TAHLIL NATIJALARI', style: 'h1', alignment: 'center', margin: [0, 0, 0, 4] },
      { text: dateToUzbekWords(s?.computedAt ?? new Date()), alignment: 'center', margin: [0, 0, 0, 12] },
      { table: { widths: [200, '*'], body: [
        kv('Mijoz F.I.SH.', b?.fullName ?? '—'),
        kv('Manzil', b?.regAddress ?? b?.address ?? '—'),
        kv('Kredit turi', 'Mikromoliya liniya'),
        kv('Liniya limiti', money(amount)),
        kv('Muddati', line?.termMonths != null ? `${line.termMonths} oy` : '—'),
        kv('Foiz stavkasi', `${ratePct}%`),
      ] } },
      { text: 'Skoring natijasi:', bold: true, margin: [0, 12, 0, 6] },
      { table: { widths: [220, '*'], body: [
        kv('Umumiy shartlar (summa, muddat, foiz)', OK),
        kv('Garovga qo‘yilgan talablar', OK),
        kv('Daromadlarning yetarliligi', OK),
        kv('Muammoli kreditlar', OK),
        kv('Joriy majburiyatlari', OK),
        kv('Yoshga muvofiqligi', s?.age != null ? `${s.age} yosh — ${OK}` : OK),
        kv('Skoring ball', s ? `${s.totalScore} / ${s.maxScore}` : '—'),
      ] } },
      { text: `XULOSA: ${s ? (VERDICT_LABEL[String(s.verdict)] ?? String(s.verdict)) : '—'}`, bold: true, margin: [0, 12, 0, 0] },
      { text: '\nKredit menejeri imzosi ______________', margin: [0, 16, 0, 0] },
    ],
    styles: { h1: { fontSize: 13, bold: true } },
  };
}
