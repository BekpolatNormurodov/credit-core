import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { sumToWordsUz, dateToUzbekWords } from '../../../common/sum-to-words.util';
import { CaseDocData } from '../case-document.loader';
import { orgHeader, kv, money } from '../doc-layout';

/**
 * Протокол — extract from the credit-committee meeting protocol approving the loan.
 * Example template merging the case: committee decision terms (sum, term, rate, schedule, collateral).
 */
export function protokolTemplate(c: CaseDocData): TDocumentDefinitions {
  const line = c.creditLine;
  const b = c.borrower;
  const amount = Number(line?.amountTotal ?? c.amount ?? 0);
  const contractNo = c.contractNumber ?? c.number;
  const dateStr = line?.lineDate ? dateToUzbekWords(line.lineDate) : dateToUzbekWords(new Date());
  const ratePct = line?.interestRate != null ? Math.round(Number(line.interestRate) * 100) : 55;
  const schedule = line?.tranches?.[0]?.scheduleType === 'DIFFERENTIATED' ? 'differensial' : 'annuitet';

  const collateralRows = c.collaterals.map((col) =>
    col.type === 'AUTO'
      ? kv(col.model ?? 'Avtotransport', `${col.stateNumber ?? '—'} · ${money(col.agreedValue)}`)
      : kv('Ko‘chmas mulk', `${col.address ?? '—'} · kadastr ${col.cadastreNo ?? '—'} · ${money(col.agreedValue)}`),
  );

  return {
    defaultStyle: { font: 'Roboto', fontSize: 10 },
    pageMargins: [40, 50, 40, 50],
    content: [
      orgHeader(c.organization),
      { text: `«${c.organization?.nameUpper ?? 'MMT'}» Kredit qo‘mitasi yig‘ilishi`, alignment: 'center', bold: true },
      { text: `${contractNo} protokolidan ko‘chirma`, alignment: 'center', margin: [0, 2, 0, 2] },
      { text: `Toshkent shahri · ${dateStr}`, alignment: 'center', margin: [0, 0, 0, 12] },
      { text: 'KUN TARTIBI:', bold: true },
      { text: `${b?.fullName ?? '—'}ga mikroqarz/mikrokredit berish masalasini ko‘rib chiqish to‘g‘risida.`, margin: [0, 0, 0, 10] },
      { text: 'QAROR QILADI:', bold: true },
      { text: `${b?.fullName ?? '—'}ga quyidagi shartlarda mikroqarz berish ma’qullansin:`, margin: [0, 0, 0, 6] },
      { table: { widths: [200, '*'], body: [
        kv('1. Mikroqarz summasi', `${money(amount)} (${amount ? sumToWordsUz(amount) : '—'})`),
        kv('2. Muddati', line?.termMonths != null ? `${line.termMonths} oy` : '—'),
        kv('3. Yillik foiz stavkasi', `${ratePct}%`),
        kv('4. To‘lov turi', `har oy ${schedule} to‘lovlari`),
      ] } },
      { text: '5. Garov ta’minoti:', bold: true, margin: [0, 12, 0, 6] },
      { table: { widths: [200, '*'], body: collateralRows.length ? collateralRows : [kv('Garov', '—')] } },
      { text: `Garov egasi: ${c.collaterals[0]?.owners?.[0]?.fullName ?? b?.fullName ?? '—'}`, margin: [0, 8, 0, 0] },
      { text: '\nKredit qo‘mitasi raisi ______________', margin: [0, 16, 0, 0] },
    ],
  };
}
