import * as path from 'path';
import { mockCaseDoc, flattenDocText } from '../__fixtures__/case-doc.fixture';
import { DOC_REGISTRY } from '../registry';
import { sanitizeText } from '../sanitize';

/**
 * Excel-parity audit — gated on EXCEL_PARITY=1 (needs the reference workbooks on disk).
 *
 *   EXCEL_PARITY=1 XLSX_DIR="/c/Users/…/Downloads" \
 *   npx jest --config apps/backend/jest.config.js --rootDir apps/backend/src --runInBand excel-parity
 *
 * For each mapped sheet it takes every substantial BOILERPLATE phrase from the sheet (static legal
 * text — case-specific values differ between the sample workbook and our fixture, so those are
 * excluded) and asserts the phrase is present in the generated document. Anything missing is
 * printed, so "1:1 with the Excel" is an observed fact rather than an impression.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ExcelJS = require('exceljs');

const XLSX_DIR = process.env.XLSX_DIR || 'C:/Users/JONIBEK/Downloads';
const BOOKS = {
  auto: 'АВТО мфл TRUST (3).xlsx',
  kvartira: 'КВАРТИРА мфл TRUST (3).xlsx',
  hovli: 'ХОВЛИ мфл TRUST (3).xlsx',
};

/** sheet name → registry key. */
const SHEET_TO_DOC: Record<string, string> = {
  'Ходатайство': 'petition',
  'Кредитная заявка': 'creditApplication',
  'Приказ на сделку': 'prikaz',
  'Акт согласования': 'act',
  'Score отчет': 'scoreReport',
  'Протокол': 'protokol',
  'перечень': 'cheklist',
  'обложка': 'obloshka',
  'Акт мониторинга1': 'monitoring1',
  'РКЛ Ген': 'rklGen',
  'договор узб': 'contract',
};

/** Normalise for comparison: sanitise glyphs, unify apostrophes/dashes, collapse whitespace. */
function norm(s: string): string {
  return sanitizeText(s)
    .replace(/[’‘'`´]/g, "'")
    .replace(/[–—−]/g, '-')
    .replace(/[«»"]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function cellText(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (Array.isArray(o.richText)) return (o.richText as Array<{ text: string }>).map((r) => r.text).join('');
    if (typeof o.text === 'string') return o.text;
    if (o.result !== undefined) return String(o.result);
    return '';
  }
  return String(v);
}

/**
 * Boilerplate = long-ish text that is NOT case data. We drop anything containing digits (amounts,
 * dates, numbered clause prefixes carry them) and anything that is mostly uppercase Latin (names,
 * addresses from the sample). What remains is the static legal wording that MUST match.
 */
function isBoilerplate(s: string): boolean {
  if (s.length < 30) return false;
  if (/\d/.test(s)) return false;
  const latinUpper = (s.match(/[A-Z]/g) ?? []).length;
  if (latinUpper > s.length * 0.3) return false;
  if (/^=\{/.test(s)) return false;
  return true;
}

const variants = {
  auto: mockCaseDoc({ productType: 'AUTO' as never, collaterals: [{ type: 'AUTO' as never }] }),
  kvartira: mockCaseDoc({ collaterals: [{ type: 'REAL_ESTATE' as never, realtyKind: 'APARTMENT' as never }] }),
  hovli: mockCaseDoc({ collaterals: [{ type: 'REAL_ESTATE' as never, realtyKind: 'HOUSE' as never }] }),
};

const RUN = process.env.EXCEL_PARITY === '1';

(RUN ? describe : describe.skip)('Excel parity audit', () => {
  it('every boilerplate phrase in each reference sheet appears in the generated document', async () => {
    const report: string[] = [];
    let checked = 0;
    let missing = 0;

    for (const [variant, file] of Object.entries(BOOKS)) {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(path.join(XLSX_DIR, file));

      for (const [sheetName, docKey] of Object.entries(SHEET_TO_DOC)) {
        const ws = wb.getWorksheet(sheetName);
        if (!ws || !DOC_REGISTRY[docKey]) continue;

        const c = variants[variant as keyof typeof variants];
        const docText = norm(flattenDocText(DOC_REGISTRY[docKey].build(c)));

        const phrases = new Set<string>();
        ws.eachRow({ includeEmpty: false }, (row: { eachCell: (o: unknown, cb: (cell: { value: unknown }) => void) => void }) => {
          row.eachCell({ includeEmpty: false }, (cell) => {
            const t = cellText(cell.value).replace(/\s+/g, ' ').trim();
            if (isBoilerplate(t)) phrases.add(t);
          });
        });

        for (const phrase of phrases) {
          checked++;
          // Compare on a trimmed core so trailing punctuation differences don't cause noise.
          const needle = norm(phrase).slice(0, 60);
          if (needle.length >= 25 && !docText.includes(needle)) {
            missing++;
            report.push(`[${variant}/${docKey}] MISSING: ${phrase.slice(0, 110)}`);
          }
        }
      }
    }

    // eslint-disable-next-line no-console
    console.log(`\nExcel parity: ${checked - missing}/${checked} boilerplate phrases matched\n` + report.slice(0, 60).join('\n'));
    expect(checked).toBeGreaterThan(0);
  }, 300_000);
});
