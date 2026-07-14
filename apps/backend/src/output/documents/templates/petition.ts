import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { dateToUzbekWords } from '../../../common/sum-to-words.util';
import { CaseDocData } from '../case-document.loader';
import { orgHeader, money } from '../doc-layout';
import { p, lineTerms, collateralDetails } from './_shared';

/**
 * Ходатайство (Мурожаатнома) — the client's petition to open a microfinance line. Faithful
 * transcription of the real signed form (Joldibayev Ruslan, p.35: addressee block, title, the
 * request paragraph, the numbered ММЛ terms, the таъминот/collateral list, the insurance line,
 * the "хабардор қилинган ва розилигини билдирган" acknowledgements, date and signature).
 */
export function petitionTemplate(c: CaseDocData): TDocumentDefinitions {
  const org = c.organization;
  const line = c.creditLine;
  const b = c.borrower;

  const name = b?.fullName ?? '—';
  const address = b?.regAddress ?? b?.address ?? '—';
  const passport = [b?.passportSeries, b?.passportNumber].filter(Boolean).join(' ') || '—';
  const pinfl = b?.pinfl ?? '—';
  const phone = b?.phone ?? '—';

  const lineNo = line?.lineNumber ?? c.contractNumber ?? c.number ?? '—';
  const dateStr = line?.lineDate ? dateToUzbekWords(line.lineDate) : '—';
  const ins = line?.insurance;
  const insuredSum = ins?.insured && ins?.insuredSum != null ? Number(ins.insuredSum) : null;

  const orgAddressee = `${org?.nameSuffix ?? 'МЧЖ'} «${org?.nameMixed ?? '—'}» ижрочи директори\n${org?.directorShort ?? org?.directorFull ?? '—'}га`;

  return {
    defaultStyle: { font: 'Roboto', fontSize: 10 },
    pageMargins: [45, 50, 45, 50],
    content: [
      orgHeader(org),
      { text: orgAddressee, alignment: 'right', margin: [0, 0, 0, 12] },
      { text: 'Микромолия линиясини очиш тўғрисида', bold: true, alignment: 'center' },
      { text: 'МУРОЖААТНОМА', bold: true, alignment: 'center', fontSize: 13, margin: [0, 2, 0, 4] },
      { text: `№ ${lineNo}`, alignment: 'center', margin: [0, 0, 0, 12] },

      p('Сиздан қуйидаги шартлар асосида микроқарз/микрокредитлар олиш учун қуйидаги шартларда Микромолиявий линия (ММЛ) очиб бериш масаласини кўриб чиқишингизни сўрайман:'),

      ...lineTerms(c),

      { text: '5. Микромолия линияси таъминоти:', margin: [0, 3, 0, 3] },
      ...collateralDetails(c),
      ...(ins?.insured
        ? [
            {
              text: `- ${ins.company ?? '—'} суғурта компаниясининг кредит қайтмаслик риски полиси${insuredSum != null ? ` (суғурта суммаси: ${money(insuredSum)})` : ''}`,
              margin: [0, 1, 0, 1] as [number, number, number, number],
            },
          ]
        : []),

      p(`${name} қуйидагилардан хабардор қилинган ва розилигини билдирган:`),
      p('- ММТ микромолия линиясини очиш тўғрисидаги Бош келишув (бундан буён матнда "Бош келишув" деб юритилади) тузишни ўз зиммасига олади, унинг асосида микроқарз/микрокредитлар бериш алоҳида тузилган микроқарз/микрокредит шартномалари бўйича амалга оширилади;'),
      p('- Бош Келишувда микроқарз/микрокредит бериш ҳажми ва асосий шартлари олдиндан белгилаб қўйилган;'),
      p(`- ММТларнинг тузилган Бош Келишув доирасида микроқарз/микрокредит шартномаларини тузиш ва микроқарз/микрокредитлар бериш шартли хисобланмайди. ММТ ва ${name} билан микроқарз/микрокредит шартномаларини тузиш мажбуриятидан воз кечиш ва Бош Келишувда назарда тутилган ҳолларда микроқарз/микрокредитлар бериш ҳуқуқига эга;`),
      p(`- ${name} томонидан тақдим этилган хужжатлар ва ушбу мурожаатноманинг асл нусхаси, ММТ томонидан микромолия линиясини очишни рад этган тақдирда ҳам ММТ да сақланади;`),
      p('- Микромолия ташкилотининг ушбу мурожаатномани қабул қилиши Микромолия ташкилотига Бош Келишув тузиш мажбуриятини юкламайди.'),

      { text: `Мурожаатнома санаси: ${dateStr}`, margin: [0, 12, 0, 10] },

      { text: name, bold: true, margin: [0, 4, 0, 2] },
      { text: `Манзил: ${address}`, margin: [0, 1, 0, 1] },
      { text: `Паспорт: ${passport}`, margin: [0, 1, 0, 1] },
      { text: `ЖШШИР: ${pinfl}`, margin: [0, 1, 0, 1] },
      { text: `Тел: ${phone}`, margin: [0, 1, 0, 1] },
      { text: `${name}    имзо ___________________`, margin: [0, 8, 0, 0] },
    ] as Content[],
  };
}
