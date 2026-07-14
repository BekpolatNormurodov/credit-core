import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { dateToUzbekWords } from '../../../common/sum-to-words.util';
import { CaseDocData } from '../case-document.loader';
import { money, orgHeader } from '../doc-layout';
import { amountWords, collateralDetails, notaryBlock, p } from './_shared';

/**
 * Акт согласования — the collateral valuation-agreement act. Faithful transcription (Uzbek Cyrillic)
 * with placeholders merged: parties, contract number, collateral details and total agreed value.
 *
 * @param notary When true, appends a notarial-attestation block (party ID + fill-in lines for the
 * notary/registry/seal) as the last content item. Defaults to false so existing callers are unaffected.
 */
export function actTemplate(c: CaseDocData, notary = false): TDocumentDefinitions {
  const line = c.creditLine;
  const b = c.borrower;
  const name = b?.fullName ?? '—';
  const contractNo = c.contractNumber ?? c.number;
  const dateStr = line?.lineDate ? dateToUzbekWords(line.lineDate) : '—';
  const total = c.collaterals.reduce((s, x) => s + Number(x.agreedValue ?? 0), 0);
  const totalStr = amountWords(total);

  return {
    defaultStyle: { font: 'Roboto', fontSize: 10 },
    pageMargins: [45, 50, 45, 50],
    content: [
      orgHeader(c.organization),
      { text: `ГАРОВ ПРЕДМЕТИНИНГ ҚИЙМАТИНИ КЕЛИШИШ ДАЛОЛАТНОМАСИ № ${contractNo}`, bold: true, alignment: 'center', fontSize: 12 },
      { text: `Тошкент ш. · ${dateStr}`, alignment: 'center', margin: [0, 2, 0, 10] },
      p(`Ушбу далолатнома «${c.organization?.nameMixed ?? 'ММТ'}» (1 тараф) ижрочи директори ${c.organization?.directorFull ?? '—'} ва «Қарз олувчи»/«Гаровга қўювчи» (2 тараф) Ўзбекистон Республикаси фуқароси ${name} иштирокида, ${dateStr} йилдаги № ${contractNo} сонли микромолиялаш линияси очиш тўғрисидаги Бош келишув юзасидан тузилди.`),
      p(`Микромолия линияси гаров таъминоти сифатида ${name}га тегишли қуйидаги мулк тақдим этилади:`),
      ...collateralDetails(c),
      ...c.collaterals.map((col) => p(`${col.type === 'AUTO' ? 'Автотранспорт' : 'Уй-жой'} гаровининг келишилган қиймати: ${money(col.agreedValue)}.`)),
      p(`Тарафлар келишувига кўра юқоридаги мулк «${c.organization?.nameMixed ?? 'ММТ'}» томонидан Қарз олувчи ва Гаровга қўювчи розилиги асосида ${totalStr} сўм баҳоланди.`),
      p(`Гаров предметининг келишилган гаров қиймати ${totalStr} сўмни ташкил қилади.`),
      { columns: [
        { width: '*', stack: [
          { text: '1 - тарафдан:', bold: true },
          { text: c.organization?.nameMixed ?? '—' },
          { text: 'Ижрочи директори' },
          { text: '\n___________ ' + (c.organization?.directorShort ?? '') },
        ] },
        { width: '*', stack: [
          { text: '2 - тарафдан:', bold: true },
          { text: 'Ўзбекистон Республикаси фуқароси' },
          { text: name },
          { text: '\n___________ ' + name },
        ] },
      ], columnGap: 16, margin: [0, 16, 0, 0] },
      ...(notary ? [notaryBlock(c)] : []),
    ],
  };
}
