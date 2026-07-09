import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { dateToUzbekWords } from '../../../common/sum-to-words.util';
import { CaseDocData } from '../case-document.loader';
import { orgHeader } from '../doc-layout';
import { lineTerms, collateralDetails } from './_shared';

/**
 * Приказ на сделку (buyruq) — the executive director's order allocating the microfinance line.
 * Faithful transcription (Uzbek Cyrillic) with placeholders merged: contract number, director,
 * client, line terms, collateral details.
 */
export function prikazTemplate(c: CaseDocData): TDocumentDefinitions {
  const line = c.creditLine;
  const b = c.borrower;
  const director = c.organization?.directorFull ?? 'Ижрочи директор';
  const contractNo = c.contractNumber ?? c.number;
  const dateStr = line?.lineDate ? dateToUzbekWords(line.lineDate) : dateToUzbekWords(new Date());

  return {
    defaultStyle: { font: 'Roboto', fontSize: 10 },
    pageMargins: [45, 50, 45, 50],
    content: [
      orgHeader(c.organization),
      { text: `«${c.organization?.nameUpper ?? 'ММТ'}»`, alignment: 'center', bold: true },
      { text: 'Ижрочи директорининг', alignment: 'center', margin: [0, 2, 0, 2] },
      { text: `${dateStr} йилдаги №${contractNo} БУЙРУҒИ`, alignment: 'center', bold: true, fontSize: 12, margin: [0, 0, 0, 12] },
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
