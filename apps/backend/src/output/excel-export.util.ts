import * as ExcelJS from 'exceljs';
import { CreditCaseDto } from '@credit-core/shared';

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
