import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { sumToWordsUz } from '../../../common/sum-to-words.util';
import { CaseDocData } from '../case-document.loader';
import { orgHeader, docTitle, kv, kvTable, money, signatures } from '../doc-layout';

/** Cyrillic label for the pledged-asset (garov) portion, driven by the case's actual collateral(s). */
function collateralPortionLabel(c: CaseDocData): string {
  const types = new Set((c.collaterals ?? []).map((x) => x.type));
  if (types.size === 0) return c.productType === 'AUTO' ? 'Автотранспорт қисми' : 'Мол-мулк қисми';
  if (types.size > 1) return 'Гаров (мол-мулк ва автотранспорт) қисми';
  return types.has('AUTO') ? 'Автотранспорт қисми' : 'Мол-мулк қисми';
}

/** 16-digit card → "0000 0000 0000 0000"; any other length is left as-is (already masked / partial). */
function groupCard(n: string | null | undefined): string {
  if (!n) return '—';
  const digits = n.replace(/\D/g, '');
  return digits.length === 16 ? digits.replace(/(.{4})/g, '$1 ').trim() : n;
}

/**
 * Маблағ тақсимоти (Бухгалтерия учун) — the accountant-facing breakdown of a credit line:
 *  • Умумий маълумотлар — borrower, contract №, credit-line №, loan type, term.
 *  • Маблағ тақсимоти    — total, the garov-backed portion (labelled Автотранспорт / Мол-мулк per the
 *                          actual collateral), the insurance portion, and the total spelled in words.
 *  • Тўлов реквизитлари   — the beneficiary card / account requisites (from DisbursementDetail).
 * Every value is null-safe — a missing field renders "—", never NaN.
 */
export function accountantSplitTemplate(c: CaseDocData): TDocumentDefinitions {
  const line = c.creditLine;
  const d = c.disbursement;
  const total = line?.amountTotal != null ? Number(line.amountTotal) : c.amount != null ? Number(c.amount) : null;
  const collateralPart = line?.amountAuto != null ? Number(line.amountAuto) : null;
  const insurancePart = line?.amountPolis != null ? Number(line.amountPolis) : null;
  const totalWords = total != null ? sumToWordsUz(total) : '—';
  const loanTypeLabel =
    line?.loanType === 'MICROCREDIT' ? 'Микрокредит' : line?.loanType === 'MICROLOAN' ? 'Микроқарз' : '—';

  const heading = (t: string, top = 10): Content => ({ text: t, bold: true, fontSize: 11, margin: [0, top, 0, 4] });

  const content: Content[] = [
    orgHeader(c.organization),
    docTitle('МАБЛАҒ ТАҚСИМОТИ (Бухгалтерия учун)', `Иш № ${c.contractNumber ?? c.number ?? '—'}`),

    heading('Умумий маълумотлар', 2),
    kvTable([
      kv('Қарз олувчи', c.borrower?.fullName ?? '—'),
      kv('Шартнома рақами', c.contractNumber ?? c.number ?? '—'),
      kv('Кредит линияси', line?.lineNumber ?? '—'),
      kv('Кредит тури', loanTypeLabel),
      kv('Муддат', line?.termMonths != null ? `${line.termMonths} ой` : '—'),
    ]),

    heading('Маблағ тақсимоти'),
    kvTable([
      kv('Кредит суммаси (жами)', money(total)),
      kv(collateralPortionLabel(c), money(collateralPart)),
      kv('Суғурта қисми', money(insurancePart)),
      kv('Сумма (ёзувда)', totalWords),
    ]),

    heading('Тўлов реквизитлари'),
    kvTable([
      kv('Ҳисоб эгаси', d?.holderName ?? '—'),
      kv('Карта рақами', groupCard(d?.cardNumber)),
      kv('Ҳисоб рақами (Х/Р)', d?.accountNumber ?? '—'),
      kv('МФО', d?.bankMfo ?? '—'),
      kv('ИНН', d?.holderInn ?? '—'),
      kv('Банк', d?.bankName ?? '—'),
    ]),

    signatures(['Бош бухгалтер'], ['Ижрочи директор']),
  ];

  return {
    defaultStyle: { font: 'Roboto', fontSize: 10 },
    pageMargins: [45, 50, 45, 50],
    content,
  };
}
