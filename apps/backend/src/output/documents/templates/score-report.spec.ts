import { mockCaseDoc, flattenDocText } from '../__fixtures__/case-doc.fixture';
import { scoreReportTemplate } from './score-report';

describe('scoreReportTemplate (СКОРИНГ ТАХЛИЛ НАТИЖАДАЛАРИ)', () => {
  it('renders the sheet: title, identity block and the six gates with the standard phrases', () => {
    const text = flattenDocText(scoreReportTemplate(mockCaseDoc()));

    expect(text).toContain('СКОРИНГ ТАХЛИЛ НАТИЖАДАЛАРИ');
    expect(text).toContain('МИЖОЗ Ф.И.Ш.');
    expect(text).toContain('Кредит тури');
    expect(text).toContain('Микромолия линия');
    expect(text).toContain('Скоринг натижаси:');
    // The six gates, verbatim from the sheet.
    expect(text).toContain('Умумий шартларга (сумма, муддати, фоиз ставка)');
    expect(text).toContain('Гаровга кўйилган талаблар');
    expect(text).toContain('Даромадларнинг етарлилиги');
    expect(text).toContain('Муаммоли кредитлар');
    expect(text).toContain('Жорий мажбуриятлари');
    expect(text).toContain('Ёшга мувофиқлиги');
    expect(text).toContain('Скоринг балл');
    expect(text).toContain('ХУЛОСА');
    expect(text).toContain('Кредит менежери имзоси');
  });

  it('maps the stored verdict onto the sheet\'s own ХУЛОСА wording', () => {
    const approved = flattenDocText(scoreReportTemplate(mockCaseDoc()));
    expect(approved).toContain('Маъқулланди');

    const failed = flattenDocText(scoreReportTemplate(mockCaseDoc({ scoring: { verdict: 'FAILED_INCOME' as unknown as never } })));
    expect(failed).toContain('ИНПС асосида даромадларни текшириш босқичидан ўтмади');
    expect(failed).not.toContain('Маъқулланди');
  });

  it('derives each gate from the data — never a blanket pass', () => {
    // Negative cashflow + no credit history + an under-age borrower must not all read "мос келади".
    const c = mockCaseDoc({
      scoring: { verdict: 'FAILED_INCOME' as unknown as never, netAfterDebt: -500_000 as unknown as never, age: 15 as unknown as never },
      creditHistory: null as unknown as never,
      affordability: null as unknown as never,
    });
    const text = flattenDocText(scoreReportTemplate(c));

    // B19 answers a shortfall with «мос келмайди», not the softer committee referral.
    expect(text).toContain('Талабларга мос келмайди'); // income gate
    expect(text).toContain('Кредит тарихи маълумотлари тўлдирилмаган'); // history gates
    expect(text).toContain('Талабларга мос келмайди'); // age gate
  });

  it('flags the collateral gate when coverage is below the 140% target', () => {
    // Fixture: collateral 380M vs a 150M line → covered; drop the collateral to fail the gate.
    const text = flattenDocText(scoreReportTemplate(mockCaseDoc({ collaterals: [] as unknown as never })));
    expect(text).toContain('Талабларга мос келмайди');
  });

  it('carries no factor-breakdown table (the sheet has none)', () => {
    const text = flattenDocText(scoreReportTemplate(mockCaseDoc()));
    expect(text).not.toContain('Скоринг омиллари');
    expect(text).not.toContain('Даромад барқарорлиги');
  });

  it('never fabricates a default term/rate when the credit line lacks them', () => {
    const c = mockCaseDoc({ creditLine: { interestRate: null as unknown as never, termMonths: null as unknown as never } });
    const text = flattenDocText(scoreReportTemplate(c));

    expect(text).not.toContain('55% (');
    expect(text).not.toContain('60 (');
    expect(text).toContain('—');
  });

  /*
    Was: "renders «Скоринг ҳисобланмаган» when scoring has not been computed". Nothing ever wrote
    ScoringResult, so that was every case — the report was permanently blank. The score is now
    derived from the case, the way the payment schedule is, and there is no un-scored state.
  */
  it('computes the score from the case when no result was stored', () => {
    const c = mockCaseDoc({ scoring: null as unknown as never });
    const text = flattenDocText(scoreReportTemplate(c));

    expect(text).not.toContain('Скоринг ҳисобланмаган');
    expect(text).toContain('Скоринг балл');
    // A real number, not a dash, in the score row.
    expect(text).toMatch(/Скоринг балл\s*-?\d+/);
  });
});
