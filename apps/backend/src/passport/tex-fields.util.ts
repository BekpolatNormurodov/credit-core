import type { TexScanResult } from '@credit-core/shared';

/**
 * Parse an Uzbek vehicle-registration certificate (tex passport) from OCR text into AUTO-collateral
 * fields. Unlike the passport there is no MRZ, so the printed side carries numbered fields (1..19):
 *
 *   Front: 1 plate · 2 model · 3 colour · 4 owner · 5 address · 6 issue date · 7 issuer · 8 reg no
 *   Back:  9 year · 10 body type · 11 VIN/chassis · 12/13 weights · 14 engine no · 15..19 misc
 *
 * The certificate series (e.g. "VL8011449" / "AA9747835B") sits in a top corner and is not numbered,
 * so it is picked up by a token pattern. Everything here is best-effort OCR — no check digits.
 */

type TexFields = TexScanResult['fields'];

const emptyFields = (): TexFields => ({
  stateNumber: '', model: '', color: '', ownerName: '', address: '',
  techPassportDate: null, issuer: '', year: null, bodyType: '',
  bodyNo: '', chassis: '', engineNo: '', techPassportNo: '',
});

/** Collapse whitespace and trim. */
const squish = (s: string): string => s.replace(/\s+/g, ' ').trim();

/** Uppercase alphanumerics only (plate, VIN, engine no) — drops spaces, dots and stray punctuation. */
const alnum = (s: string): string => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** First whitespace-delimited token, alnum-cleaned. OCR appends garbage tokens from the busy
 *  background after the real value ("7QUB2208 oe" → "7QUB2208"); the identity fields are the 1st token. */
const firstAlnum = (s: string): string => alnum((s.trim().split(/\s+/)[0] ?? ''));

/** dd.mm.yyyy | dd/mm/yyyy | yyyy-mm-dd → ISO (yyyy-mm-dd), or null. */
export function texDateToIso(raw: string): string | null {
  const dmy = raw.match(/(\d{2})[.,\s\-/]+(\d{2})[.,\s\-/]+(\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  const ymd = raw.match(/(\d{4})[.,\s\-/]+(\d{2})[.,\s\-/]+(\d{2})/);
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
  return null;
}

/** A 4-digit manufacture year in a sane range, or null. */
function parseYear(raw: string): number | null {
  const m = raw.match(/\b(19\d{2}|20\d{2})\b/);
  if (!m) return null;
  const y = Number(m[1]);
  return y >= 1950 && y <= 2100 ? y : null;
}

// A numbered field on a line: "N. value". OCR reads the card's security-pattern background as text,
// so the number is rarely at the line start (it gets garbage prefixed) and the dot is often a comma
// or colon. Match the number ANYWHERE on the line, and accept . , ) : as the separator.
const FIELD_LINE = /(?:^|[^\dA-Za-z])(\d{1,2})\s*[.,):]\s*(\S.+)$/;

/** Read numbered fields "N. value" out of OCR text into a map of number → value (first wins). */
export function numberedFields(text: string): Map<number, string> {
  const out = new Map<number, string>();
  for (const raw of text.split(/\r?\n/)) {
    const m = raw.match(FIELD_LINE);
    if (!m) continue;
    const n = Number(m[1]);
    if (n >= 1 && n <= 19 && !out.has(n)) out.set(n, squish(m[2]));
  }
  return out;
}

/** Count numbered fields in OCR text — used to pick the best orientation. */
export function countFields(text: string): number {
  return numberedFields(text).size;
}

/** The certificate series/number, e.g. "VL8011449" or "AA9747835B" (2 letters + 6-9 digits + opt letter). */
export function findSeries(text: string): string {
  const m = text.toUpperCase().replace(/\s+/g, ' ').match(/\b([A-Z]{2}\s?\d{6,9}[A-Z]?)\b/);
  return m ? alnum(m[1]) : '';
}

/** Split field 11 "XWB7T12YDLP165062 / RAKAMSIZ" into { bodyNo, chassis }. */
function splitVin(raw: string): { bodyNo: string; chassis: string } {
  const parts = raw.split('/').map((p) => p.trim()).filter(Boolean);
  const isNumberless = (s: string) => /RAKAMSIZ|РАКАМСИЗ|RAQAMSIZ/i.test(s);
  const body = parts.find((p) => !isNumberless(p)) ?? '';
  const chassisPart = parts.find((p) => isNumberless(p));
  return { bodyNo: firstAlnum(body), chassis: chassisPart ? squish(chassisPart) : '' };
}

/** Parse a tex passport's front + back OCR text into the collateral fields + a confidence score. */
export function extractTexFields(frontText: string, backText: string): TexScanResult {
  const f = emptyFields();
  const front = numberedFields(frontText);
  const back = numberedFields(backText);

  // Identity fields are the 1st token (drops OCR background garbage); text fields keep the phrase.
  if (front.get(1)) f.stateNumber = firstAlnum(front.get(1)!);
  if (front.get(2)) f.model = squish(front.get(2)!);
  if (front.get(3)) f.color = squish(front.get(3)!);
  if (front.get(4)) f.ownerName = squish(front.get(4)!);
  if (front.get(5)) f.address = squish(front.get(5)!);
  if (front.get(6)) f.techPassportDate = texDateToIso(front.get(6)!);
  if (front.get(7)) f.issuer = squish(front.get(7)!);

  if (back.get(9)) f.year = parseYear(back.get(9)!);
  if (back.get(10)) f.bodyType = squish(back.get(10)!);
  if (back.get(11)) { const v = splitVin(back.get(11)!); f.bodyNo = v.bodyNo; f.chassis = v.chassis; }
  if (back.get(14)) f.engineNo = firstAlnum(back.get(14)!);

  // Series is not numbered — search the back first (it prints there), then the front.
  f.techPassportNo = findSeries(backText) || findSeries(frontText);

  // Confidence = share of the key vehicle fields that came through.
  const key = [f.stateNumber, f.model, f.year != null ? 'y' : '', f.bodyNo, f.engineNo, f.color];
  const got = key.filter(Boolean).length;
  const confidence = Math.round((got / key.length) * 100);

  const perField = Object.entries(f)
    .filter(([, v]) => v !== '' && v != null)
    .map(([key, v]) => ({ key, value: String(v) }));

  const warnings: string[] = [];
  if (got === 0) warnings.push('tex_not_found');
  else if (confidence < 50) warnings.push('low_confidence');
  if (!back.size) warnings.push('back_not_found');

  return { confidence, fields: f, perField, warnings };
}
