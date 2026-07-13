import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { dateToUzbekWords } from '../../../common/sum-to-words.util';
import { CaseDocData } from '../case-document.loader';
import { money, orgHeader } from '../doc-layout';
import { amountWords, p } from './_shared';

/**
 * Протокол — extract from the credit-committee meeting protocol approving the loan. Faithful
 * transcription (Latin Uzbek) with placeholders merged: committee terms + collateral.
 */
export function protokolTemplate(c: CaseDocData): TDocumentDefinitions {
  const line = c.creditLine;
  const b = c.borrower;
  const name = b?.fullName ?? '—';
  const amount = Number(line?.amountTotal ?? c.amount ?? 0);
  const amt = amountWords(amount);
  const term = line?.termMonths ?? null;
  const ratePct = line?.interestRate != null ? Math.round(Number(line.interestRate) * 100) : null;
  const dateStr = line?.lineDate ? dateToUzbekWords(line.lineDate) : '—';
  const contractNo = c.contractNumber ?? c.number;
  const schedule = line?.tranches?.[0]?.scheduleType === 'DIFFERENTIATED' ? 'differensial' : 'annuitet';

  // Collateral description (real estate → composition; auto → model + state number).
  const collateralDesc: Content[] = c.collaterals.map((col) =>
    col.type === 'AUTO'
      ? p(`Egalik huquqi ${name}ga tegishli ${col.model ?? '—'} rusumli avtotransport vositasi, davlat raqami ${col.stateNumber ?? '—'}.`)
      : p(`Egalik huquqi ${name}ga tegishli garovga olingan ${col.realtyKind === 'HOUSE' ? 'HOVLI' : "KO'P QAVATLI UYDAGI XONADON"}, umumiy maydoni - ${col.totalAreaM2 ?? '—'} kv.m., yashash maydoni - ${col.livingAreaM2 ?? '—'} kv.m., manzil: ${col.address ?? '—'}`),
  );

  const collateralTable: Content[] = c.collaterals.flatMap((col) =>
    col.type === 'AUTO'
      ? [
          { text: `Garov: ${col.model ?? '—'}`, bold: true, margin: [0, 4, 0, 1] },
          { text: `-* transport vositasi egasi: ${col.owners?.[0]?.fullName ?? name}`, margin: [0, 1, 0, 0] },
          { text: `-* texnik pasport raqami: ${col.techPassportNo ?? '—'}`, margin: [0, 1, 0, 0] },
          { text: `-* davlat raqami: ${col.stateNumber ?? '—'}`, margin: [0, 1, 0, 0] },
          { text: `-* ishlab chiqarilgan yili: ${col.year ?? '—'}`, margin: [0, 1, 0, 0] },
          { text: `-* kelishilgan qiymati: ${money(col.agreedValue)}`, margin: [0, 1, 0, 0] },
        ]
      : [
          { text: `Garov: ${col.realtyKind === 'HOUSE' ? 'HOVLI' : "KO'P QAVATLI UYDAGI XONADON"}`, bold: true, margin: [0, 4, 0, 1] },
          { text: `-* ko'chmas mulk egasi: ${col.owners?.[0]?.fullName ?? name}`, margin: [0, 1, 0, 0] },
          { text: `-* reestr raqami: ${col.registryNo ?? '—'}`, margin: [0, 1, 0, 0] },
          { text: `-* kadastr raqami: ${col.cadastreNo ?? '—'}`, margin: [0, 1, 0, 0] },
          { text: `-* manzili: ${col.address ?? '—'}`, margin: [0, 1, 0, 0] },
          { text: `-* kelishilgan qiymati: ${money(col.agreedValue)}`, margin: [0, 1, 0, 0] },
        ],
  );

  return {
    defaultStyle: { font: 'Roboto', fontSize: 10 },
    pageMargins: [45, 50, 45, 50],
    content: [
      orgHeader(c.organization),
      { text: `«${c.organization?.nameUpper ?? 'MMT'}» mikromoliya tashkiloti Kredit qo‘mitasining yig‘ilishi`, alignment: 'center', bold: true },
      { text: `${contractNo} protokolidan ko‘chirma`, alignment: 'center', margin: [0, 2, 0, 2] },
      { text: `Toshkent shahri · ${dateStr}`, alignment: 'center', margin: [0, 0, 0, 12] },
      { text: 'KUN TARTIBI:', bold: true },
      p(`${name}ga mikroqarz berish masalasini ko‘rib chiqish to‘g‘risida.`),
      p(`Birinchi masala yuzasidan: «${c.organization?.nameMixed ?? 'MMT'}» kredit bo‘yicha menejeri ${name}ga ${amt} so‘m miqdorida, muddati ${term ?? '—'} oyga va yillik ${ratePct ?? '—'}% miqdorida mikroqarz berish bo‘yicha ${name}ning kredit arizasi va tashkilotning xulosasi bilan ishtirokchilarni tanishtirdi.`),
      { text: 'Mikroqarz ta’minoti:', bold: true, margin: [0, 4, 0, 2] },
      ...collateralDesc,
      p('Birinchi masala yuzasidan berilgan ma’lumotlarni muhokama qilib, Kredit qo‘mitasi a’zolariga taqdim etilgan zarur hujjatlarni o‘rganib, majlisda ishtirok etgan Kredit qo‘mitasi a’zolarining taklif va mulohazalarini inobatga olgan holda Kredit qo‘mitasi'),
      { text: 'QAROR QILADI:', bold: true, margin: [0, 4, 0, 4] },
      p(`${name}ga quyidagi shartlarda mikroqarz berish masalasi ma’qullansin:`),
      { text: `1. Mikroqarz summasi: ${amt}.`, margin: [0, 1, 0, 1] },
      { text: `2. Mikroqarz muddati: ${term ?? '—'} oy.`, margin: [0, 1, 0, 1] },
      { text: `3. Mikroqarzdan foydalanganlik uchun foiz stavkasi: yillik ${ratePct ?? '—'}% foiz.`, margin: [0, 1, 0, 1] },
      { text: `4. Mikroqarz bo‘yicha asosiy qarz va foizlarni to‘lash: shartnoma bo‘yicha har oy ${schedule} to‘lovlari amalga oshiriladi.`, margin: [0, 1, 0, 1] },
      { text: `5. Mikroqarz bo‘yicha garov ${name}:`, margin: [0, 1, 0, 1] },
      ...collateralTable,
      { text: '6. Boshqa shartlar – ko‘chmas mulk shaklida garov ta’minlangandan keyin mikroqarz berish.', margin: [0, 4, 0, 0] },
      { text: '\nKredit qo‘mitasi raisi ______________', margin: [0, 16, 0, 0] },
    ],
  };
}
