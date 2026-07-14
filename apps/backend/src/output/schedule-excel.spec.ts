import * as ExcelJS from 'exceljs';
import { mockCaseDoc } from './documents/__fixtures__/case-doc.fixture';
import { exportScheduleToExcel } from './excel-export.util';

/** Flatten every cell value in a worksheet into a single array for easy assertions. */
function allCellValues(ws: ExcelJS.Worksheet): unknown[] {
  const out: unknown[] = [];
  ws.eachRow((row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      out.push(cell.value);
    });
  });
  return out;
}

describe('exportScheduleToExcel', () => {
  it('renders the График sheet with header, installment rows, and a totals row', async () => {
    const c = mockCaseDoc();
    const buffer = await exportScheduleToExcel(c);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);

    const ws = wb.getWorksheet('График');
    expect(ws).toBeDefined();

    const values = allCellValues(ws!);
    expect(values).toContain('Asosiy qarz');
    expect(values).toContain('JAMI');
  });

  it('never leaks a raw Date object or a GMT-formatted string into any cell', async () => {
    const c = mockCaseDoc();
    const buffer = await exportScheduleToExcel(c);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const ws = wb.getWorksheet('График')!;

    ws.eachRow((row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        expect(cell.value instanceof Date).toBe(false);
        if (typeof cell.value === 'string') {
          expect(cell.value).not.toContain('GMT');
        }
      });
    });
  });

  it('recomputes the schedule live when nothing is persisted (regenerates from tranche/line params)', async () => {
    const c = mockCaseDoc({ creditLine: { tranches: [{ schedule: null }] as any } });

    const buffer = await exportScheduleToExcel(c);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);

    const ws = wb.getWorksheet('График')!;
    const values = allCellValues(ws);
    expect(values).toContain('JAMI');
    expect(values).not.toContain("To'lov jadvali hisoblanmagan");
  });

  it('returns the guard workbook (no crash) when inputs are insufficient', async () => {
    const c = mockCaseDoc({ creditLine: null as any, amount: null as any, termMonths: null as any });

    const buffer = await exportScheduleToExcel(c);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);

    const ws = wb.getWorksheet('График');
    expect(ws).toBeDefined();
    const values = allCellValues(ws!);
    expect(values).toContain("To'lov jadvali hisoblanmagan");
  });
});
