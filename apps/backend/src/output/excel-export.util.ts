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
  const re = c.realEstate;
  const rows: [string, string | number | null][] = [
    ['Ish raqami', c.number],
    ['Filial', c.branch ? `${c.branch.name} (${c.branch.symbol})` : ''],
    ['Holat', c.status],
    ['Qarz oluvchi', c.borrower?.fullName ?? ''],
    ['Pasport', [c.borrower?.passportSeries, c.borrower?.passportNumber].filter(Boolean).join(' ')],
    ['PINFL', c.borrower?.pinfl ?? ''],
    ['Manzil', re?.address ?? ''],
    ['Reestr №', re?.registryNo ?? ''],
    ['Kadastr №', re?.cadastreNo ?? ''],
    ['Mulk turi', re?.propertyType ?? ''],
    ['Umumiy maydon (m²)', re?.totalAreaM2 ?? null],
    ['Yashash maydoni (m²)', re?.livingAreaM2 ?? null],
    ['Xonalar nomi', re?.roomNames ?? ''],
    ['Xonalar soni', re?.roomCount ?? null],
    ['Kredit summasi', c.amount ?? null],
    ['Muddat (oy)', c.termMonths ?? null],
    ['KATM narxi', c.katmPrice ?? null],
    ['Kelishilgan garov qiymati', re?.agreedValue ?? null],
    ['Prописью', re?.agreedValueWords ?? ''],
  ];
  rows.forEach(([k, v]) => ws.addRow({ k, v }));
  ws.getRow(1).font = { bold: true };
  ws.getColumn('k').font = { bold: true };

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
