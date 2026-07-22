import { mockCaseDoc, flattenDocText } from '../__fixtures__/case-doc.fixture';
import { DOC_REGISTRY } from '../registry';
import { borrowerChecklistTemplate } from './borrower-checklist';

describe('borrowerChecklistTemplate (Чек-лист the client signs)', () => {
  const text = flattenDocText(borrowerChecklistTemplate(mockCaseDoc()));

  it('carries all five statements the client confirms', () => {
    expect(text).toContain('Кредит – бу ҳаражат.');
    expect(text).toContain('Кредитни қайтариш жадвалини диккат билан урганиб чикдим.');
    expect(text).toContain('Даромадларим кредит тўловларини тўлаш имконини беради.');
    expect(text).toContain('Кредит тўловларини кечиктириш оқибатларидан хабардорман.');
    expect(text).toContain('комиссион туловлар туланмаганим');
  });

  it('gives each statement a rule to initial — the point of the form', () => {
    expect((text.match(/_____________________/g) ?? []).length).toBeGreaterThanOrEqual(5);
  });

  it('ends with the name and date the client fills in by hand', () => {
    expect(text).toContain('ФИО');
    expect(text).toContain('Сана: ___ / ___ / 20___');
  });

  it('splices nothing from the case — the client signs what they read', () => {
    const other = flattenDocText(borrowerChecklistTemplate(mockCaseDoc({
      borrower: { fullName: 'BOSHQA ODAM' } as unknown as never,
    })));
    expect(other).toBe(text);
    expect(text).not.toContain('ЖЎЛДИБАЕВ');
  });

  it('is a different document from the dossier list, and both are registered', () => {
    expect(DOC_REGISTRY.borrowerChecklist!.title).toContain('Чек-лист');
    expect(DOC_REGISTRY.cheklist!.title).toBe("Hujjatlar ro'yxati");
    // The перечень lists papers; the чек-лист asks the client to confirm they understood.
    const list = flattenDocText(DOC_REGISTRY.cheklist!.build(mockCaseDoc()));
    expect(list).not.toContain('Кредит – бу ҳаражат.');
    expect(text).not.toContain('перечень');
  });
});
