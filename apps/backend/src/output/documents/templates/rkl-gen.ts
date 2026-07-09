import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { dateToUzbekWords } from '../../../common/sum-to-words.util';
import { CaseDocData } from '../case-document.loader';
import { orgHeader } from '../doc-layout';
import { amountWords, p } from './_shared';

/**
 * РКЛ Ген — Bosh kelishuv (master microfinance-line agreement). Faithful transcription (Uzbek
 * Cyrillic) of the official contract with placeholders merged from the case.
 */
export function rklGenTemplate(c: CaseDocData): TDocumentDefinitions {
  const line = c.creditLine;
  const b = c.borrower;
  const org = c.organization;
  const name = b?.fullName ?? '—';
  const amount = Number(line?.amountTotal ?? c.amount ?? 0);
  const amt = amountWords(amount);
  const term = line?.termMonths ?? 60;
  const ratePct = line?.interestRate != null ? Math.round(Number(line.interestRate) * 100) : 55;
  const penaltyPct = line?.penaltyRate != null ? Math.round(Number(line.penaltyRate) * 100) : 105;
  const startStr = line?.lineDate ? dateToUzbekWords(line.lineDate) : '—';
  const endStr = line?.lineMaturity ? dateToUzbekWords(line.lineMaturity) : '—';
  const contractNo = c.contractNumber ?? c.number;
  const passport = [
    b?.passportSeries && b?.passportNumber ? `паспорт рақами ${b.passportSeries} №${b.passportNumber}` : null,
    b?.passportIssuer ? `${b.passportIssuer} томонидан` : null,
    b?.passportIssueDate ? `${dateToUzbekWords(b.passportIssueDate)} берилган` : null,
  ].filter(Boolean).join(', ');

  const collateralClauses: Content[] = c.collaterals.map((col, i) => {
    const val = col.agreedValue != null ? amountWords(Number(col.agreedValue)) : '—';
    if (col.type === 'AUTO') {
      return p(`3.1.${i + 1}. ${name}га тегишли ${col.model ?? '—'} русумли автотранспорт воситаси (давлат рақами ${col.stateNumber ?? '—'}), Гаров предмети қиймати келишиш далолатномасига асосан ${val} сўмни ташкил қилади.`);
    }
    return p(`3.1.${i + 1}. ${name}га тегишли ${col.address ?? '—'} манзилда жойлашган, умумий майдони - ${col.totalAreaM2 ?? '—'} кв.м., яшаш майдони - ${col.livingAreaM2 ?? '—'} кв.м. бўлган ${col.realtyKind === 'HOUSE' ? 'ҲОВЛИ' : "КЎП ҚАВАТЛИ УЙДАГИ ХОНАДОН"} (бундан кейин – «Гаров Предмети») гарови; Гаров предмети қиймати келишиш далолатномасига асосан ${val} сўмни ташкил қилади.`);
  });

  const h = (text: string): Content => ({ text, bold: true, margin: [0, 8, 0, 4] });

  return {
    defaultStyle: { font: 'Roboto', fontSize: 9.5 },
    pageMargins: [45, 45, 45, 45],
    content: [
      orgHeader(org),
      { text: `№ ${contractNo} СОНЛИ МИКРОМОЛИЯ ЛИНИЯСИ ОЧИШ БЎЙИЧА БОШ КЕЛИШУВ`, bold: true, alignment: 'center', fontSize: 12 },
      { text: `Тошкент шаҳар · ${startStr}`, alignment: 'center', margin: [0, 2, 0, 10] },
      p(`«${org?.nameMixed ?? 'ММТ'}» (бундан буён «ММТ»), Низом асосида фаолият юритувчи, ижрочи директори ${org?.directorFull ?? '—'} бир тарафдан, ва ўз номидан ҳаракат қилувчи Ўзбекистон Республикаси фуқароси ${name} (${passport}), бундан буён «Қарз олувчи» бошқа тарафдан, биргаликда «Тарафлар» деб номланувчилар қуйидаги шартларда ушбу Бош келишувни туздилар:`),
      h('1. КЕЛИШУВ ПРЕДМЕТИ'),
      p(`1.1. ММТ мижозга ${amt} сўм миқдорида ${term} ой муддатга, яъни ${startStr} дан ${endStr} гача бўлган муддатга лимит билан микромолиялаш линиясини (бундан кейин ММЛ) очади ва ушбу келишув шартларига асосан мижозга Микроқарз/микрокредитлар бериш мажбуриятини олади.`),
      h('2. МИКРОҚАРЗ/МИКРОКРЕДИТ БЕРИШ ШАРТЛАРИ'),
      p('2.1. Микроқарз/Микрокредитлар Ўзбекистон Республикасининг миллий валютасида (сўмда) нақд ва/ёки нақд пулсиз шаклда, томонлар томонидан алоҳида микроқарз/микрокредит шартномаларини тузиш йўли билан берилади. Ушбу Келишув бўйича тузилган шартномалар ушбу Келишувнинг ажралмас қисми ҳисобланади.'),
      p('2.2. Берилаётган навбатдаги микроқарз/микрокредит суммаси S=L−D формуласи бўйича ҳисобланади (S – берилаётган сумма; L – микромолия лимити; D – илгари берилган микроқарз/микрокредитлар бўйича асосий қарзнинг умумий қолдиғи).'),
      p(`2.3. Микроқарз/микрокредитларнинг якуний муддати ${term} ойдан ошмаслиги керак. Шу билан бирга шартнома тузиш ойнаси: 6 ойгача – 54 ой; 12 ойгача – 48 ой; 18 ойгача – 42 ой; 24 ойгача – 36 ой; 30 ойгача – 30 ой; 33 ойгача – 27 ой; 48 ойгача – 12 ой ичида.`),
      p(`2.4. Фоиз ставкаси: асосий қарз бўйича йиллик ${ratePct}% ва муддати ўтган асосий қарз суммаси бўйича йиллик ${penaltyPct}%. Фоизлар ҳар куни асосий қарзнинг жорий қолдиғига нисбатан йилига 365(366) кун миқдорида ҳисобланади.`),
      p('2.8. Асосий қарз ва фоизлар ҳар ойда тўлов жадвалида белгиланган санада амалга оширилади (микроқарз/микрокредит шартномасига илова).'),
      h('3. МИКРОҚАРЗ/МИКРОКРЕДИТЛАР ГАРОВ ТАЪМИНОТИ'),
      p('3.1. Ушбу Келишув бўйича гаров сифатида қуйидагилар тақдим этилади:'),
      ...collateralClauses,
      ...(line?.insurance?.insured ? [
        p('3.1.2. Тўланмаслик хавфи учун ММТ ни қаноатлантирадиган суғурта компанияси полиси илова қилинади. Суғурта суммаси мижоз олган микроқарз/микрокредит миқдоридан келиб чиқиб белгиланади.'),
        p('ММТ полис учун суғурта мукофотини суғурта суммасининг йилига 2% гача миқдорида тўлайди ва кейинчалик мижоз томонидан ушбу харажатлар қопланади.'),
      ] : []),
      p('3.4. Қарзни ундириш ва гаровга қўйилган мол-мулкка ундириш судда ҳам, суддан ташқари ҳам, нотариуснинг ижро ёзувини олиш орқали амалга оширилиши мумкин.'),
      h('4. ТОМОНЛАРНИНГ ҲУҚУҚ ВА МАЖБУРИЯТЛАРИ'),
      p('4.1. ММТ микроқарз/микрокредит беришни рад етишга ҳақли: молиявий аҳвол ёмонлашганда; сохта маълумот тақдим этилганда; қонунчиликка зид ҳолларда; гаров тақдим этилмаганда; мажбуриятлар бузилганда.'),
      p('4.2. Мижоз ушбу Келишув ва унинг доирасидаги барча микроқарз/микрокредит шартномаларига риоя қилиш мажбуриятини олади.'),
      h('5. БОШҚА ШАРТЛАР'),
      p('5.1. Низолар Микромолия ташкилоти жойлашган ҳудуддаги тааллуқли Судда ўзбек ёки рус тилида кўриб чиқилади. 5.3. Келишув ва микроқарз шартномаси шартлари номувофиқ бўлса, микроқарз шартномаси устувор. 5.5. Ушбу Шартнома ўзбек тилида 2 нусхада тузилди, ҳар иккиси тенг юридик кучга эга.'),
      h('6. КЕЛИШУВНИНГ АМАЛ ҚИЛИШ МУДДАТИ'),
      p('6.1. Келишув томонлар имзолаган кундан кучга киради ва мажбуриятлар тўлиқ бажарилгунча амал қилади.'),
      h('7. ТОМОНЛАРНИНГ ЮРИДИК МАНЗИЛЛАРИ ВА РЕКВИЗИТЛАРИ'),
      { columns: [
        { width: '*', stack: [
          { text: '«Микромолия ташкилоти»', bold: true },
          { text: org?.nameMixed ?? '—' },
          { text: `Манзил: ${org?.address ?? '—'}` },
          { text: `х/р: ${org?.bankAccount ?? '—'}` },
          { text: `МФО: ${org?.bankMfo ?? '—'}` },
          { text: '\nИжрочи директор ___________ ' + (org?.directorShort ?? '') },
        ] },
        { width: '*', stack: [
          { text: '«Қарз олувчи»', bold: true },
          { text: name },
          { text: `Паспорт: ${[b?.passportSeries, b?.passportNumber].filter(Boolean).join(' ') || '—'}` },
          { text: `ЖШШИР: ${b?.pinfl ?? '—'}` },
          { text: `Тел: ${b?.phone ?? '—'}` },
          { text: '\nҚарз олувчи ___________ ' + name },
        ] },
      ], columnGap: 16, margin: [0, 6, 0, 0] },
    ],
  };
}
