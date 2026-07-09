import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { dateToUzbekWords } from '../../../common/sum-to-words.util';
import { CaseDocData } from '../case-document.loader';
import { orgHeader, kv, kvTable, docTitle } from '../doc-layout';
import { amountWords } from './_shared';

const VERDICT_LABEL: Record<string, string> = {
  APPROVED: 'Маъқулланди',
  REVIEW: 'Кредит қўмитаси қарорига хавола',
  REJECTED: 'Рад этилди',
};

/** Score отчет — the underwriting scoring summary (faithful Cyrillic transcription). */
export function scoreReportTemplate(c: CaseDocData): TDocumentDefinitions {
  const line = c.creditLine;
  const b = c.borrower;
  const s = c.scoring;
  const amount = Number(line?.amountTotal ?? c.amount ?? 0);
  const term = line?.termMonths ?? 60;
  const ratePct = line?.interestRate != null ? Math.round(Number(line.interestRate) * 100) : 55;
  const activity = [b?.entrepreneurType, b?.entrepreneurCertNo].filter(Boolean).join(' № ') || '—';
  const OK = 'Талабларга мос келади';

  return {
    defaultStyle: { font: 'Roboto', fontSize: 10 },
    pageMargins: [45, 50, 45, 50],
    content: [
      orgHeader(c.organization),
      docTitle('СКОРИНГ ТАҲЛИЛ НАТИЖАЛАРИ', dateToUzbekWords(s?.computedAt ?? new Date())),
      kvTable([
        kv('МИЖОЗ Ф.И.Ш.', b?.fullName ?? '—'),
        kv('Манзил', b?.regAddress ?? b?.address ?? '—'),
        kv('Фаолият тури', activity),
        kv('Кредит тури', 'Микромолия линия'),
        kv('Микромолия линияси лимити', `${amountWords(amount)} сўм`),
        kv('Микромолия линияси муддати', `${term} ой`),
        kv('Фоиз ставкаси', `${ratePct}% фоиз`),
      ]),
      { text: 'Скоринг натижаси:', bold: true, margin: [0, 12, 0, 6] },
      kvTable([
        kv('Умумий шартларга (сумма, муддати, фоиз ставка)', OK),
        kv('Гаровга қўйилган талаблар', OK),
        kv('Даромадларнинг етарлилиги', OK),
        kv('Муаммоли кредитлар', OK),
        kv('Жорий мажбуриятлари', OK),
        kv('Ёшга мувофиқлиги', s?.age != null ? `${s.age} — ${OK}` : OK),
        kv('Скоринг балл', s ? `${s.totalScore} / ${s.maxScore}` : '—'),
      ], 250),
      { text: `ХУЛОСА: ${s ? (VERDICT_LABEL[String(s.verdict)] ?? String(s.verdict)) : '—'}`, bold: true, fontSize: 11, margin: [0, 12, 0, 0] },
      { text: '\nКредит менежери имзоси ______________', margin: [0, 16, 0, 0] },
    ],
  };
}
