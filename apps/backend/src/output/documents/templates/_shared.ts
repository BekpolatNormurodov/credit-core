import type { Content } from 'pdfmake/interfaces';
import { sumToWordsUz, dateToUzbekWords } from '../../../common/sum-to-words.util';
import { CaseDocData } from '../case-document.loader';

/** Justified body paragraph. */
export const p = (text: string): Content => ({ text, margin: [0, 3, 0, 3], alignment: 'justify' });

/** "200 000 000,00 (ikki yuz million ...)" — number + words. */
export function amountWords(amount: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(amount)},00 (${amount ? sumToWordsUz(amount) : '—'})`;
}

/** The shared numbered line terms (form, limit, term, rate/penalty) — identical across the forms. */
export function lineTerms(c: CaseDocData): Content[] {
  const line = c.creditLine;
  const amount = Number(line?.amountTotal ?? c.amount ?? 0);
  const termText = line?.termMonths != null ? `${line.termMonths} ой` : '—';
  const rateText = line?.interestRate != null ? `${Math.round(Number(line.interestRate) * 100)}%` : '—';
  const penaltyText = line?.penaltyRate != null ? `${Math.round(Number(line.penaltyRate) * 100)}%` : '—';
  return [
    p('1. Микромолия линияси доирасида ажратиладиган Микроқарз/микрокредит шакли: нақд ёки пул ўтказиш йўли билан (Мижоз ихтиёрига кўра);'),
    p(`2. Микромолия линия лимит суммаси: ${amountWords(amount)} сўмгача;`),
    p(`3. Микромолия линия муддати: ${termText};`),
    p(`4. Микромолия линияси доирасида ажратиладиган микроқарз/микрокредитларнинг фоиз ставкаси: йиллик ${rateText} фоиздан кредит миқдорининг қолдиқ суммасига нисбатан хисобланади. Тўлаш жадвалига мувофиқ асосий қарз бўйича навбатдаги тўлов бузилган ҳолларда муддати ўтган микроқарз/микрокредитнинг асосий қарз суммаси бўйича йиллик ${penaltyText} фоиз миқдорида фоизлар ҳисоблайди.`),
  ];
}

/** The notarial-attestation block appended to notary-variant documents (party ID + fill-in lines). */
export function notaryBlock(c: CaseDocData): Content {
  const b = c.borrower;
  const passport = [b?.passportSeries, b?.passportNumber].filter(Boolean).join(' ') || '—';
  return {
    stack: [
      { text: 'НОТАРИАЛ ТАСДИҚ', bold: true, alignment: 'center', margin: [0, 18, 0, 6] },
      { text: `Тарафлар шахси аниқланди: ${b?.fullName ?? '—'}, паспорт: ${passport}, ЖШШИР: ${b?.pinfl ?? '—'}, манзил: ${b?.regAddress ?? b?.address ?? '—'}.`, margin: [0, 2, 0, 6] },
      { text: 'Нотариус: ______________________________________', margin: [0, 4, 0, 2] },
      { text: 'Реестр рақами: _____________   Сана: _____________   Жой: _____________', margin: [0, 2, 0, 2] },
      { text: '\nНотариус имзоси ___________________     М.У. (муҳр)', margin: [0, 8, 0, 0] },
    ],
    margin: [0, 10, 0, 0],
  };
}

/** Per-collateral details block (auto or real estate), verbatim style. */
export function collateralDetails(c: CaseDocData): Content[] {
  const b = c.borrower;
  const out: Content[] = [];
  for (const col of c.collaterals) {
    const owner = col.owners?.[0]?.fullName ?? b?.fullName ?? '—';
    if (col.type === 'AUTO') {
      out.push(p(`Мулк номи: ${col.model ?? '—'}`));
      out.push({ text: `* Автомототранспорт воситаси эгаси: ${owner}`, margin: [0, 1, 0, 1] });
      out.push({ text: `* техник паспорт рақами: ${[col.techPassportNo, col.techPassportDate ? dateToUzbekWords(col.techPassportDate) : null].filter(Boolean).join(' от ') || '—'}`, margin: [0, 1, 0, 1] });
      out.push({ text: `* давлат рақами: ${col.stateNumber ?? '—'}`, margin: [0, 1, 0, 1] });
    } else {
      out.push(p(`Ушбу ${col.realtyKind === 'HOUSE' ? 'ҲОВЛИ' : 'кўчмас мулк'} объектнинг таркиби ва таснифи:`));
      out.push({ text: `Хоналар сони: ${col.roomCount ?? '—'} та, умумий майдони ${col.totalAreaM2 ?? '—'} кв.м., яшаш майдони - ${col.livingAreaM2 ?? '—'} кв.м.${col.roomNames ? ', хоналар номи: ' + col.roomNames : ''}`, margin: [0, 1, 0, 1] });
      out.push({ text: `-* кўчмас мулк эгаси: ${owner}`, margin: [0, 1, 0, 1] });
      out.push({ text: `-* реестр рақами: ${col.registryNo ?? '—'}`, margin: [0, 1, 0, 1] });
      out.push({ text: `-* кадастр рақами: ${col.cadastreNo ?? '—'}`, margin: [0, 1, 0, 1] });
      out.push({ text: `-* манзил: ${col.address ?? '—'}`, margin: [0, 1, 0, 1] });
    }
  }
  return out;
}
