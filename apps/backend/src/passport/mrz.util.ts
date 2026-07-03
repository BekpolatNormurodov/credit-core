/**
 * Pure MRZ helpers — no I/O, no OCR. The confidence score comes from the passport
 * MRZ check digits (a [7,3,1]-weighted mod-10 checksum per field), so the accuracy
 * percentage is verified arithmetic, not a guess.
 */

/** One entry from the `mrz` package's parse `details` array. */
export interface MrzDetail {
  field: string;
  value: unknown;
  valid: boolean;
}

/** MRZ field values (subset we map) from the `mrz` package's parse `fields`. */
export interface MrzFields {
  firstName?: string | null;
  lastName?: string | null;
  documentNumber?: string | null;
  birthDate?: string | null; // YYMMDD
  expirationDate?: string | null; // YYMMDD
  sex?: string | null; // 'male' | 'female' | 'M' | 'F' | ...
  personalNumber?: string | null;
}

/** Check-digit weights — the whole-MRZ composite is weighted highest. */
export const CHECK_WEIGHT: Record<string, number> = {
  compositeCheckDigit: 4,
  documentNumberCheckDigit: 3,
  birthDateCheckDigit: 2,
  expirationDateCheckDigit: 2,
  personalNumberCheckDigit: 1,
};

/** Weighted mean of the present check-digit validities → 0..100. */
export function scoreConfidence(details: MrzDetail[]): number {
  let got = 0;
  let total = 0;
  for (const d of details) {
    const w = CHECK_WEIGHT[d.field];
    if (w == null) continue;
    total += w;
    if (d.valid) got += w;
  }
  if (total === 0) return 0;
  return Math.round((got / total) * 100);
}

/** YYMMDD → ISO date at UTC midnight. `future` biases the century (expiry) vs past (birth). */
export function yymmddToIso(yymmdd: string | null | undefined, future: boolean): string | null {
  if (!yymmdd || !/^\d{6}$/.test(yymmdd)) return null;
  const yy = Number(yymmdd.slice(0, 2));
  const mm = Number(yymmdd.slice(2, 4));
  const dd = Number(yymmdd.slice(4, 6));
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const cc = new Date().getFullYear() % 100;
  // Birth is in the past; expiry is near-future (allow ~20y ahead before rolling to 1900s).
  const year = future ? (yy <= cc + 20 ? 2000 + yy : 1900 + yy) : (yy <= cc ? 2000 + yy : 1900 + yy);
  return new Date(Date.UTC(year, mm - 1, dd)).toISOString();
}

/** Map MRZ field values to the borrower form shape. */
export function mapMrzToBorrower(fields: MrzFields) {
  const clean = (s: string | null | undefined) => (s ?? '').replace(/</g, ' ').replace(/\s+/g, ' ').trim();
  const fullName = clean([fields.lastName, fields.firstName].filter(Boolean).join(' '));
  const dn = (fields.documentNumber ?? '').toUpperCase().replace(/</g, '');
  const passportSeries = dn.match(/^[A-Z]{2}/)?.[0] ?? '';
  const passportNumber = dn.replace(/^[A-Z]{2}/, '').replace(/\D/g, '').slice(0, 7);
  const sex = (fields.sex ?? '').toString().toUpperCase();
  const gender: 'MALE' | 'FEMALE' | '' = sex.startsWith('M') ? 'MALE' : sex.startsWith('F') ? 'FEMALE' : '';
  const pinflDigits = (fields.personalNumber ?? '').replace(/\D/g, '');
  return {
    fullName,
    passportSeries,
    passportNumber,
    birthDate: yymmddToIso(fields.birthDate, false),
    passportExpiry: yymmddToIso(fields.expirationDate, true),
    gender,
    pinfl: pinflDigits.length === 14 ? pinflDigits : '',
  };
}

/**
 * Pull the MRZ lines out of noisy OCR text. MRZ lines are uppercase [A-Z0-9<] of length
 * ≥28 with at least one filler '<'. Returns the trailing 2 (TD2/TD3) or 3 (TD1) lines.
 */
export function extractMrzLines(ocrText: string): string[] {
  const candidates = ocrText
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, '').toUpperCase())
    .filter((l) => l.length >= 28 && /^[A-Z0-9<]+$/.test(l) && l.includes('<'));
  if (candidates.length < 2) return candidates;
  const lastLen = candidates[candidates.length - 1].length;
  // TD1 = 3×30; TD2 = 2×36; TD3 = 2×44.
  if (lastLen >= 34) return candidates.slice(-2);
  return candidates.slice(-3);
}
