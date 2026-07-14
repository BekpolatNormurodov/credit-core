import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { dateToUzbekWords } from '../../../common/sum-to-words.util';
import { CaseDocData } from '../case-document.loader';
import { money, orgHeader } from '../doc-layout';
import { amountWords, collateralDetails, notaryBlock, p } from './_shared';

/**
 * Акт согласования — the collateral valuation-agreement act. Faithful transcription (Uzbek Cyrillic)
 * of the real 3-party form: lender (1 тараф), Қарз олувчи/borrower (2 тараф) and Гаровга қўювчи/pledgor
 * (3 тараф) — the pledgor is the owner of the first listed collateral, and only equals the borrower
 * when they are in fact the same person. Placeholders merged: parties, contract number, collateral
 * details and total agreed value.
 *
 * @param notary When true, appends a notarial-attestation block (party ID + fill-in lines for the
 * notary/registry/seal) as the last content item. Defaults to false so existing callers are unaffected.
 */
export function actTemplate(c: CaseDocData, notary = false): TDocumentDefinitions {
  const org = c.organization;
  const line = c.creditLine;
  const b = c.borrower;
  const borrowerName = b?.fullName ?? '—';
  const pledgorName = c.collaterals?.[0]?.owners?.[0]?.fullName ?? b?.fullName ?? '—';
  const contractNo = c.contractNumber ?? c.number;
  const lineRefNo = line?.orderNumber ?? line?.lineNumber ?? contractNo ?? '—';
  const dateStr = line?.lineDate ? dateToUzbekWords(line.lineDate) : '—';
  const amount = Number(line?.amountTotal ?? c.amount ?? 0);
  const total = c.collaterals.reduce((s, x) => s + Number(x.agreedValue ?? 0), 0);

  return {
    defaultStyle: { font: 'Roboto', fontSize: 10 },
    pageMargins: [45, 50, 45, 50],
    content: [
      orgHeader(c.organization),
      { text: `ГАРОВ ПРЕДМЕТИНИНГ ҚИЙМАТИНИ КЕЛИШИШ ДАЛОЛАТНОМАСИ № ${contractNo}`, bold: true, alignment: 'center', fontSize: 12 },
      { text: `Тошкент ш. · ${dateStr}`, alignment: 'center', margin: [0, 2, 0, 10] },
      p(`Ушбу далолатнома МЧЖ «${org?.nameMixed ?? '—'}» (1 тараф) ижрочи директори ${org?.directorFull ?? '—'}, «Қарз олувчи» (2 тараф) Ўзбекистон Республикаси фуқароси ${borrowerName} ва «Гаровга қўювчи» (3 тараф) Ўзбекистон Республикаси фуқароси ${pledgorName} иштирокида ва хабардорлигида ${lineRefNo} сонли микромолиялаш линияси очиш тўғрисидаги Бош келишувига асосан ${amountWords(amount)} сўм миқдоридаги микроқарз/микрокредит гаров таъминоти сифатида тақдим этилаётган қуйидаги мулкни гаров қийматини аниқлаш учун мазкур далолатномани туздик.`),
      p(`Микромолия линияси гаров таъминоти сифатида ${pledgorName}га тегишли қуйидаги мулк тақдим этилади:`),
      ...collateralDetails(c),
      ...c.collaterals.map((col) => p(`${col.type === 'AUTO' ? 'Автотранспорт' : 'Уй-жой'} гаровининг келишилган қиймати: ${money(col.agreedValue)}.`)),
      p(`Тарафлар келишувига кўра юқоридаги мулк МЧЖ «${org?.nameMixed ?? '—'}» томонидан Гаровга қўювчи розилиги асосида ${amountWords(total)} сўм баҳоланди ва «Қарз олувчи»га ажратилаётган ${lineRefNo} сонли микромолиялаш линияси очиш тўғрисидаги Бош келишувга асосан ${amountWords(amount)} сўм миқдоридаги кредит маблағлари гаров таъминоти сифатида гаровга олиш келишилди.`),
      p('Хусусан, гаров предметининг келишилган гаров қиймати деганда ушбу мол-мулк гаров сифатида тақдим этиладиган/қабул қилинадиган қиймат тушунилади.'),
      p(`Гаров предметининг келишилган гаров қиймати ${amountWords(total)} сўмни ташкил қилади.`),
      { columns: [
        { width: '*', stack: [
          { text: '1 - тарафдан:', bold: true },
          { text: `МЧЖ «${org?.nameMixed ?? '—'}»` },
          { text: 'Ижрочи директори' },
          { text: '\n___________ ' + (org?.directorShort ?? '—') },
        ] },
        { width: '*', stack: [
          { text: '2 - тарафдан:', bold: true },
          { text: 'Ўзбекистон Республикаси фуқароси' },
          { text: borrowerName },
          { text: '\n___________ ' + borrowerName },
        ] },
        { width: '*', stack: [
          { text: '3 - тарафдан:', bold: true },
          { text: 'Ўзбекистон Республикаси фуқароси' },
          { text: pledgorName },
          { text: '\n___________ ' + pledgorName },
        ] },
      ], columnGap: 12, margin: [0, 16, 0, 0] },
      ...(notary ? [notaryBlock(c)] : []),
    ],
  };
}
