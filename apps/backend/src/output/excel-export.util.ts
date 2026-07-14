import * as ExcelJS from 'exceljs';
import { CreditCaseDto, CreditCaseListItem, PRODUCT_LABEL, STATUS_LABEL } from '@credit-core/shared';
import { dateToUzbekWords } from '../common/sum-to-words.util';
import type { CaseDocData } from './documents/case-document.loader';

/** Export the full case list (role-scoped) into one .xlsx table. */
export async function exportCasesListToExcel(rows: CreditCaseListItem[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Arizalar');
  ws.columns = [
    { header: '№', key: 'number', width: 18 },
    { header: 'Qarz oluvchi', key: 'borrower', width: 28 },
    { header: 'Mahsulot', key: 'product', width: 22 },
    { header: 'Filial', key: 'branch', width: 12 },
    { header: 'Holat', key: 'status', width: 18 },
    { header: "Summa (so'm)", key: 'amount', width: 18 },
    { header: 'Yangilangan', key: 'updated', width: 20 },
  ];
  rows.forEach((c) =>
    ws.addRow({
      number: c.number,
      borrower: c.borrowerName ?? '—',
      product: PRODUCT_LABEL[c.productType],
      branch: c.branchSymbol ?? '—',
      status: STATUS_LABEL[c.status],
      amount: c.amount ?? null,
      updated: new Date(c.updatedAt).toLocaleString('ru-RU'),
    }),
  );
  ws.getRow(1).font = { bold: true };
  ws.getColumn('amount').numFmt = '#,##0';
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = 'A1:G1';
  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

/** Export a case into a simple .xlsx (key/value), matching the source template layout. */
export async function exportCaseToExcel(c: CreditCaseDto): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Garov');
  ws.columns = [
    { header: 'Maydon', key: 'k', width: 36 },
    { header: 'Qiymat', key: 'v', width: 50 },
  ];
  const rows: [string, string | number | null][] = [
    ['Ariza raqami', c.number],
    ['Filial', c.branch ? `${c.branch.name} (${c.branch.symbol})` : ''],
    ['Holat', c.status],
    ['Qarz oluvchi', c.borrower?.fullName ?? ''],
    ['Pasport', [c.borrower?.passportSeries, c.borrower?.passportNumber].filter(Boolean).join(' ')],
    ['PINFL', c.borrower?.pinfl ?? ''],
    ['Kredit summasi', c.amount ?? null],
    ['Muddat (oy)', c.termMonths ?? null],
    ['KATM narxi', c.katmPrice ?? null],
    ['Garovlar soni', c.collaterals.length],
  ];
  c.collaterals.forEach((col, i) => {
    const n = i + 1;
    if (col.type === 'AUTO') {
      rows.push(
        [`Garov ${n} turi`, 'Avtotransport'],
        [`Garov ${n} model`, col.model ?? ''],
        [`Garov ${n} davlat raqami`, col.stateNumber ?? ''],
        [`Garov ${n} tex passport`, col.techPassportNo ?? ''],
        [`Garov ${n} rang/yil`, `${col.color ?? ''} ${col.year ?? ''}`],
        [`Garov ${n} qiymati`, col.agreedValue ?? null],
      );
    } else {
      rows.push(
        [`Garov ${n} turi`, 'Uy-joy'],
        [`Garov ${n} manzil`, col.address ?? ''],
        [`Garov ${n} kadastr №`, col.cadastreNo ?? ''],
        [`Garov ${n} maydon (m²)`, col.totalAreaM2 ?? null],
        [`Garov ${n} xonalar`, col.roomNames ?? ''],
        [`Garov ${n} qiymati`, col.agreedValue ?? null],
      );
    }
  });
  rows.forEach(([k, v]) => ws.addRow({ k, v }));
  ws.getRow(1).font = { bold: true };
  ws.getColumn('k').font = { bold: true };

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

const SCHEDULE_HEADER = ['№', 'To‘lov sanasi', 'Boshlang‘ich qoldiq', 'Asosiy qarz', 'Foiz', 'Jami', 'Kunlar'];

/** Export a tranche's payment schedule (Grafik) into a .xlsx (summary + installment table). */
export async function exportScheduleToExcel(c: CaseDocData): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('График');
  const sched = c.creditLine?.tranches?.[0]?.schedule ?? null;

  ws.addRow(['Asosiy summa', sched ? Number(sched.principal) : '—']);
  ws.addRow(['Muddat', sched ? `${sched.termMonths} oy` : '—']);
  ws.addRow(['Yillik foiz', sched ? `${Math.round(Number(sched.annualRate) * 100)}%` : '—']);
  ws.addRow(['Berish sanasi', sched?.disbursementDate ? dateToUzbekWords(sched.disbursementDate) : '—']);
  ws.addRow(['Usul', sched ? (sched.method === 'DIFFERENTIATED' ? 'Differensial' : 'Annuitet') : '—']);
  ws.addRow([]);

  if (!sched || !sched.installments?.length) {
    ws.addRow(["To'lov jadvali hisoblanmagan"]);
    const out = await wb.xlsx.writeBuffer();
    return Buffer.from(out);
  }

  const installments = [...sched.installments].sort((a, b) => a.seq - b.seq);

  const headerRow = ws.addRow(SCHEDULE_HEADER);
  headerRow.font = { bold: true };

  installments.forEach((i) => {
    const row = ws.addRow([
      i.seq,
      dateToUzbekWords(i.dueDate),
      Number(i.openingBalance),
      Number(i.principal),
      Number(i.interest),
      Number(i.total),
      i.days,
    ]);
    row.getCell(3).numFmt = '#,##0';
    row.getCell(4).numFmt = '#,##0';
    row.getCell(5).numFmt = '#,##0';
    row.getCell(6).numFmt = '#,##0';
  });

  const totalPrincipal = installments.reduce((sum, i) => sum + Number(i.principal ?? 0), 0);
  const totalInterest = installments.reduce((sum, i) => sum + Number(i.interest ?? 0), 0);
  const totalAmount = installments.reduce((sum, i) => sum + Number(i.total ?? 0), 0);

  const totalsRow = ws.addRow(['', 'JAMI', '', totalPrincipal, totalInterest, totalAmount, '']);
  totalsRow.font = { bold: true };
  totalsRow.getCell(4).numFmt = '#,##0';
  totalsRow.getCell(5).numFmt = '#,##0';
  totalsRow.getCell(6).numFmt = '#,##0';

  ws.columns.forEach((col) => {
    col.width = 18;
  });

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
