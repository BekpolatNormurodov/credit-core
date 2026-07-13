import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { dateToUzbekWords } from '../../../common/sum-to-words.util';
import { CaseDocData } from '../case-document.loader';
import { orgHeader, docTitle, kv, kvTable, money, signatures } from '../doc-layout';

/**
 * Add `months` to `d`, clamping the day-of-month to the last day of the resulting month
 * (e.g. 31 Jan + 1 month → 28/29 Feb, not an overflowed March date). UTC-based to match
 * `dateToUzbekWords` and avoid local-timezone drift.
 */
function addMonths(d: Date, months: number): Date {
  const r = new Date(d);
  const day = r.getUTCDate();
  r.setUTCDate(1);
  r.setUTCMonth(r.getUTCMonth() + months);
  const last = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
  r.setUTCDate(Math.min(day, last));
  return r;
}

/**
 * Мониторинг далолатномаси — the collateral/borrower monitoring act. Three of these are generated
 * per case: at the application date, +6 months, and +12 months (`periodMonths` selects which).
 * The visit date is always computed off the case's application date — never `new Date()` — so the
 * document is reproducible and doesn't leak a generation timestamp. Findings sections are left
 * blank for the inspector to fill in by hand during the actual site visit.
 */
export function monitoringTemplate(c: CaseDocData, periodMonths: number): TDocumentDefinitions {
  const baseDate = c.creditLine?.tranches?.[0]?.applicationDate ?? c.creditLine?.lineDate ?? null;
  const visitDateStr = baseDate ? dateToUzbekWords(addMonths(baseDate, periodMonths)) : '—';

  const collateralTypes = c.collaterals
    .map((col) => (col.type === 'AUTO' ? 'Автотранспорт' : 'Уй-жой'))
    .join(', ') || '—';
  const collateralTotal = c.collaterals.reduce((sum, col) => sum + Number(col.agreedValue ?? 0), 0);

  return {
    defaultStyle: { font: 'Roboto', fontSize: 10 },
    pageMargins: [45, 50, 45, 50],
    content: [
      orgHeader(c.organization),
      docTitle(
        'МОНИТОРИНГ ДАЛОЛАТНОМАСИ',
        `${periodMonths === 0 ? 'Бошланғич' : periodMonths + ' ойлик'} мониторинг · ${visitDateStr}`,
      ),
      kvTable([
        kv('Мижоз Ф.И.Ш.', c.borrower?.fullName ?? '—'),
        kv('Шартнома рақами', String(c.contractNumber ?? c.number ?? '—')),
        kv('Кредит суммаси', money(c.creditLine?.amountTotal ?? c.amount)),
        kv('Гаровлар', collateralTypes),
        kv('Гаров умумий қиймати', money(collateralTotal)),
        kv('Мониторинг санаси', visitDateStr),
      ]),
      { text: 'Гаров ҳолати ва мавжудлиги: _______________________________', margin: [0, 8, 0, 4] },
      { text: 'Тўлов интизоми: _______________________________', margin: [0, 0, 0, 4] },
      { text: 'Мижоз фаолияти ҳолати: _______________________________', margin: [0, 0, 0, 4] },
      { text: 'Хулоса: _______________________________', margin: [0, 0, 0, 4] },
      signatures(['Текширувчи', '(лавозими, Ф.И.Ш.)'], ['Мижоз', c.borrower?.fullName ?? '']),
    ],
  };
}
