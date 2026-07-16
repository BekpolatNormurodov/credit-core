import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { moneyWithWordsCyr } from '../../../common/sum-to-words.util';
import { CaseDocData } from '../case-document.loader';
import { DOC_DEFAULT_STYLE, DOC_PAGE_MARGINS } from '../doc-layout';
import { wordsCyr } from './_shared';

/** Cyrillic label for the pledged-asset (garov) portion, driven by the case's actual collateral(s). */
function collateralPortionLabel(c: CaseDocData): string {
  const types = new Set((c.collaterals ?? []).map((x) => x.type));
  if (types.size === 0) return c.productType === 'AUTO' ? 'Автотранспорт қисми' : 'Мол-мулк қисми';
  if (types.size > 1) return 'Гаров (мол-мулк ва автотранспорт) қисми';
  return types.has('AUTO') ? 'Автотранспорт қисми' : 'Мол-мулк қисми';
}

/** 16-digit card → "0000 0000 0000 0000"; any other length is left as-is. */
function groupCard(n: string | null | undefined): string {
  if (!n) return '—';
  const digits = n.replace(/\D/g, '');
  return digits.length === 16 ? digits.replace(/(.{4})/g, '$1 ').trim() : n;
}

/**
 * Маблағ тақсимоти (Бухгалтерия учун) — the accountant-facing breakdown of a credit line: the total,
 * the garov-backed portion (labelled per the actual collateral type) and the insurance portion, plus
 * the beneficiary requisites.
 *
 * There is no reference sheet for this form (it is ours), so it follows the plain-line layout of the
 * set rather than introducing tables. Every value is null-safe.
 */
export function accountantSplitTemplate(c: CaseDocData): TDocumentDefinitions {
  const org = c.organization;
  const line = c.creditLine;
  const d = c.disbursement;
  const total = line?.amountTotal ?? c.amount ?? null;
  const collateralPart = line?.amountAuto ?? null;
  const insurancePart = line?.amountPolis ?? null;
  const term = line?.termMonths ?? null;
  const loanTypeLabel =
    line?.loanType === 'MICROCREDIT' ? 'Микрокредит' : line?.loanType === 'MICROLOAN' ? 'Микроқарз' : '—';

  const heading = (t: string, top = 10): Content => ({ text: t, bold: true, fontSize: 11, margin: [0, top, 0, 3] });
  const line_ = (label: string, value: string): Content => ({ text: `${label}: ${value}`, margin: [0, 2, 0, 0] });

  return {
    defaultStyle: DOC_DEFAULT_STYLE,
    pageMargins: DOC_PAGE_MARGINS,
    content: [
      { text: org?.nameUpper ?? 'ММТ', bold: true, alignment: 'center' },
      { text: 'МАБЛАҒ ТАҚСИМОТИ (Бухгалтерия учун)', bold: true, alignment: 'center', fontSize: 12, margin: [0, 4, 0, 2] },
      { text: `Иш № ${c.contractNumber ?? c.number ?? '—'}`, alignment: 'center', color: '#444', fontSize: 9, margin: [0, 0, 0, 8] },

      heading('Умумий маълумотлар', 2),
      line_('Қарз олувчи', c.borrower?.fullName ?? '—'),
      line_('Шартнома рақами', String(c.contractNumber ?? c.number ?? '—')),
      line_('Кредит линияси', line?.lineNumber ?? '—'),
      line_('Кредит тури', loanTypeLabel),
      line_('Муддат', term != null ? `${term} (${wordsCyr(term)}) ой` : '—'),

      heading('Маблағ тақсимоти'),
      line_('Кредит суммаси (жами)', moneyWithWordsCyr(total)),
      line_(collateralPortionLabel(c), moneyWithWordsCyr(collateralPart)),
      line_('Суғурта қисми', moneyWithWordsCyr(insurancePart)),

      heading('Тўлов реквизитлари'),
      line_('Ҳисоб эгаси', d?.holderName ?? '—'),
      line_('Карта рақами', groupCard(d?.cardNumber)),
      line_('Ҳисоб рақами (Х/Р)', d?.accountNumber ?? '—'),
      line_('МФО', d?.bankMfo ?? '—'),
      line_('ИНН', d?.holderInn ?? '—'),
      line_('Банк', d?.bankName ?? '—'),

      {
        columns: [
          { width: '*', stack: [{ text: 'Бош бухгалтер' }, { text: '\n_______________' }] },
          { width: '*', stack: [{ text: 'Ижрочи директори' }, { text: `\n_______________ ${org?.directorShort ?? '—'}` }] },
        ],
        columnGap: 24,
        margin: [0, 30, 0, 0],
      },
    ],
  };
}
