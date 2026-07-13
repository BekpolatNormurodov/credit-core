import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { dateToUzbekWords } from '../../../common/sum-to-words.util';
import { CaseDocData } from '../case-document.loader';
import { orgHeader, docTitle, kv, kvTable, money } from '../doc-layout';

/**
 * Дело обложкаси — the dossier cover sheet: a one-page summary of the case's key identifiers so
 * the paper file can be found/filed at a glance. Every value is null-safe ('—' when missing).
 */
export function obloshkaTemplate(c: CaseDocData): TDocumentDefinitions {
  const b = c.borrower;
  const line = c.creditLine;
  const contractNo = c.contractNumber ?? c.number ?? '—';
  const passport = [b?.passportSeries, b?.passportNumber].filter(Boolean).join(' ') || '—';
  const loanTypeText = line?.loanType === 'MICROCREDIT' ? 'Микрокредит' : 'Микроқарз';
  const termText = line?.termMonths != null ? `${line.termMonths} ой` : '—';
  const rateText = line?.interestRate != null ? `${Math.round(Number(line.interestRate) * 100)}%` : '—';
  const dateText = line?.lineDate ? dateToUzbekWords(line.lineDate) : '—';
  const collateralTotal = c.collaterals.reduce((sum, col) => sum + Number(col.agreedValue ?? 0), 0);

  return {
    defaultStyle: { font: 'Roboto', fontSize: 10 },
    pageMargins: [45, 50, 45, 50],
    content: [
      orgHeader(c.organization),
      docTitle('МИКРОМОЛИЯ ЛИНИЯСИ ИШИ — ОБЛОЖКА'),
      kvTable([
        kv('Иш/шартнома рақами', String(contractNo)),
        kv('Филиал', c.branch?.name ?? '—'),
        kv('Мижоз Ф.И.Ш.', b?.fullName ?? '—'),
        kv('Паспорт', passport),
        kv('ЖШШИР', b?.pinfl ?? '—'),
        kv('Манзил', b?.regAddress ?? b?.address ?? '—'),
        kv('Кредит тури', loanTypeText),
        kv('Лимит суммаси', money(line?.amountTotal ?? c.amount)),
        kv('Муддати', termText),
        kv('Фоиз ставкаси', rateText),
        kv('Гаровлар сони', String(c.collaterals.length)),
        kv('Гаров умумий қиймати', money(collateralTotal)),
        kv('Сана', dateText),
      ]),
    ],
  };
}
