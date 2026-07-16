/**
 * Glyph sanitiser for generated PDFs.
 *
 * Uzbek text (both our seeds and real operator-entered data) commonly uses the modifier letters
 * `ʻ` U+02BB / `ʼ` U+02BC for the o‘/g‘ apostrophe. Roboto — the only font embedded in the PDFs —
 * has NO glyph for them, so they render as empty tofu boxes ("sugʻurta" → "sug urta"). Map them onto
 * U+2019 (’), which Roboto does have and which is visually the intended mark.
 *
 * Applied once, centrally, to the whole document definition right before rendering, so every
 * template and every value coming out of the database is covered.
 */

const TOFU = /[ʻʼʽʾʿ]/g;
const REPLACEMENT = '’'; // ’

/** Replace font-less modifier letters in a single string. */
export function sanitizeText(s: string): string {
  return s.replace(TOFU, REPLACEMENT);
}

/**
 * Deep-copy a pdfmake document definition (or any value) with every string sanitised.
 * Non-string leaves (numbers, booleans, null, Date, Buffer) are passed through untouched.
 */
export function sanitizeDocDefinition<T>(value: T): T {
  return walk(value) as T;
}

function walk(v: unknown): unknown {
  if (typeof v === 'string') return sanitizeText(v);
  if (v == null || typeof v !== 'object') return v;
  if (v instanceof Date || Buffer.isBuffer(v)) return v;
  if (Array.isArray(v)) return v.map(walk);
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = walk(val);
  return out;
}
