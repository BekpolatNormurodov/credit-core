import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { sumToWordsUz, dateToUzbekWords } from '../../../common/sum-to-words.util';
import { CaseDocData } from '../case-document.loader';
import { orgHeader, kv, money } from '../doc-layout';

/**
 * Приказ на сделку (buyruq) — the executive director's order opening the line for the client.
 * Example template: header + line terms + collateral table, merged from the case. Legal boilerplate
 * kept concise; refine verbatim later.
 */
export function prikazTemplate(c: CaseDocData): TDocumentDefinitions {
  const line = c.creditLine;
  const b = c.borrower;
  const amount = Number(line?.amountTotal ?? c.amount ?? 0);
  const director = c.organization?.directorFull ?? 'Ijrochi direktor';
  const contractNo = c.contractNumber ?? c.number;
  const dateStr = line?.lineDate ? dateToUzbekWords(line.lineDate) : dateToUzbekWords(new Date());
  const ratePct = line?.interestRate != null ? Math.round(Number(line.interestRate) * 100) : 55;

  const collateralRows = c.collaterals.flatMap((col) => {
    if (col.type === 'AUTO') {
      return [
        kv('Mulk nomi', col.model ?? '—'),
        kv('Kuzov turi va №', [col.bodyType, col.bodyNo].filter(Boolean).join(', ') || '—'),
        kv('Dvigatel / shassi №', [col.engineNo, col.chassis].filter(Boolean).join(' / ') || '—'),
        kv('Yili va rangi', [col.year, col.color].filter(Boolean).join(', ') || '—'),
        kv('Davlat raqami', col.stateNumber ?? '—'),
        kv('Texnik pasport', [col.techPassportNo, col.techPassportDate].filter(Boolean).join(' — ') || '—'),
        kv('Egasi', col.owners?.[0]?.fullName ?? b?.fullName ?? '—'),
        kv('Kelishilgan qiymat', money(col.agreedValue)),
      ];
    }
    return [
      kv('Ko‘chmas mulk', col.address ?? '—'),
      kv('Tarkibi', [col.roomNames, col.roomCount != null ? `(${col.roomCount} xona)` : ''].filter(Boolean).join(' ') || '—'),
      kv('Yashash / umumiy maydon', `${col.livingAreaM2 ?? '—'} / ${col.totalAreaM2 ?? '—'} m²`),
      kv('Reestr №', col.registryNo ?? '—'),
      kv('Kadastr №', col.cadastreNo ?? '—'),
      kv('Egasi', col.owners?.[0]?.fullName ?? b?.fullName ?? '—'),
      kv('Kelishilgan qiymat', money(col.agreedValue)),
    ];
  });

  return {
    defaultStyle: { font: 'Roboto', fontSize: 10 },
    pageMargins: [40, 50, 40, 50],
    content: [
      orgHeader(c.organization),
      { text: 'Ijrochi direktorining', alignment: 'center', margin: [0, 4, 0, 2] },
      { text: `${dateStr} yildagi №${contractNo} BUYRUG'I`, style: 'h1', alignment: 'center', margin: [0, 0, 0, 12] },
      { text: `Men, ${director}, «${c.organization?.nameMixed ?? 'MMT'}» ijrochi direktori, fuqaro ${b?.fullName ?? '—'} uchun quyidagi shartlarda Mikromoliyaviy liniya (MML) ochishga buyruq beraman:`, margin: [0, 0, 0, 10] },
      { table: { widths: [200, '*'], body: [
        kv('Liniya limit summasi', `${money(amount)} (${amount ? sumToWordsUz(amount) : '—'})`),
        kv('Liniya muddati', line?.termMonths != null ? `${line.termMonths} oy` : '—'),
        kv('Yillik foiz stavkasi', `${ratePct}%`),
      ] } },
      { text: 'Ta’minot (garov):', bold: true, margin: [0, 12, 0, 6] },
      { table: { widths: [200, '*'], body: collateralRows.length ? collateralRows : [kv('Garov', '—')] } },
      { columns: [
        { width: '*', stack: [{ text: `«${c.organization?.nameMixed ?? 'MMT'}»` }, { text: 'Ijrochi direktori' }, { text: '\n\n_______________' }] },
        { width: '*', alignment: 'right', stack: [{ text: director, bold: true }, { text: '\n\n_______________' }] },
      ], margin: [0, 20, 0, 0] },
    ],
    styles: { h1: { fontSize: 13, bold: true } },
  };
}
