import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { dateToUzbekWords } from '../../../common/sum-to-words.util';
import { CaseDocData } from '../case-document.loader';
import { orgHeader, kv, kvTable, docTitle, money } from '../doc-layout';
import { amountWords } from './_shared';

/** The 5 real ScoringVerdict enum values — never guess/alias these. */
const VERDICT_LABEL: Record<string, string> = {
  APPROVED: 'Маъқулланди',
  REFER_COMMITTEE: 'Кредит қўмитаси қарорига ҳавола',
  BELOW_MIN: 'Минимал баллдан паст',
  FAILED_INCOME: 'Даромад етарли эмас',
  FAILED_PROBLEM_LOANS: 'Муаммоли кредитлар мавжуд',
};

/** Score отчет — the underwriting scoring summary (faithful Cyrillic transcription). */
export function scoreReportTemplate(c: CaseDocData): TDocumentDefinitions {
  const line = c.creditLine;
  const b = c.borrower;
  const s = c.scoring;
  const history = c.creditHistory;
  const amount = Number(line?.amountTotal ?? c.amount ?? 0);
  const termText = line?.termMonths != null ? `${line.termMonths} ой` : '—';
  const ratePctText = line?.interestRate != null ? `${Math.round(Number(line.interestRate) * 100)}% фоиз` : '—';
  const activity = [b?.entrepreneurType, b?.entrepreneurCertNo].filter(Boolean).join(' № ') || '—';

  // --- Гаров таъминоти: collateral coverage vs. the credit-line amount actually secured. ---
  const collateralTotal = c.collaterals.reduce((sum, col) => sum + Number(col.agreedValue ?? 0), 0);
  const collateralBase = Number(line?.amountAuto ?? line?.amountTotal ?? amount ?? 0);
  const collateralText = collateralBase
    ? `${money(collateralTotal)} (${Math.round((collateralTotal / collateralBase) * 100)}%)`
    : '—';

  // --- Даромад етарлилиги: net cashflow after debt service, from scoring or affordability. ---
  const netAfterDebtRaw = s?.netAfterDebt ?? c.affordability?.netAfterDebt;
  const netAfterDebt = netAfterDebtRaw != null ? Number(netAfterDebtRaw) : null;
  const incomeText = netAfterDebt == null ? '—' : `${money(netAfterDebt)} — ${netAfterDebt >= 0 ? 'Етарли' : 'Етарли эмас'}`;

  // --- Муаммоли кредитлар: overdue/substandard flag from the credit-bureau snapshot. ---
  const overdueFlag = history?.overdueSubstandardFlag;
  const problemLoansText =
    history == null ? '—' : `${!overdueFlag ? 'Йўқ' : 'Бор'}${history.priorMfiPawnshopFlag ? ` (аввалги МЧТ/гаровхона: ${history.priorMfiPawnshopFlag})` : ''}`;

  // --- Жорий мажбуриятлари: active loan count. ---
  const activeLoansText = `${history?.activeLoansCount ?? '—'} та актив кредит`;

  // --- Ёшга мувофиқлиги: 18–68 eligibility window. ---
  const age = s?.age;
  const ageText = age == null ? '—' : `${age} — ${age >= 18 && age <= 68 ? 'Мос' : 'Мос эмас'}`;

  const clientBlock: Content[] = [
    orgHeader(c.organization),
    docTitle('СКОРИНГ ТАҲЛИЛ НАТИЖАЛАРИ', dateToUzbekWords(s?.computedAt ?? new Date())),
    kvTable([
      kv('МИЖОЗ Ф.И.Ш.', b?.fullName ?? '—'),
      kv('Манзил', b?.regAddress ?? b?.address ?? '—'),
      kv('Фаолият тури', activity),
      kv('Кредит тури', 'Микромолия линия'),
      kv('Микромолия линияси лимити', `${amountWords(amount)} сўм`),
      kv('Микромолия линияси муддати', termText),
      kv('Фоиз ставкаси', ratePctText),
    ]),
  ];

  if (!s) {
    return {
      defaultStyle: { font: 'Roboto', fontSize: 10 },
      pageMargins: [45, 50, 45, 50],
      content: [
        ...clientBlock,
        { text: 'Скоринг ҳисобланмаган', bold: true, fontSize: 11, margin: [0, 12, 0, 0] },
        { text: '\nКредит менежери имзоси ______________', margin: [0, 16, 0, 0] },
      ],
    };
  }

  const factorRows = [...(s.factors ?? [])]
    .sort((f1, f2) => f1.factorNo - f2.factorNo)
    .map((f) => kv(`№${f.factorNo}. ${f.name}`, `${f.points} / ${f.maxPoints}`));

  return {
    defaultStyle: { font: 'Roboto', fontSize: 10 },
    pageMargins: [45, 50, 45, 50],
    content: [
      ...clientBlock,
      { text: 'Скоринг натижаси:', bold: true, margin: [0, 12, 0, 6] },
      kvTable([
        kv('Умумий шартларга (сумма, муддати, фоиз ставка)', `${amountWords(amount)} сўм, ${termText}, ${ratePctText}`),
        kv('Гаровга қўйилган талаблар', collateralText),
        kv('Даромадларнинг етарлилиги', incomeText),
        kv('Муаммоли кредитлар', problemLoansText),
        kv('Жорий мажбуриятлари', activeLoansText),
        kv('Ёшга мувофиқлиги', ageText),
        kv('Скоринг балл', `${s.totalScore} / ${s.maxScore}`),
      ], 250),
      ...(factorRows.length
        ? ([{ text: 'Скоринг омиллари:', bold: true, margin: [0, 12, 0, 6] }, kvTable(factorRows, 300)] as Content[])
        : []),
      { text: `ХУЛОСА: ${VERDICT_LABEL[String(s.verdict)] ?? String(s.verdict)}`, bold: true, fontSize: 11, margin: [0, 12, 0, 0] },
      { text: '\nКредит менежери имзоси ______________', margin: [0, 16, 0, 0] },
    ],
  };
}
