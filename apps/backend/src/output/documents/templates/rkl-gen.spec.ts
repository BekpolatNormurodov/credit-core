import { mockCaseDoc, flattenDocText } from '../__fixtures__/case-doc.fixture';
import { rklGenTemplate } from './rkl-gen';

describe('rklGenTemplate', () => {
  it('renders the real term/rate/penalty for a fully-populated credit line', () => {
    const c = mockCaseDoc();
    const text = flattenDocText(rklGenTemplate(c));

    expect(text).toContain('24 ой');
    expect(text).toContain('55%');
    expect(text).toContain('105%');
  });

  it('never fabricates a default 60-month/55%/105% term when the credit line lacks them', () => {
    const c = mockCaseDoc({
      creditLine: {
        interestRate: null as unknown as never,
        penaltyRate: null as unknown as never,
        termMonths: null as unknown as never,
      },
    });
    const text = flattenDocText(rklGenTemplate(c));

    // The old bug hardcoded term=60/rate=55%/penalty=105% regardless of data.
    expect(text).not.toContain('60 ой');
    expect(text).not.toContain('55%');
    expect(text).not.toContain('105%');
    expect(text).toContain('—');
  });

  it('drives the insurance premium clause from the real insurance rate, never a hardcoded 2%', () => {
    const c = mockCaseDoc({
      creditLine: { insurance: { premium: null as unknown as never, insuranceRate: 0.03 as unknown as never } },
    });
    const text = flattenDocText(rklGenTemplate(c));

    expect(text).toContain('3%');
    expect(text).not.toContain('йилига 2%');
  });

  it('omits the premium rate literal (never fabricates 2%) when neither premium nor rate is known', () => {
    const c = mockCaseDoc({
      creditLine: { insurance: { premium: null as unknown as never, insuranceRate: null as unknown as never } },
    });
    const text = flattenDocText(rklGenTemplate(c));

    expect(text).not.toContain('2%');
    expect(text).not.toContain('йилига 2%');
  });
});
