import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import {
  sumToWordsUzCyrillic, integerToUzbekWords, integerToUzbekWordsCyrillic, dateToRuCyrillic,
} from '../../../common/sum-to-words.util';
import { CaseDocData } from '../case-document.loader';
import { gridTable, plainMoney, shortDate, DOC_DEFAULT_STYLE, DOC_PAGE_MARGINS } from '../doc-layout';
import { p } from './_shared';
import { shortName, realtyWord } from './_collateral';

type Collateral = CaseDocData['collaterals'][number];

const dash = (v: unknown): string => (v == null || v === '' ? '—' : String(v));
const cap = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** "90 000 000,00 (Тўқсон миллион сўм 00 тийин)" — the sheet spells sums in Cyrillic even here. */
const sumCyr = (n: unknown): string => {
  if (n == null) return '—';
  const v = Number(n);
  if (Number.isNaN(v)) return '—';
  return `${plainMoney(v)} (${sumToWordsUzCyrillic(v)})`;
};

/** Committee "Mikroqarz ta'minoti" sentence, per collateral type. */
function collateralSentence(col: Collateral, ownerFull: string): string {
  const ownerShort = shortName(col.owners?.[0]?.fullName ?? ownerFull);
  if (col.type === 'AUTO') {
    return (
      `Egalik huquqi ${ownerShort}ga tegishli bo‘lgan garovga olingan avtomobil markasi ${dash(col.model)}, ` +
      `rangi - ${dash(col.color)}, ishlab chiqarilgan yili - ${dash(col.year)}, ` +
      `davlat raqam belgisi ${dash(col.stateNumber)}, kuzov turi - ${dash(col.bodyType)}, ` +
      `kuzov raqami - ${dash(col.bodyNo)}, dvigatel raqami - ${dash(col.engineNo)}, ` +
      `shassi raqami - ${dash(col.chassis)}`
    );
  }
  return (
    `Egalik huquqi ${col.owners?.[0]?.fullName ?? ownerFull}ga tegishli bo‘lgan garovga olingan ` +
    `${realtyWord(col)} umumiy foydali maydoni - ${dash(col.usableAreaM2)} кв.м. va ` +
    `yashash maydoni - ${dash(col.livingAreaM2)} кв.м., ${dash(col.address)}`
  );
}

const AUTO_HEAD: TableCell[] = [
  { text: 'Nomi', bold: true, alignment: 'center' },
  { text: 'Kuzov turi va kuzov raqami*', bold: true, alignment: 'center' },
  { text: 'Dvigatel va shassi raqami*', bold: true, alignment: 'center' },
  { text: 'Ishlab chiqarilgan yili va rangi*', bold: true, alignment: 'center' },
  { text: "Kelishilgan garov qiymati, so'm", bold: true, alignment: 'center' },
];
const REALTY_HEAD: TableCell[] = [
  { text: 'Nomi', bold: true, alignment: 'center' },
  { text: 'Kadastr raqami', bold: true, alignment: 'center' },
  { text: 'Yashash maydoni', bold: true, alignment: 'center' },
  { text: 'Umumiy foydali maydoni', bold: true, alignment: 'center' },
  { text: "Kelishilgan garov qiymati, so'm", bold: true, alignment: 'center' },
];

/** The committee's garov table + its footnotes, per collateral type (both are on the sheet). */
function collateralTable(cols: Collateral[], ownerFull: string): Content[] {
  const out: Content[] = [];
  const autos = cols.filter((x) => x.type === 'AUTO');
  const realty = cols.filter((x) => x.type === 'REAL_ESTATE');

  if (autos.length) {
    const rows: TableCell[][] = autos.map((col) => [
      { text: dash(col.model) },
      { text: `${dash(col.bodyType)} ${dash(col.bodyNo)}` },
      { text: `${dash(col.engineNo)} ${dash(col.chassis)}` },
      { text: `${dash(col.year)} rangi - ${dash(col.color)}, ${dash(col.year)} yilda ishlab chiqarilgan.` },
      { text: plainMoney(col.agreedValue) },
    ]);
    out.push({
      fontSize: 8,
      table: { headerRows: 1, widths: [70, '*', '*', 84, 78], body: [AUTO_HEAD, ...rows] },
      layout: gridTable,
      margin: [0, 4, 0, 4],
    });
    autos.forEach((col) => {
      const tp = col.techPassportNo
        ? `${col.techPassportNo}${col.techPassportDate ? ` от ${shortDate(col.techPassportDate)} г.` : ''}`
        : '—';
      out.push(
        { text: `-* avtotransport egasi: ${shortName(col.owners?.[0]?.fullName ?? ownerFull)}`, fontSize: 9 },
        { text: `-* texnik pasport: ${tp}`, fontSize: 9 },
        // NB: plain apostrophes — the Excel's "ʻ" (U+02BB) has no glyph in Roboto and renders as tofu.
        { text: `-* ro‘yxatdan o‘tgan manzili/garaj manzili: ${dash(col.address)}`, fontSize: 9 },
        { text: `-* davlat raqami: ${dash(col.stateNumber)}`, fontSize: 9 },
      );
    });
  }

  if (realty.length) {
    const rows: TableCell[][] = realty.map((col) => [
      { text: realtyWord(col) },
      { text: dash(col.cadastreNo) },
      { text: `${dash(col.livingAreaM2)} кв.м.`, alignment: 'center' },
      { text: `${dash(col.usableAreaM2)} кв.м.`, alignment: 'center' },
      { text: plainMoney(col.agreedValue) },
    ]);
    out.push({
      fontSize: 8,
      table: { headerRows: 1, widths: ['*', '*', 60, 66, 78], body: [REALTY_HEAD, ...rows] },
      layout: gridTable,
      margin: [0, 4, 0, 4],
    });
    realty.forEach((col) => {
      out.push(
        { text: `-* ko‘chmas mulk egasi: ${col.owners?.[0]?.fullName ?? ownerFull}`, fontSize: 9 },
        { text: `-* reest raqami: ${dash(col.registryNo)}`, fontSize: 9 },
        { text: `-* kadastr raqami: ${dash(col.cadastreNo)}`, fontSize: 9 },
        { text: `-* manzili: ${dash(col.address)}`, fontSize: 9 },
      );
    });
  }

  if (!out.length) out.push({ text: 'Garov kiritilmagan', italics: true });
  return out;
}

