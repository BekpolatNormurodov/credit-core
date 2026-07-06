/** Pure extractors for Uzbek ID cards — label-anchored OCR of the printed (VIZ) text. */
import type { PassportScanResult } from '@credit-core/shared';

export interface IdFrontFields {
  fullName: string;
  issueDate: string | null;
  nationality: string;
  birthDate: string | null;
  expiryDate: string | null;
  cardNumber: string;
}

export interface IdBackViz {
  placeOfBirth: string;
  issuer: string;
}

/** "21.01.2025" or "15 06 2017" → ISO at UTC midnight, or null. (ID uses dots; passport uses spaces.) */
export function ddmmyyyyToIso(s: string | null | undefined): string | null {
  const m = (s ?? '').match(/(\d{2})[.\s\-/](\d{2})[.\s\-/](\d{4})/);
  if (!m) return null;
  const dd = +m[1], mm = +m[2], yyyy = +m[3];
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return new Date(Date.UTC(yyyy, mm - 1, dd)).toISOString();
}

const NAME = /^[A-Z][A-Z'`‘’-]{3,29}$/; // a single uppercase name token (≥4 chars, drops OCR noise)

/** Lines with whitespace collapsed; blank lines dropped. */
function lines(text: string): string[] {
  return text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

/** Index of the first line whose UPPERCASE contains any keyword; -1 if none. */
function labelIdx(ls: string[], keywords: string[]): number {
  const up = ls.map((l) => l.toUpperCase());
  for (let i = 0; i < up.length; i++) if (keywords.some((k) => up[i].includes(k))) return i;
  return -1;
}

/** The first following token (after the label line) matching `ok`, within `span` lines. */
function valueAfter(ls: string[], keywords: string[], ok: (s: string) => boolean, span = 2): string {
  const i = labelIdx(ls, keywords);
  if (i < 0) return '';
  for (let j = i + 1; j <= i + span && j < ls.length; j++) {
    for (const tok of ls[j].split(' ')) if (ok(tok)) return tok;
  }
  return '';
}

/** First dd.mm.yyyy on/after a label line. */
function dateAfter(ls: string[], keywords: string[], span = 2): string | null {
  const i = labelIdx(ls, keywords);
  if (i < 0) return null;
  for (let j = i; j <= i + span && j < ls.length; j++) {
    const iso = ddmmyyyyToIso(ls[j]);
    if (iso) return iso;
  }
  return null;
}

/**
 * Extract surname / given / patronymic. The bilingual labels ("Familiyasi / Surname") OCR poorly
 * (some drop out entirely), so instead exploit the layout: the three NAME values sit between the
 * "GUVOHNOMASI" header and the "Date of birth" row, each on its own line, and — unlike the label
 * lines — a value line has no "/" or "|" separator. From each such line take the longest all-caps
 * token (≥4 chars, drops noise like "EER"/label words). Returns up to three names in order.
 */
function extractNames(ls: string[]): string[] {
  const upper = ls.map((l) => l.toUpperCase());
  const start = upper.findIndex((l) => l.includes('GUVOHNOMASI') || l.includes('IDENTITY'));
  const from = start >= 0 ? start + 1 : 0;
  let end = upper.findIndex((l, i) => i >= from && (l.includes('DATE OF BIRTH') || l.includes('TUGILGAN SANASI')));
  if (end < 0) end = ls.length;
  const names: string[] = [];
  for (let i = from; i < end && names.length < 3; i++) {
    if (ls[i].includes('/') || ls[i].includes('|')) continue; // a label line, not a value
    const toks = ls[i].split(' ').filter((t) => NAME.test(t)).sort((a, b) => b.length - a.length);
    if (toks.length) names.push(toks[0]);
  }
  return names;
}

export function extractIdFront(text: string): IdFrontFields {
  const ls = lines(text);
  const fullName = extractNames(ls).join(' ');
  const cardNumber = valueAfter(ls, ['CARD NUMBER', 'KARTA RAQAMI'], (t) => /^[A-Z]{2}\d{7}$/.test(t));
  return {
    fullName,
    issueDate: dateAfter(ls, ['DATE OF ISSUE', 'BERILGAN SANASI']),
    nationality: valueAfter(ls, ['CITIZENSHIP', 'FUQAROLIGI'], (t) => /ZBEKISTON/.test(t.toUpperCase())),
    birthDate: dateAfter(ls, ['DATE OF BIRTH', 'TUGILGAN SANASI']),
    expiryDate: dateAfter(ls, ['DATE OF EXPIRY', 'AMAL QILISH']),
    cardNumber,
  };
}

/** Keep only ALL-CAPS words, dropping mixed-case OCR noise + punctuation:
 *  "Re Al QORAKO'L TUMANI :" → "QORAKO'L TUMANI". */
function capsPhrase(s: string): string {
  return s.split(/\s+/).filter((t) => /^[A-Z][A-Z'`‘’]+$/.test(t)).join(' ');
}

export function extractIdBackViz(text: string): IdBackViz {
  const ls = lines(text);
  const after = (kw: string[]) => {
    const i = labelIdx(ls, kw);
    return i >= 0 && i + 1 < ls.length ? ls[i + 1] : '';
  };
  // Anchor on the single stable label word — "of birth" OCRs as "ofvbirth", "Place" as "Plage" —
  // so match just BIRTH / ISSUE (the back has no other such rows). If the label is too garbled,
  // fall back to the line carrying an Uzbek place suffix (…TUMANI / SHAHRI / VILOYATI).
  let placeOfBirth = capsPhrase(after(['BIRTH', 'TUGILGAN']));
  if (!placeOfBirth) {
    const suffix = /(TUMANI|TUMAN|SHAHRI|SHAHAR|VILOYATI|QISHLOG)/;
    for (const l of ls) {
      const c = capsPhrase(l);
      if (suffix.test(c)) { placeOfBirth = c; break; }
    }
  }
  // Issuer looks like "IIV 6230" (agency code + number). UZ codes are IIV / IIB, but OCR mangles the
  // letters (IIV→HV/NV, II→H). Take the code+number from the issue line and normalize by the trailing
  // agency letter: V → IIV, B → IIB. No code+number at all → blank rather than garbage.
  const m = after(['ISSUE', 'BERILGAN']).toUpperCase().match(/([A-Z]{1,4})\s?(\d{3,5})/);
  let issuer = '';
  if (m) {
    const code = m[1].endsWith('V') ? 'IIV' : m[1].endsWith('B') ? 'IIB' : m[1];
    issuer = `${code} ${m[2]}`;
  }
  return { placeOfBirth, issuer };
}

/**
 * Merge the check-digit-verified back MRZ with OCR'd front/back text. MRZ wins for the verified
 * numbers; name + issue date + place of birth/issue come from OCR and are named in
 * `unverifiedFields`. A front/back date disagreement adds a `front_back_mismatch` warning.
 */
export function mergeIdResult(back: PassportScanResult, front: IdFrontFields, viz: IdBackViz): PassportScanResult {
  const unverified: string[] = [];
  const fields = { ...back.fields };
  if (front.fullName) { fields.fullName = front.fullName; unverified.push('fullName'); }
  if (front.issueDate) { fields.passportIssueDate = front.issueDate; unverified.push('passportIssueDate'); }
  if (viz.placeOfBirth) { fields.placeOfBirth = viz.placeOfBirth; unverified.push('placeOfBirth'); }
  if (viz.issuer) { fields.passportIssuer = viz.issuer; unverified.push('passportIssuer'); }
  const warnings = [...back.warnings];
  const mismatch = (a: string | null | undefined, b: string | null) => !!a && !!b && a !== b;
  if (mismatch(front.birthDate, back.fields.birthDate) || mismatch(front.expiryDate, back.fields.passportExpiry)) {
    if (!warnings.includes('front_back_mismatch')) warnings.push('front_back_mismatch');
  }
  return { ...back, fields, warnings, docType: 'ID', unverifiedFields: unverified };
}

export interface PassportViz {
  placeOfBirth: string;
  issueDate: string | null;
  issuer: string;
}

/**
 * Passport visible page (VIZ) — the MRZ carries none of these, so read them from the printed fields:
 * place of birth, date of issue, and the issuing authority. All are OCR (no check digit) → the
 * caller flags them unverified.
 */
export function extractPassportViz(text: string): PassportViz {
  const ls = lines(text);
  // Place of birth: the first line carrying an Uzbek place suffix (…TUMANI/SHAHRI/VILOYATI). It
  // prints above the issuer authority, so first-match wins (digits/labels are dropped by capsPhrase).
  const suffix = /(TUMANI|TUMAN|SHAHRI|SHAHAR|VILOYATI|QISHLOG)/;
  let placeOfBirth = '';
  for (const l of ls) { const c = capsPhrase(l); if (suffix.test(c)) { placeOfBirth = c; break; } }
  // Issuer: the authority after "KIM TOMONIDAN BERILGAN" / "ORGANI" / "AUTHORITY", spanning up to two
  // lines (e.g. "BUXORO VILOYATI QORAKUL TUMANI IIB"). Best-effort; flagged unverified.
  const ai = labelIdx(ls, ['TOMONIDAN', 'ORGANI', 'AUTHOR']);
  let issuer = ai >= 0 ? capsPhrase([ls[ai + 1], ls[ai + 2]].filter(Boolean).join(' ')) : '';
  // The authority ends at its office suffix (…IIB / …IIV); drop trailing OCR garbage after it.
  const cut = issuer.match(/^(.*\bII[BV])\b/);
  if (cut) issuer = cut[1];
  return {
    placeOfBirth,
    issueDate: dateAfter(ls, ['DATE OF ISSUE', 'BERILGAN SANASI']),
    issuer,
  };
}
