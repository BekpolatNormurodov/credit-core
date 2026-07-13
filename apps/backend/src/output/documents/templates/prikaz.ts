import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { dateToUzbekWords } from '../../../common/sum-to-words.util';
import { CaseDocData } from '../case-document.loader';
import { orgHeader } from '../doc-layout';
import { lineTerms, collateralDetails } from './_shared';

/** Latin month word (as produced by `dateToUzbekWords`) → its Uzbek Cyrillic equivalent. */
const LAT_TO_CYR_MONTH: Record<string, string> = {
  yanvar: 'январ', fevral: 'феврал', mart: 'март', aprel: 'апрель', may: 'май',
  iyun: 'июнь', iyul: 'июль', avgust: 'август', sentabr: 'сентябр',
  oktabr: 'октябр', noyabr: 'ноябр', dekabr: 'декабр',
};

/**
 * Cyrillic "<day> <month> <year> йилдаги" phrase for the order header — reuses
 * `dateToUzbekWords` for the day/month/year, then transliterates its Latin month word to
 * Cyrillic and appends a single "йил" morpheme (never both the Latin "yil" from
 * `dateToUzbekWords` AND a Cyrillic "йил" suffix).
 */
function issueDateCyr(d: Date): string {
  const [day, month, year] = dateToUzbekWords(d).split(' ');
  return `${day} ${LAT_TO_CYR_MONTH[month] ?? month} ${year} йилдаги`;
}

/**
 * Приказ на сделку (buyruq) — the executive director's order allocating the microfinance line.
 * Faithful transcription (Uzbek Cyrillic) with placeholders merged: contract number, director,
 * client, line terms, collateral details.
 */
export function prikazTemplate(c: CaseDocData): TDocumentDefinitions {
  const line = c.creditLine;
  const b = c.borrower;
  const director = c.organization?.directorFull ?? 'Ижрочи директор';
  const contractNo = c.creditLine?.orderNumber ?? c.creditLine?.lineNumber ?? c.contractNumber ?? c.number;
  const dateStr = line?.lineDate ? issueDateCyr(line.lineDate) : '—';

  return {
    defaultStyle: { font: 'Roboto', fontSize: 10 },
    pageMargins: [45, 50, 45, 50],
    content: [
      orgHeader(c.organization),
      { text: `«${c.organization?.nameUpper ?? 'ММТ'}»`, alignment: 'center', bold: true },
      { text: 'Ижрочи директорининг', alignment: 'center', margin: [0, 2, 0, 2] },
      { text: `${dateStr} №${contractNo} БУЙРУҒИ`, alignment: 'center', bold: true, fontSize: 12, margin: [0, 0, 0, 12] },
      { text: `Мен, ${director}, «${c.organization?.nameMixed ?? 'ММТ'}» ижрочи директори, фуқаро ${b?.fullName ?? '—'}га қуйидаги шартларда микроқарз/микрокредит ажратилишини буюраман:`, alignment: 'justify', margin: [0, 0, 0, 8] },
      ...lineTerms(c),
      { text: '5. Микромолия линияси таъминоти:', margin: [0, 3, 0, 3] },
      ...collateralDetails(c),
      { columns: [
        { width: '*', stack: [{ text: `«${c.organization?.nameMixed ?? 'ММТ'}»` }, { text: 'Ижрочи директори' }] },
        { width: 'auto', alignment: 'right', stack: [{ text: '\n' }, { text: director, bold: true }, { text: '_______________' }] },
      ], margin: [0, 24, 0, 0] },
    ],
  };
}
