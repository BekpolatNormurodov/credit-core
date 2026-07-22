import { mockCaseDoc, flattenDocText } from '../__fixtures__/case-doc.fixture';
import { DOC_REGISTRY } from '../registry';
import { clientProfileTemplate } from './client-profile';

describe('clientProfileTemplate (МИЖОЗ АНКЕТАСИ, sheet b3)', () => {
  const text = flattenDocText(clientProfileTemplate(mockCaseDoc()));

  it('carries every row label the sheet has, in its own wording', () => {
    for (const row of [
      'Мижоз фамилия исм шарифи', 'Жинси', 'фуқаролиги',
      'Фамилия ўзгарган тақдирда аввалги фамилияси', 'Туғилган санаси', 'СТИР', 'ЖШШИР',
      'Паспорт', 'серия ва рақами', 'ким томонидан берилган', 'муддати',
      'Адрес', 'прописка буйича', 'фактический', 'яшаш давомийлиги', 'ориентир',
      'Телефон', 'мобил', 'қўшимча',
      'Оилавий ахволи', 'Оила аъзолари сони',
      'Даромад манбаи', 'Фаолият жойи', 'Фаолият манзили', 'Соха', 'Лавозими', 'мехнат давомийлиги',
      'Даромадлари', 'асосий фаолиятдан', 'қўшимча фаолиятдан', 'оила аъзоларини даромади',
      'Харажатлари', 'Коммунал тўловлар', 'Оилавий харажатлар', 'Кредитлар учун (КАТМ)',
      'Янги суралган кредит буйича',
      'Жами кредит туловлари', 'Жами даромадлари', 'Жами харажатлари',
      'Шу жумладан кредитлар буйича жами харажатлар',
      'Маълумоти', 'Яшаш жойи тури', 'Банкларда омонат хисобракамлари',
      'Бошка банкларда кредитларнинг мавжудлиги', 'МКО/ ломбардлардан қарздорликлари',
      'Карз юки курсаткичи',
    ]) {
      expect({ row, present: text.includes(row) }).toEqual({ row, present: true });
    }
  });

  it('prints the debt-burden ratio as a percentage — the point of the sheet', () => {
    expect(text).toMatch(/Карз юки курсаткичи\s*\d+%/);
  });

  it('states the client\'s declarations, with the organisation named', () => {
    expect(text).toContain('Маълумотлар хаққонийлигини тасдиқлайман');
    expect(text).toContain('текширилиши ва қайта текширилиши мумкин');
    expect(text).toContain('микрокредит бериш мажбуриятинини юкламайди');
    expect(text).toContain('юқори мансабдор шахс эмаслигини тасдиқлайман');
    expect(text).toContain('хеч қайси бошқа шахслар манфаатларини химоя қилмайман');
    expect(text).toContain(mockCaseDoc().organization!.nameUpper);
  });

  it('fills the borrower\'s own details rather than leaving the form blank', () => {
    const c = mockCaseDoc();
    expect(text).toContain(c.borrower!.fullName);
    expect(text).toContain(c.borrower!.pinfl!);
    expect(text).toContain('Эркак'); // fixture borrower is MALE
  });

  it('writes «йук» for an unchanged surname, as the sheet does', () => {
    expect(text).toContain('йук');
  });

  it('renders without throwing on an empty case, and shows dashes', () => {
    const bare = mockCaseDoc({
      borrower: null as unknown as never, employment: null as unknown as never,
      affordability: null as unknown as never, creditHistory: null as unknown as never,
    });
    const t = flattenDocText(clientProfileTemplate(bare));
    expect(t).toContain('МИЖОЗ АНКЕТАСИ');
    expect(t).toContain('—');
    expect(t).not.toContain('NaN');
    expect(t).not.toContain('undefined');
  });

  it('is registered so the case actually offers it', () => {
    expect(DOC_REGISTRY.clientProfile).toBeDefined();
    expect(DOC_REGISTRY.clientProfile!.stage).toBe('review');
    expect(flattenDocText(DOC_REGISTRY.clientProfile!.build(mockCaseDoc()))).toContain('МИЖОЗ АНКЕТАСИ');
  });
});
