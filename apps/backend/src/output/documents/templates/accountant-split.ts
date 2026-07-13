import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { sumToWordsUz } from '../../../common/sum-to-words.util';
import { CaseDocData } from '../case-document.loader';
import { orgHeader, docTitle, kv, kvTable, money } from '../doc-layout';

/**
 * Маблағ тақсимоти — the accountant-facing amount split of a credit line: the total, the
 * collateral-backed (мол-мулк) portion, and the insurance-backed portion, shown as amounts
 * (not percentages), plus the total spelled out in words. Every value is null-safe.
 */
export function accountantSplitTemplate(c: CaseDocData): TDocumentDefinitions {
  const line = c.creditLine;
  const totalRaw = line?.amountTotal ?? c.amount;
  const total = totalRaw != null ? Number(totalRaw) : null;
  const insuranceAmountRaw = line?.insurance?.insuredSum ?? (line?.amountPolis != null ? Number(line.amountPolis) * 1.3 : null);
  const totalWords = total != null ? sumToWordsUz(total) : '—';

  return {
    defaultStyle: { font: 'Roboto', fontSize: 10 },
    pageMargins: [45, 50, 45, 50],
    content: [
      orgHeader(c.organization),
      docTitle('МАБЛАҒ ТАҚСИМОТИ (Бухгалтерия учун)', `Иш № ${c.contractNumber ?? c.number ?? '—'}`),
      kvTable(
        [
          kv('Кредит суммаси', money(total)),
          kv('Мол-мулк қисми', money(line?.amountAuto)),
          kv('Суғурта суммаси', money(insuranceAmountRaw)),
          kv('Сумма (ёзувда)', totalWords),
        ],
        220,
      ),
    ],
  };
}