/**
 * Протокол — extract from the credit-committee meeting protocol. This sheet is written in LATIN
 * Uzbek (unlike the rest of the set) while still spelling sums/terms in Cyrillic words and the rate
 * in Latin words — reproduced exactly. No org letterhead.
 */
export function protokolTemplate(c: CaseDocData): TDocumentDefinitions {
  const org = c.organization;
  const line = c.creditLine;
  const b = c.borrower;
  const name = b?.fullName ?? '—';
  const amount = line?.amountTotal ?? c.amount ?? null;
  const term = line?.termMonths ?? null;
  const ratePct = line?.interestRate != null ? Math.round(Number(line.interestRate) * 100) : null;
  const dateStr = line?.lineDate ? dateToRuCyrillic(line.lineDate) : '—';
  const contractNo = c.contractNumber ?? c.number ?? '—';
  const hasRealty = (c.collaterals ?? []).some((x) => x.type === 'REAL_ESTATE');
  const securityWord = hasRealty ? 'ko‘chmas mulk' : 'avtotransport';

  return {
    defaultStyle: DOC_DEFAULT_STYLE,
    pageMargins: DOC_PAGE_MARGINS,
    content: [
      { text: `${org?.nameUpper ?? 'MMT'} mikromoliya tashkiloti Kredit qo‘mitasining yig‘ilishi`, alignment: 'center', bold: true },
      { text: `${contractNo} protokolidan ko‘chirma`, alignment: 'center', margin: [0, 2, 0, 2] },
      {
        columns: [
          { width: '*', text: 'Toshkent shahri' },
          { width: 'auto', text: dateStr, alignment: 'right' },
        ],
        margin: [0, 4, 0, 10],
      },
      { text: 'KUN TARTIBI:', bold: true },
      p(`${name}ga mikroqarz berish masalasini ko‘rib chiqish to‘g‘risida.`),
      p(
        `Birinchi masala yuzasidan: ${org?.nameUpper ?? 'MMT'} mikromoliya tashkiloti kredit bo‘yicha menejeri ` +
          `${name}ga ${sumCyr(amount)} so'm miqdorida, muddati ${term != null ? `${term} (${cap(integerToUzbekWordsCyrillic(term))})` : '—'} oyga va ` +
          `yillik ${ratePct != null ? `${ratePct} (${cap(integerToUzbekWords(ratePct))})` : '—'} foiz miqdorida mikroqarz berish bo‘yicha ` +
          `${name}ning kredit arizasi va ${org?.nameUpper ?? 'MMT'}ning xulosasi bilan ishtirokchilarni tanishtirdi.`,
      ),
      { text: 'Mikroqarz ta’minoti:', bold: true, margin: [0, 6, 0, 2] },
      ...(c.collaterals ?? []).map((col) => p(collateralSentence(col, name))),
      p(
        `Birinchi masala yuzasidan berilgan ma’lumotlarni muhokama qilib, Kredit qo‘mitasi a’zolariga taqdim etilgan ` +
          `zarur hujjatlarni o‘rganib, majlisda ishtirok etgan Kredit qo‘mitasi a’zolarining taklif va mulohazalarini ` +
          `inobatga olgan holda ${org?.nameUpper ?? 'MMT'} kredit qo‘mitasi`,
      ),
      { text: 'QAROR QILADI:', bold: true, alignment: 'center', margin: [0, 6, 0, 6] },
      p(`${name}ga quyidagi shartlarda mikroqarz berish masalasi ma’qullansin:`),
      { text: `1. Mikroqarz summasi: ${sumCyr(amount)}.`, margin: [0, 2, 0, 2] },
      { text: `2. Mikroqarz muddati: ${term != null ? `${term} (${cap(integerToUzbekWordsCyrillic(term))})` : '—'} oy`, margin: [0, 2, 0, 2] },
      { text: `3. Mikroqarzdan foydalanganlik uchun foiz stavkasi:yillik ${ratePct != null ? `${ratePct}% (${cap(integerToUzbekWords(ratePct))} )` : '—'} foiz.`, margin: [0, 2, 0, 2] },
      { text: '4. Mikroqarz bo‘yicha asosiy qarz va foizlarni to‘lash:', margin: [0, 2, 0, 2] },
      { text: "- mikroqarz shartnomasi bo'yicha har oy аннуитетный to'lovlari amalga oshiriladi", margin: [0, 1, 0, 2] },
      { text: `5. Mikroqarz bo‘yicha garov ${name}`, margin: [0, 2, 0, 2] },
      ...collateralTable(c.collaterals ?? [], name),
      { text: `6. Boshqa shartlar – ${securityWord} shaklida garov ta'minlangandan keyin mikroqarz berish.`, margin: [0, 6, 0, 0] },
    ],
  };
}
