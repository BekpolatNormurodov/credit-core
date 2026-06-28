import * as ExcelJS from 'exceljs';
import { ImportParseResult, ProductType } from '@credit-core/shared';

type Cell = { row: number; col: number; text: string };

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (typeof value === 'object') {
    const v = value as unknown as Record<string, unknown>;
    if ('text' in v && typeof v.text === 'string') return v.text;
    if ('result' in v) return String(v.result ?? '');
    if ('richText' in v && Array.isArray(v.richText)) {
      return (v.richText as { text: string }[]).map((r) => r.text).join('');
    }
    if (value instanceof Date) return value.toISOString();
  }
  return String(value).trim();
}

/** Flatten every non-empty cell across all sheets into a grid we can scan. */
function collectCells(wb: ExcelJS.Workbook): Map<string, Cell[]> {
  const bySheet = new Map<string, Cell[]>();
  wb.eachSheet((ws) => {
    const cells: Cell[] = [];
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const text = cellText(cell.value).trim();
        if (text) cells.push({ row: rowNumber, col: colNumber, text });
      });
    });
    bySheet.set(ws.name, cells);
  });
  return bySheet;
}

/** Find the value adjacent to a label cell (right, left, or below). */
function findByLabel(sheets: Map<string, Cell[]>, keywords: string[]): string | null {
  const kws = keywords.map((k) => k.toLowerCase());
  for (const cells of sheets.values()) {
    const label = cells.find((c) => kws.some((k) => c.text.toLowerCase().includes(k)));
    if (!label) continue;
    // Prefer the nearest non-empty neighbour that is NOT itself a label match.
    const neighbours = [
      cells.find((c) => c.row === label.row && c.col === label.col + 1),
      cells.find((c) => c.row === label.row && c.col === label.col - 1),
      cells.find((c) => c.row === label.row + 1 && c.col === label.col),
    ].filter((c): c is Cell => !!c && c.text !== label.text && c.text.length > 0);
    if (neighbours.length) return neighbours[0].text;
  }
  return null;
}

function toNumber(s: string | null): number | null {
  if (!s) return null;
  const cleaned = s.replace(/\s/g, '').replace(/[^\d,.\-]/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function borrowerNameFromFile(fileName: string): string {
  return fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[_\-]+/g, ' ')
    .trim();
}

/**
 * Parse a credit-case .xlsx into a prefilled real-estate payload.
 * Label-based scan → resilient to row/column shifts between templates.
 */
export async function parseRealEstateWorkbook(
  buffer: Buffer,
  fileName: string,
): Promise<ImportParseResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheets = collectCells(wb);
  const warnings: string[] = [];

  const get = (kw: string[]) => findByLabel(sheets, kw);

  const address = get(['адрес недвижимости', 'адрес', 'manzil']);
  const registryNo = get(['реестр', 'reestr']);
  const propertyType = get(['вид имущества', 'вид имущество']);
  const cadastreNo = get(['кадастр', 'kadastr']);
  const totalAreaM2 = toNumber(get(['общая площадь', 'umumiy maydon']));
  const livingAreaM2 = toNumber(get(['жилая площадь', 'yashash maydon']));
  const roomNames = get(['хоналар номи', 'хонал']);
  const roomCount = toNumber(get(['хоналар сони', 'комнат']));
  const agreedValue = toNumber(get(['согласованная залоговая стоимость', 'залоговая стоимость']));
  const agreedValueWords = get(['прописью']);

  const borrowerName = get(['ф.и.о', 'фио', 'заёмщик', 'заемщик']) ?? borrowerNameFromFile(fileName);
  if (!address) warnings.push('Manzil topilmadi — qo‘lda kiriting');
  if (!agreedValue) warnings.push('Garov qiymati topilmadi — qo‘lda kiriting');

  return {
    amount: agreedValue,
    borrower: { fullName: borrowerName },
    collateral: {
      type: ProductType.REAL_ESTATE,
      address: address ?? '',
      registryNo,
      propertyType,
      cadastreNo,
      totalAreaM2,
      livingAreaM2,
      roomNames,
      roomCount: roomCount != null ? Math.round(roomCount) : null,
      agreedValue,
      agreedValueWords,
      owners: [],
    },
    warnings,
  };
}
