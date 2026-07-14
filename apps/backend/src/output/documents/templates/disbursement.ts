import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { sumToWordsUz } from '../../../common/sum-to-words.util';
import { CaseDocData } from '../case-document.loader';
import { orgHeader, docTitle, money, kv, kvTable } from '../doc-layout';
import { p } from './_shared';

/**
 * Пул ўтказиш аризаси (disbursement application) — the borrower's letter asking the org to
 * transfer the contracted microloan to a bank account/card. The destination account may belong
 * to a third party (not the borrower) — all requisites come from `DisbursementDetail`, never
 * from `Borrower.inn`.
 */
export function disbursementTemplate(c: CaseDocData): TDocumentDefinitions {
  const b = c.borrower;
  const d = c.disbursement;
  const amount = Number(c.creditLine?.amountTotal ?? c.amount ?? 0);

  return {
    defaultStyle: { font: 'Roboto', fontSize: 10 },
    pageMargins: [45, 50, 45, 50],
    content: [
      orgHeader(c.organization),
      {
        stack: [
          { text: `«${c.organization?.nameMixed ?? 'ММТ'}»` },
          { text: 'Ижрочи директори' },
          { text: `${c.organization?.directorFull ?? '—'}га` },
        ],
        alignment: 'right',
        margin: [0, 0, 0, 12],
      },
      p(`${b?.regAddress ?? b?.address ?? '—'}да яшовчи ${b?.fullName ?? '—'}дан`),
      docTitle('АРИЗА'),
      p(
        `Ушбу ариза билан мен ${b?.fullName ?? '—'}, сиздан «${c.organization?.nameMixed ?? 'ММТ'}» билан имзоланган № ${c.contractNumber ?? c.number} сонли Микроқарз Шартномасига асосан ${money(amount)} (${amount ? sumToWordsUz(amount) : '—'}) микроқарзни қуйидаги ҳисоб рақамга ўтказиб беришингизни сўрайман.`,
      ),
      kvTable([
        kv('Ҳисоб рақами (Х/Р)', d?.accountNumber ?? '—'),
        kv('МФО', d?.bankMfo ?? '—'),
        kv('ИНН', d?.holderInn ?? '—'),
        kv('Карта рақами', d?.cardNumber ?? '—'),
        kv('Ҳисоб эгаси', d?.holderName ?? '—'),
        kv('Банк', d?.bankName ?? '—'),
      ]),
      {
        columns: [
          { width: '*', text: `${b?.fullName ?? '—'}   ______________   ____________` },
        ],
        margin: [0, 22, 0, 0],
      },
      {
        columns: [
          { width: '*', text: 'Ф.И.Ш.', alignment: 'left', fontSize: 8, color: '#555' },
          { width: '*', text: 'Имзо', alignment: 'center', fontSize: 8, color: '#555' },
          { width: '*', text: 'Сана', alignment: 'right', fontSize: 8, color: '#555' },
        ],
        margin: [0, 2, 0, 0],
      },
    ],
  };
}
