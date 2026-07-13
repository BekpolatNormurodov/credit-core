import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { sumToWordsUz, dateToUzbekWords } from '../../../common/sum-to-words.util';
import { CaseDocData } from '../case-document.loader';
import { orgHeader } from '../doc-layout';

/**
 * Ходатайство (Murojaatnoma) — the client's petition to open a microfinance line. Faithful
 * transcription of the official form (Uzbek Cyrillic), with the placeholders merged from the case:
 * client, limit sum, term, rate, penalty rate, collateral, date.
 */
export function petitionTemplate(c: CaseDocData): TDocumentDefinitions {
  const line = c.creditLine;
  const b = c.borrower;
  const name = b?.fullName ?? '—';
  const amount = Number(line?.amountTotal ?? c.amount ?? 0);
  const amountStr = `${new Intl.NumberFormat('ru-RU').format(amount)},00 (${amount ? sumToWordsUz(amount) : '—'})`;
  const termText = line?.termMonths != null ? `${line.termMonths} ой` : '—';
  const rateText = line?.interestRate != null ? `${Math.round(Number(line.interestRate) * 100)}%` : '—';
  const penaltyText = line?.penaltyRate != null ? `${Math.round(Number(line.penaltyRate) * 100)}%` : '—';
  const dateStr = line?.lineDate ? dateToUzbekWords(line.lineDate) : '—';
  const ins = line?.insurance;

  const collateralItems: Content[] = c.collaterals.map((col) => ({
    text: col.type === 'AUTO'
      ? `- ${name} га тегишли ${col.model ?? '—'} русумли автомототранспорт воситаси;`
      : `- ${name} га тегишли ${col.address ?? '—'} манзилда жойлашган ${col.realtyKind === 'HOUSE' ? 'ҲОВЛИ' : "КЎП ҚАВАТЛИ УЙДАГИ ХОНАДОН"};`,
    margin: [0, 1, 0, 1],
  }));
  if (ins?.insured) collateralItems.push({ text: '- Суғурта компаниясининг кредит қайтмаслик риски полиси', margin: [0, 1, 0, 1] });

  const p = (text: string): Content => ({ text, margin: [0, 3, 0, 3], alignment: 'justify' });

  return {
    defaultStyle: { font: 'Roboto', fontSize: 10 },
    pageMargins: [45, 50, 45, 50],
    content: [
      orgHeader(c.organization),
      { text: `«${c.organization?.nameUpper ?? 'ММТ'}» ижрочи директори\n${c.organization?.directorFull ?? ''}га`, alignment: 'right', margin: [0, 0, 0, 12] },
      { text: 'Микромолия линиясини очиш тўғрисида', bold: true, alignment: 'center' },
      { text: 'МУРОЖААТНОМА', bold: true, alignment: 'center', fontSize: 13, margin: [0, 2, 0, 12] },
      p('Сиздан қуйидаги шартлар асосида микроқарз/микрокредитлар олиш учун қуйидаги шартларда Микромолиявий линия (ММЛ) очиб бериш масаласини кўриб чиқишингизни сўрайман:'),
      p('1. Микромолия линияси доирасида ажратиладиган Микроқарз/микрокредит шакли: нақд ёки пул ўтказиш йўли билан (Мижоз ихтиёрига кўра);'),
      p(`2. Микромолия линия лимит суммаси: ${amountStr} сўмгача;`),
      p(`3. Микромолия линия муддати: ${termText};`),
      p(`4. Микромолия линияси доирасида ажратиладиган микроқарз/микрокредитларнинг фоиз ставкаси: йиллик ${rateText} фоиздан кредит миқдорининг қолдиқ суммасига нисбатан хисобланади. Тўлаш жадвалига мувофиқ асосий қарз бўйича навбатдаги тўлов бузилган ҳолларда муддати ўтган микроқарз/микрокредитнинг асосий қарз суммаси бўйича йиллик ${penaltyText} фоиз миқдорида фоизлар ҳисоблайди.`),
      { text: '5. Микромолия линияси таъминоти:', margin: [0, 3, 0, 3] },
      ...collateralItems,
      p(`${name} қуйидагилардан хабардор қилинган ва розилигини билдирган:`),
      p('- ММТ микромолия линиясини очиш тўғрисидаги Бош келишув (бундан буён матнда "Бош келишув" деб юритилади) тузишни ўз зиммасига олади, унинг асосида микроқарз/микрокредитлар бериш алоҳида тузилган микроқарз/микрокредит шартномалари бўйича амалга оширилади;'),
      p('- Бош Келишувда микроқарз/микрокредит бериш ҳажми ва асосий шартлари олдиндан белгилаб қўйилган;'),
      p('- Тақдим этилган хужжатлар ва ушбу мурожаатноманинг асл нусхаси, ММТ томонидан микромолия линиясини очишни рад этган тақдирда ҳам ММТ да сақланади;'),
      p('- Микромолия ташкилотининг ушбу мурожаатномани қабул қилиши Микромолия ташкилотига Бош Келишув тузиш мажбуриятини юкламайди.'),
      { text: `Мурожаатнома санаси: ${dateStr}`, margin: [0, 12, 0, 4] },
      { text: `${name}    имзо ___________________`, margin: [0, 8, 0, 0] },
    ],
  };
}
