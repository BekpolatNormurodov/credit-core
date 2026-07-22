import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { CaseDocData } from '../case-document.loader';
import { DOC_DEFAULT_STYLE, DOC_PAGE_MARGINS } from '../doc-layout';

/**
 * Чек-лист — the borrower's own acknowledgement, transcribed from «Чек лист.docx».
 *
 * Not to be confused with «Hujjatlar ro'yxati», the перечень of papers in the dossier: this one is
 * signed by the client, not filed by the office. Each heading is a statement they confirm, with a
 * rule beside it to initial — the source document puts one at the end of every block, and they are
 * the whole point of the form.
 *
 * Static text: nothing here is spliced from the case, because the client signs what they read.
 * Only the name and date lines are theirs to fill in, by hand.
 */

/** A confirmed statement: the bold claim, its explanation, and the rule to initial. */
function item(heading: string, body: string): Content[] {
  return [
    { text: heading, bold: true, margin: [0, 8, 0, 3] },
    { text: body, alignment: 'justify', margin: [0, 0, 0, 2] },
    { text: '_____________________', alignment: 'right', margin: [0, 0, 0, 2] },
  ];
}

export function borrowerChecklistTemplate(_c: CaseDocData): TDocumentDefinitions {
  return {
    defaultStyle: DOC_DEFAULT_STYLE,
    pageMargins: DOC_PAGE_MARGINS,
    content: [
      { text: 'Чек-лист', bold: true, alignment: 'center', fontSize: 13, margin: [0, 0, 0, 10] },

      {
        text:
          'Кредит шартномасини расмийлаштиришдан аввал, ушбу рўйхатни диққат билан ўкиб чикинг ва ҳар бир ' +
          'бандни тушунганингизни тасдиқланг. Бу, сизни келгусида кутилмаган молиявий кийинчиликлардан ' +
          'сақланишингиз учун хизмат килиши мумкин.',
        bold: true,
        alignment: 'justify',
        margin: [0, 0, 0, 6],
      },

      ...item(
        'Кредит – бу ҳаражат.',
        'Кредит – бу, мен тулашим шарт булган молиявий мажбуриятдир. Кредитингиз асосий суммасидан ташкари, ' +
        'кредит бўйича ҳисобланадиган фоизларни, шунингдек эхтимол, кредит билан боглик бошка харажатларни ' +
        '(сугурта, кредит туловларини амалга ошириш харажатлари ва бошкалар) хам тулашимга тугри келади.',
      ),

      ...item(
        'Кредитни қайтариш жадвалини диккат билан урганиб чикдим.',
        'Кредитни қайтариш жадвалидаги барча саналар ва тўлов миқдорлари хамда ушбу туловлани амалга ошириш ' +
        'усуллари билан танишдим. Мазкур жадвалга мувофик ҳар ойда қанча ва қачон тўлашим кераклигини ' +
        'тушундим ҳамда уларни ўз вақтида бажара оламан.',
      ),

      ...item(
        'Даромадларим кредит тўловларини тўлаш имконини беради.',
        'Мазкур кредитни олишда мен ойлик даромадим ва доимий харажатларимни (ижара, коммунал хизматлар, ' +
        'транспорт ва бошқа харажатлар) шунингдек, кредит буйича уз мажбуриятларимни бажара олмаслигимга ' +
        'олиб келиши мумкин булган енгилмас куч таъсиридаги вазиятлар (холатлар)ни юз бериши эхтимолини ' +
        '(ишимни йукотиш, иш хаки ва бошка даромадларни кечикиши, соглигимнинг ёмонлашиши) инобатга олдим.',
      ),

      // The source splits this one across two paragraphs before its rule; kept as it is written.
      { text: 'Кредит тўловларини кечиктириш оқибатларидан хабардорман.', bold: true, margin: [0, 8, 0, 3] },
      {
        text:
          'Кредит туловларини ўз вақтида тўламаган тақдирда, банк томонидан ушбу карздорлик буйича, тегишли ' +
          'жарима ва пенялар белгиланганини, шунингдек, агар кредит карздорлиги суд оркали ундирилса, мазкур ' +
          'суд харажатларини хам тулашим мумкинлигини тушундим.',
        alignment: 'justify',
        margin: [0, 0, 0, 3],
      },
      {
        text:
          'Бундан ташкари, кредит тарихимда мажбуриятлар уз вактда бажарилмагани тугрисида маълумотлар акс ' +
          'эттирилиши, бу эса келгусида молиявий ташкилотлардан кредит олиш имкониятимни пасайишига ёки ' +
          'нокулай шартлардаги кредит олишга мажбур булишимга сабаб булиши мумкинлигини биламан.',
        alignment: 'justify',
        margin: [0, 0, 0, 2],
      },
      { text: '_____________________', alignment: 'right', margin: [0, 0, 0, 2] },

      {
        text:
          'Бундан ташкари, Микромолия ташкилотига хеч кандай комиссион туловлар туланмаганим ва ММТ ' +
          'ходимларига хеч кандай тулов килмаганлигимни маълум киламан.',
        bold: true,
        alignment: 'justify',
        margin: [0, 8, 0, 2],
      },
      { text: '_____________________', alignment: 'right', margin: [0, 0, 0, 14] },

      { text: 'ФИО _______________________________________________________________________' },
      { text: 'Сана: ___ / ___ / 20___', margin: [0, 8, 0, 0] },
    ],
  };
}
