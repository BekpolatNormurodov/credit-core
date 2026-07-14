import { mockCaseDoc, flattenDocText } from '../__fixtures__/case-doc.fixture';
import { disbursementTemplate } from './disbursement';

describe('disbursementTemplate', () => {
  it('renders the borrower name, contract number, and destination account requisites', () => {
    const c = mockCaseDoc();
    const text = flattenDocText(disbursementTemplate(c));

    expect(text).toContain('ЖЎЛДИБАЕВ РУСЛАН');
    expect(text).toContain(c.contractNumber ?? c.number);
    expect(text).toContain('23120000800011438001');
    expect(text).toContain('00083');
    expect(text).toContain('5614681810235717');
  });

  it('shows the disbursement-account holder ИНН, not the borrower ИНН (third-party account guard)', () => {
    const c = mockCaseDoc({
      borrower: { inn: '301456789' } as unknown as never,
      disbursement: { holderInn: '200242936' } as unknown as never,
    });
    const text = flattenDocText(disbursementTemplate(c));

    expect(c.borrower?.inn).not.toBe(c.disbursement?.holderInn);
    expect(text).toContain('200242936');
    expect(text).not.toContain('301456789');
  });

  it('never crashes when disbursement is null — account block shows "—", no datetime leak', () => {
    const c = mockCaseDoc({ disbursement: null as unknown as never });
    const text = flattenDocText(disbursementTemplate(c));

    expect(text).toContain('—');
    expect(text).not.toContain('undefined');
    expect(text).not.toContain('NaN');
    expect(text).not.toContain('GMT');
    expect(text).not.toMatch(/\d\d:\d\d:\d\d/);
  });
});
