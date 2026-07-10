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

/** Tex-passport text values are printed ALL-CAPS, but OCR reads the security-pattern background as
 *  lowercase word-junk right after the real value ("DAMAS wn ee yuri" / "YENGIL SEDAN iis Aa"). Keep
 *  the leading run of upper-case code tokens and stop at the first token that isn't one. */
const cleanPhrase = (s: string, max = 10): string => {
  const out: string[] = [];
  for (const t of s.split(/\s+/)) {
    if (!/^[A-Z0-9][A-Z0-9'.\-]*$/.test(t)) break; // first lowercase / symbol token → stop
    out.push(t);
    if (out.length >= max) break;
  }
  return out.join(' ').trim();
};

/** Uppercase alphanumerics only (plate, VIN, engine no) — drops spaces, dots and stray punctuation. */
const alnum = (s: string): string => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Join leading alnum tokens (code-like) up to `max` chars. OCR splits a plate/VIN/engine number with
 *  a space ("F8CB191 160056") and appends background garbage after it ("… RAGA POT"); this rejoins the
 *  real code and stops before the garbage by length. */
const joinCode = (s: string, max: number): string => {
  let out = '';
  for (const t of s.split(/\s+/)) {
    const a = alnum(t);
    if (!a) continue;
    if (out.length + a.length > max) break;
    out += a;
  }
  return out;
};

/** Merge the numbered fields from several OCR passes — per field keep the value with the most
 *  alphanumeric content. Different passes/thresholds recover different fields, so the union beats
 *  any single pass. */
export function mergeFields(maps: Array<Map<number, string>>): Map<number, string> {
  const out = new Map<number, string>();
  const score = (v: string) => (v.match(/[A-Za-z0-9]/g) || []).length;
  for (const m of maps) for (const [k, v] of m) {
    const cur = out.get(k);
    if (!cur || score(v) > score(cur)) out.set(k, v);
  }
  return out;
}

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

/** Read numbered fields "N. value" out of OCR text into a map of number → value (first wins). A line
 *  with no number is a continuation of the current TEXT field (1..7) — owner/address wrap across lines
 *  — appended when it has letters (later cleanPhrase trims any background junk). */
export function numberedFields(text: string): Map<number, string> {
  const out = new Map<number, string>();
  let current: number | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(FIELD_LINE);
    if (m) {
      const n = Number(m[1]);
      if (n >= 1 && n <= 19) { current = n; if (!out.has(n)) out.set(n, squish(m[2])); }
      else current = null;
    } else if (current != null && current <= 7 && /[A-Za-z]/.test(line)) {
      out.set(current, squish(`${out.get(current) ?? ''} ${line}`));
    }
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

/** A clean Uzbek plate anywhere on the front: 2 digits, a letter, 3 digits, 2 letters (70U922DB,
 *  10Z310GB). Only a clean match returns — a garbled OCR read stays empty rather than filling junk. */
export function findPlate(text: string): string {
  const m = text.toUpperCase().replace(/\s+/g, ' ').match(/\b(\d{2}\s?[A-Z]\s?\d{3}\s?[A-Z]{2})\b/);
  return m ? alnum(m[1]) : '';
}

/** A real VIN never contains I, O or Q (they'd be confused with 1/0/0), so OCR reading one of those
 *  is a misread — map it back. Only touch a 17-char VIN so a short/garbled read isn't altered. */
const normalizeVin = (s: string): string =>
  s.length === 17 ? s.replace(/I/g, '1').replace(/[OQ]/g, '0') : s;

/** Split field 11 "XWB7T12YDLP165062 / RAKAMSIZ" into { bodyNo, chassis }. */
function splitVin(raw: string): { bodyNo: string; chassis: string } {
  const parts = raw.split('/').map((p) => p.trim()).filter(Boolean);
  const isNumberless = (s: string) => /RAKAMSIZ|РАКАМСИЗ|RAQAMSIZ/i.test(s);
  const body = parts.find((p) => !isNumberless(p)) ?? '';
  const chassisPart = parts.find((p) => isNumberless(p));
  return { bodyNo: joinCode(body, 17), chassis: chassisPart ? squish(chassisPart) : '' };
}

/** Build the result from already-merged numbered fields (+ the raw texts, for the un-numbered series). */
export function extractTexFromFields(
  front: Map<number, string>, back: Map<number, string>, frontText: string, backText: string,
): TexScanResult {
  const f = emptyFields();

  // Only confident fields are emitted; a garbled read leaves the field empty for manual entry (better
  // than filling a wrong value). `letters()` requires the value to start with a letter — drops OCR
  // digit-junk like "00 BELODIMCHATIY" (OQ misread) or a numeric body-type.
  const letters = (s: string): string => (/^[A-Za-z]/.test(s) ? s : '');
  // OCR reads the very common white colour "OQ" as "00" / "0Q" / "O0" — fix that leading token.
  const fixColor = (s: string): string => s.replace(/^(00|0O|O0|0Q|Q0)\b/i, 'OQ');

  // Plate: ONLY a clean Uzbek plate-format match — no garbage fallback (was surfacing "EE" etc.).
  f.stateNumber = findPlate(frontText);
  if (front.get(2)) f.model = letters(cleanPhrase(front.get(2)!, 3));
  if (front.get(3)) f.color = letters(fixColor(cleanPhrase(front.get(3)!, 3)));
  if (front.get(4)) f.ownerName = letters(cleanPhrase(front.get(4)!));
  if (front.get(5)) f.address = letters(cleanPhrase(front.get(5)!, 14));
  if (front.get(6)) f.techPassportDate = texDateToIso(front.get(6)!);
  if (front.get(7)) f.issuer = letters(cleanPhrase(front.get(7)!));

  // Year: field 9, or field 8 (a common "9"→"8" OCR misread), or the smallest standalone year in the
  // back text (manufacture year is older than the inspection date, e.g. 2019 vs 2025-11-05).
  f.year = parseYear(back.get(9) ?? '') ?? parseYear(back.get(8) ?? '') ?? (() => {
    const years = (backText.match(/\b(19|20)\d{2}\b/g) ?? []).map(Number).filter((y) => y >= 1980 && y <= 2035);
    return years.length ? Math.min(...years) : null;
  })();
  if (back.get(10)) f.bodyType = letters(cleanPhrase(back.get(10)!, 3));
  // VIN only when it's a full-length code (≥11); a short/garbled read is dropped.
  if (back.get(11)) { const v = splitVin(back.get(11)!); const vin = normalizeVin(v.bodyNo); if (vin.length >= 11) f.bodyNo = vin; f.chassis = v.chassis; }
  // Engine only when it's a reasonable code length (≥8).
  if (back.get(14)) { const e = joinCode(back.get(14)!, 15); if (e.length >= 8) f.engineNo = e; }

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

/** Parse a tex passport's front + back OCR text into the collateral fields + a confidence score. */
export function extractTexFields(frontText: string, backText: string): TexScanResult {
  return extractTexFromFields(numberedFields(frontText), numberedFields(backText), frontText, backText);
}
