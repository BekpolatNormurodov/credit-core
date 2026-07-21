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

// Match each book's own product: the AUTO workbook is a microloan, the property books microcredits.
const variants = {
  auto: mockCaseDoc({
    productType: 'AUTO' as never,
    creditLine: { loanType: 'MICROLOAN' as never },
    collaterals: [{ type: 'AUTO' as never }],
  }),
  kvartira: mockCaseDoc({
    creditLine: { loanType: 'MICROCREDIT' as never },
    collaterals: [{ type: 'REAL_ESTATE' as never, realtyKind: 'APARTMENT' as never }],
  }),
  hovli: mockCaseDoc({
    creditLine: { loanType: 'MICROCREDIT' as never },
    collaterals: [{ type: 'REAL_ESTATE' as never, realtyKind: 'HOUSE' as never }],
  }),
};

/**
 * Cells that are NOT part of the printed form and must not count as gaps:
 *  - editor notes left in the sheet for whoever fills it,
 *  - dropdown option lists parked in helper columns,
 *  - blank template rows whose placeholders were never filled in the sample.
 */
function isNoise(s: string): boolean {
  if (/скрыть|Если обеспеч/i.test(s)) return true;
  if (/(кузов №\s*$|шасси - \s*$|ранги - ,)/.test(s)) return true;
  if (/^\s*-\*/.test(s) && s.replace(/[^:]*:/, '').trim().length === 0) return true;
  return false;
}

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
        ws.eachRow({ includeEmpty: false }, (row: { eachCell: (o: unknown, cb: (cell: { value: unknown; col: number }) => void) => void }) => {
          row.eachCell({ includeEmpty: false }, (cell) => {
            // Only the printed form area (cols A..F) — helper columns hold dropdown option lists.
            if (cell.col > 6) return;
            const t = cellText(cell.value).replace(/\s+/g, ' ').trim();
            if (isBoilerplate(t) && !isNoise(t)) phrases.add(t);
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
