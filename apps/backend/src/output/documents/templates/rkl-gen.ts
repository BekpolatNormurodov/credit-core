import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { sumToWordsUz, dateToUzbekWords } from '../../../common/sum-to-words.util';
import { CaseDocData } from '../case-document.loader';
import { orgHeader, kv, money } from '../doc-layout';

/**
 * РКЛ Ген — Bosh kelishuv (the master microfinance-line agreement between the org and the client).
 * Example template: parties + line terms + collateral + key obligations + signatures, merged from the
 * case. Full legal clauses to be refined verbatim later.
 */
export function rklGenTemplate(c: CaseDocData): TDocumentDefinitions {
  const line = c.creditLine;
  const b = c.borrower;
  const amount = Number(line?.amountTotal ?? c.amount ?? 0);
  const contractNo = c.contractNumber ?? c.number;
  const dateStr = line?.lineDate ? dateToUzbekWords(line.lineDate) : dateToUzbekWords(new Date());
  const ratePct = line?.interestRate != null ? Math.round(Number(line.interestRate) * 100) : 55;
  const org = c.organization;

  const collateralRows = c.collaterals.map((col) =>
    col.type === 'AUTO'
      ? kv(col.model ?? 'Avtotransport', `${col.stateNumber ?? '—'} · texpasport ${col.techPassportNo ?? '—'} · ${money(col.agreedValue)}`)
      : kv('Ko‘chmas mulk', `${col.address ?? '—'} · kadastr ${col.cadastreNo ?? '—'} · ${money(col.agreedValue)}`),
  );

  return {
    defaultStyle: { font: 'Roboto', fontSize: 10 },
    pageMargins: [40, 50, 40, 50],
    content: [
      orgHeader(org),
      { text: 'MIKROMOLIYA LINIYASINI OCHISH TO‘G‘RISIDA BOSH KELISHUV', style: 'h1', alignment: 'center' },
      { text: `№ ${contractNo}`, alignment: 'center', margin: [0, 0, 0, 2] },
      { text: `Toshkent sh., ${dateStr}`, alignment: 'center', margin: [0, 0, 0, 12] },
      { text: [
        `«${org?.nameMixed ?? 'MMT'}» (bundan buyon — "MMT") va `, { text: b?.fullName ?? '—', bold: true },
        ` (bundan buyon — "Qarz oluvchi") o‘rtasida quyidagi shartlarda ushbu Bosh kelishuv tuzildi:`,
      ], margin: [0, 0, 0, 10] },
      { text: '1. KELISHUV PREDMETI', style: 'h2' },
      { table: { widths: [200, '*'], body: [
        kv('Liniya limit summasi', `${money(amount)} (${amount ? sumToWordsUz(amount) : '—'})`),
        kv('Liniya muddati', line?.termMonths != null ? `${line.termMonths} oy` : '—'),
        kv('Yillik foiz stavkasi', `${ratePct}%`),
        kv('Jarima foizi', line?.penaltyRate != null ? `${Math.round(Number(line.penaltyRate) * 100)}%` : '—'),
      ] } },
      { text: '2. TA’MINOT (GAROV)', style: 'h2' },
      { table: { widths: [200, '*'], body: collateralRows.length ? collateralRows : [kv('Garov', '—')] } },
      { text: '3. ASOSIY SHARTLAR', style: 'h2' },
      { ul: [
        'Bosh kelishuv doirasida ajratiladigan har bir mikroqarz/mikrokredit alohida shartnoma bilan rasmiylashtiriladi.',
        'Mikroqarz/mikrokredit shakli: naqd yoki pul o‘tkazish yo‘li bilan (Mijoz ixtiyoriga ko‘ra).',
        'Bosh kelishuvga ilova qilingan hujjatlar uning ajralmas qismi hisoblanadi.',
      ], margin: [0, 0, 0, 8] },
      { text: '4. TOMONLAR REKVIZITLARI', style: 'h2' },
      { columns: [
        { width: '*', stack: [{ text: 'MMT:', bold: true }, { text: org?.nameMixed ?? '—' }, { text: `h/r ${org?.bankAccount ?? '—'}` }, { text: `MFO ${org?.bankMfo ?? '—'}` }, { text: '\n\n_______________ (imzo)' }] },
        { width: '*', stack: [{ text: 'Qarz oluvchi:', bold: true }, { text: b?.fullName ?? '—' }, { text: `Pasport: ${[b?.passportSeries, b?.passportNumber].filter(Boolean).join(' ') || '—'}` }, { text: `JSHSHIR: ${b?.pinfl ?? '—'}` }, { text: '\n\n_______________ (imzo)' }] },
      ], margin: [0, 6, 0, 0] },
    ],
    styles: { h1: { fontSize: 14, bold: true, margin: [0, 0, 0, 6] }, h2: { fontSize: 12, bold: true, margin: [0, 12, 0, 6] } },
  };
}
