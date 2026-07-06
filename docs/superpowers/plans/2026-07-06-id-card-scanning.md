# ID-card Scanning (front + back) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Read Uzbek ID cards by uploading front + back — verified numbers from the back TD1 MRZ, name and a few fields from the clean front (and back) printed text, merged.

**Architecture:** New `POST /passport/scan-id` endpoint takes `front` + `back` images. The back is read with the existing `mrz` model (cropped to the bottom MRZ band for a clean read); the front and back printed text are read with the general `eng` model and parsed by bilingual field labels. Pure extractor/merge functions do the field logic (unit-tested with stubbed OCR text); the service only wires OCR to them.

**Tech Stack:** NestJS, `tesseract.js` (`mrz` + `eng` traineddata), `sharp`, the `mrz` npm parser, React (shared `packages/ui`), TypeScript monorepo (`@credit-core/shared`, `@credit-core/api-client`).

## Global Constraints

- Backend passport code lives in `apps/backend/src/passport`. Pure logic goes in `*.util.ts`; the service does I/O only. Tests are `*.spec.ts` beside the source (ts-jest, `rootDir: src`).
- Run backend tests with: `node ../../node_modules/jest/bin/jest.js --rootDir src --testRegex "<pattern>"` from `apps/backend` (there is no local `jest` bin). Build shared first if types changed: from `packages/shared`, `node ../../node_modules/typescript/bin/tsc -p tsconfig.json`.
- OCR is injected as `OcrFn = (image: Buffer) => Promise<string>` so pipelines are unit-testable without tesseract. Never call real tesseract in default tests.
- Real-document fixtures are PII and gitignored (`apps/backend/test-fixtures/`); traineddata is gitignored (`apps/backend/tessdata/`). Integration tests that use them are opt-in via `RUN_OCR_IT=1` and self-skip when the asset is missing.
- Confidence is the weighted MRZ check-digit score (0–100). OCR-derived fields have no check digits — never present them as verified.
- End commit messages with: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- Commit to `master` only when explicitly asked; otherwise just commit locally per task.

## File Structure

- `packages/shared/src/dto.ts` — extend `PassportScanResult` (optional ID fields, `docType`, `unverifiedFields`).
- `apps/backend/src/passport/mrz.util.ts` — map PINFL from TD1 `optional1`.
- `apps/backend/src/passport/id-fields.util.ts` — **new**: `ddmmyyyyToIso`, `extractIdFront`, `extractIdBackViz`, `mergeIdResult` (pure).
- `apps/backend/src/passport/passport.service.ts` — ID-back MRZ crop preprocessing + `scanIdCard(front, back, mrzOcr?, textOcr?)`.
- `apps/backend/src/passport/passport.module.ts` — `POST /passport/scan-id`; archive both images.
- `apps/backend/src/passport/scan-archive.ts` — allow a side suffix in the filename.
- `packages/api-client/src/index.ts` — `scanIdCard(front, back)`.
- `packages/ui/src/pages/origination/PassportScan.tsx` — Passport/ID toggle + two upload zones + extended field grid.
- `packages/ui/src/pages/origination/steps.tsx` — map new fields into the borrower form.
- `deploy/Dockerfile.backend`, `apps/backend/scripts/fetch-ocr-model.mjs` — bundle/fetch **both** `mrz` + `eng`.

---

### Task 1: Extend the shared result DTO

**Files:**
- Modify: `packages/shared/src/dto.ts:268-286`

**Interfaces:**
- Produces: `PassportScanResult.fields` gains optional `placeOfBirth?: string`, `passportIssueDate?: string | null`, `passportIssuer?: string`; result gains `docType?: 'PASSPORT' | 'ID'` and `unverifiedFields?: string[]`.

- [ ] **Step 1: Edit the interface**

In `packages/shared/src/dto.ts`, change the `PassportScanResult` interface to:

```ts
export interface PassportScanResult {
  /** 0..100 accuracy from weighted MRZ check-digit validation. */
  confidence: number;
  fields: {
    fullName: string;
    passportSeries: string;
    passportNumber: string;
    birthDate: string | null;
    passportExpiry: string | null;
    gender: 'MALE' | 'FEMALE' | '';
    nationality: string; // localized citizenship name, '' if unknown
    pinfl: string;
    // ID-card only (optional; passport results omit these):
    placeOfBirth?: string;
    passportIssueDate?: string | null; // ISO
    passportIssuer?: string;
  };
  /** Per check-digit outcome, for the UI validity chips. */
  perField: { key: string; value: string; valid: boolean }[];
  format: string; // 'TD1' | 'TD2' | 'TD3' | ''
  rawMrz: string[];
  warnings: string[]; // 'mrz_not_found' | 'low_confidence' | 'expired' | 'expiring_soon' | 'id_back_mrz_not_found' | 'front_back_mismatch'
  docType?: 'PASSPORT' | 'ID';
  /** Field keys whose values come from OCR (no check digit) → UI shows a "tekshiring" hint. */
  unverifiedFields?: string[];
}
```

- [ ] **Step 2: Build shared, verify it compiles**

Run (from `packages/shared`): `node ../../node_modules/typescript/bin/tsc -p tsconfig.json`
Expected: exit 0, `dist/dto.d.ts` updated.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/dto.ts packages/shared/dist
git commit -m "feat(shared): optional ID-card fields on PassportScanResult"
```

---

### Task 2: Map TD1 PINFL from `optional1`

The TD1 (ID) MRZ carries the 14-digit personal number in `optional1`, not `personalNumber`. `mapMrzToBorrower` currently only reads `personalNumber`, so ID PINFL is dropped.

**Files:**
- Modify: `apps/backend/src/passport/mrz.util.ts` (`MrzFields` interface ~line 16, `mapMrzToBorrower` ~line 64-83)
- Test: `apps/backend/src/passport/mrz.util.spec.ts`

**Interfaces:**
- Consumes: existing `mapMrzToBorrower(fields: MrzFields)`.
- Produces: `MrzFields` gains `optional1?: string | null`; `mapMrzToBorrower` returns `pinfl` from `personalNumber` else `optional1` (first 14-digit run).

- [ ] **Step 1: Write the failing test**

Add to `mrz.util.spec.ts` inside `describe('mapMrzToBorrower', ...)`:

```ts
it('takes PINFL from TD1 optional1 when personalNumber is absent', () => {
  const out = mapMrzToBorrower({ documentNumber: 'AE1295616', optional1: '40807841080026' });
  expect(out.pinfl).toBe('40807841080026');
  expect(out.passportSeries).toBe('AE');
  expect(out.passportNumber).toBe('1295616');
});
```

- [ ] **Step 2: Run it, verify it fails**

Run (from `apps/backend`): `node ../../node_modules/jest/bin/jest.js --rootDir src --testRegex "mrz.util.spec.ts$" -t "optional1"`
Expected: FAIL — `out.pinfl` is `''`.

- [ ] **Step 3: Implement**

In `mrz.util.ts`, add to the `MrzFields` interface:

```ts
  optional1?: string | null; // TD1 optional data line-1 (Uzbek: 14-digit PINFL)
```

In `mapMrzToBorrower`, change the PINFL line from:

```ts
  const pinflDigits = (fields.personalNumber ?? '').replace(/\D/g, '');
```

to:

```ts
  const pinflSrc = (fields.personalNumber ?? '') || (fields.optional1 ?? '');
  const pinflMatch = pinflSrc.replace(/</g, '').match(/\d{14}/);
  const pinflDigits = pinflMatch ? pinflMatch[0] : '';
```

Keep the existing `pinfl: pinflDigits.length === 14 ? pinflDigits : ''`.

- [ ] **Step 4: Run tests, verify pass**

Run: `node ../../node_modules/jest/bin/jest.js --rootDir src --testRegex "mrz.util.spec.ts$"`
Expected: PASS (all `mrz.util` tests).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/passport/mrz.util.ts apps/backend/src/passport/mrz.util.spec.ts
git commit -m "feat(passport): map TD1 PINFL from optional1"
```

---

### Task 3: Front-VIZ field extractor (pure)

**Files:**
- Create: `apps/backend/src/passport/id-fields.util.ts`
- Test: `apps/backend/src/passport/id-fields.util.spec.ts`

**Interfaces:**
- Produces:
  - `ddmmyyyyToIso(s: string): string | null` — `"21.01.2025"` → `"2025-01-21T00:00:00.000Z"`, else null.
  - `interface IdFrontFields { fullName: string; issueDate: string | null; nationality: string; birthDate: string | null; expiryDate: string | null; cardNumber: string }`
  - `extractIdFront(ocrText: string): IdFrontFields`

- [ ] **Step 1: Write the failing test**

Create `id-fields.util.spec.ts`:

```ts
import { ddmmyyyyToIso, extractIdFront } from './id-fields.util';

describe('ddmmyyyyToIso', () => {
  it('parses a dd.mm.yyyy date', () => {
    expect(ddmmyyyyToIso('21.01.2025')).toBe('2025-01-21T00:00:00.000Z');
  });
  it('rejects junk', () => {
    expect(ddmmyyyyToIso('x')).toBeNull();
    expect(ddmmyyyyToIso('40.13.2025')).toBeNull();
  });
});

describe('extractIdFront', () => {
  // Realistic noisy OCR of a UZ ID front (labels + values on following lines).
  const text = [
    "O'ZBEKISTON RESPUBLIKASI",
    'SHAXS GUVOHNOMASI',
    'Familiyasi / Surname',
    'QODIROVA',
    'Ismi / Given name(s)',
    'XOLISXON',
    'Otasining ismi / Patronymic',
    'MUXTOROVNA',
    'Tugilgan sanasi / Date of birth   Jinsi / Sex',
    '08.07.1984   AYOL',
    'Berilgan sanasi / Date of issue   Fuqaroligi / Citizenship',
    "21.01.2025   O'ZBEKISTON",
    'Amal qilish muddati / Date of expiry   Karta raqami / Card number',
    '20.01.2035   AE1295616',
  ].join('\n');

  it('joins the full name including patronymic', () => {
    expect(extractIdFront(text).fullName).toBe('QODIROVA XOLISXON MUXTOROVNA');
  });
  it('reads issue date, birth date and expiry as ISO', () => {
    const f = extractIdFront(text);
    expect(f.issueDate).toBe('2025-01-21T00:00:00.000Z');
    expect(f.birthDate).toBe('1984-07-08T00:00:00.000Z');
    expect(f.expiryDate).toBe('2035-01-20T00:00:00.000Z');
  });
  it('reads the card number', () => {
    expect(extractIdFront(text).cardNumber).toBe('AE1295616');
  });
  it('is resilient to a missing patronymic', () => {
    const noPatr = text.replace('Otasining ismi / Patronymic\nMUXTOROVNA\n', '');
    expect(extractIdFront(noPatr).fullName).toBe('QODIROVA XOLISXON');
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `node ../../node_modules/jest/bin/jest.js --rootDir src --testRegex "id-fields.util.spec.ts$"`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `id-fields.util.ts`**

```ts
/** Pure extractors for Uzbek ID cards — label-anchored OCR of the printed (VIZ) text. */

export interface IdFrontFields {
  fullName: string;
  issueDate: string | null;
  nationality: string;
  birthDate: string | null;
  expiryDate: string | null;
  cardNumber: string;
}

/** "21.01.2025" → ISO at UTC midnight, or null. */
export function ddmmyyyyToIso(s: string | null | undefined): string | null {
  const m = (s ?? '').match(/(\d{2})[.\-/](\d{2})[.\-/](\d{4})/);
  if (!m) return null;
  const dd = +m[1], mm = +m[2], yyyy = +m[3];
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return new Date(Date.UTC(yyyy, mm - 1, dd)).toISOString();
}

const NAME = /^[A-Z][A-Z'`‘’-]{1,29}$/; // a single uppercase name token

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

/** The first following line (after the label line) matching `ok`, within `span` lines. */
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

export function extractIdFront(text: string): IdFrontFields {
  const ls = lines(text);
  const surname = valueAfter(ls, ['SURNAME', 'FAMILIYASI'], (t) => NAME.test(t));
  const given = valueAfter(ls, ['GIVEN NAME', 'ISMI'], (t) => NAME.test(t));
  const patronymic = valueAfter(ls, ['PATRONYMIC', 'OTASINING'], (t) => NAME.test(t));
  const fullName = [surname, given, patronymic].filter(Boolean).join(' ');
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
```

- [ ] **Step 4: Run tests, verify pass**

Run: `node ../../node_modules/jest/bin/jest.js --rootDir src --testRegex "id-fields.util.spec.ts$"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/passport/id-fields.util.ts apps/backend/src/passport/id-fields.util.spec.ts
git commit -m "feat(passport): label-anchored ID front-VIZ extractor"
```

---

### Task 4: Back-VIZ extractor + merge (pure)

**Files:**
- Modify: `apps/backend/src/passport/id-fields.util.ts`
- Modify: `apps/backend/src/passport/id-fields.util.spec.ts`

**Interfaces:**
- Consumes: `IdFrontFields`, `PassportScanResult` (from `@credit-core/shared`).
- Produces:
  - `interface IdBackViz { placeOfBirth: string; issuer: string }`
  - `extractIdBackViz(ocrText: string): IdBackViz`
  - `mergeIdResult(back: PassportScanResult, front: IdFrontFields, viz: IdBackViz): PassportScanResult`

Merge rules: verified MRZ (`back`) wins for series/number, DOB, sex, expiry, PINFL, nationality; `fullName`/`issueDate`/`placeOfBirth`/`issuer` come from OCR and are named in `unverifiedFields`; if `front.birthDate`/`expiryDate` disagree with the MRZ value, add `front_back_mismatch`. `docType: 'ID'`.

- [ ] **Step 1: Write the failing test**

Add to `id-fields.util.spec.ts`:

```ts
import { extractIdBackViz, mergeIdResult } from './id-fields.util';
import type { PassportScanResult } from '@credit-core/shared';

const backMrz = (over: Partial<PassportScanResult['fields']> = {}): PassportScanResult => ({
  confidence: 100,
  fields: { fullName: 'QODIROVA XOLISX0O8', passportSeries: 'AE', passportNumber: '1295616', birthDate: '1984-07-08T00:00:00.000Z', passportExpiry: '2035-01-20T00:00:00.000Z', gender: 'FEMALE', nationality: "O'zbekiston Respublikasi", pinfl: '40807841080026', ...over },
  perField: [{ key: 'documentNumberCheckDigit', value: '0', valid: true }],
  format: 'TD1', rawMrz: [], warnings: [], docType: 'ID',
});

describe('extractIdBackViz', () => {
  it('reads place of birth', () => {
    const t = ['Personal number', '40807841080026', 'Place of birth', "QORAKO'L TUMANI", 'Place of issue', 'IIV 6230'].join('\n');
    expect(extractIdBackViz(t).placeOfBirth).toBe("QORAKO'L TUMANI");
  });
});

describe('mergeIdResult', () => {
  const front = { fullName: 'QODIROVA XOLISXON MUXTOROVNA', issueDate: '2025-01-21T00:00:00.000Z', nationality: '', birthDate: '1984-07-08T00:00:00.000Z', expiryDate: '2035-01-20T00:00:00.000Z', cardNumber: 'AE1295616' };
  const viz = { placeOfBirth: "QORAKO'L TUMANI", issuer: 'IIV 6230' };

  it('uses MRZ numbers and the clean front name', () => {
    const r = mergeIdResult(backMrz(), front, viz);
    expect(r.fields.fullName).toBe('QODIROVA XOLISXON MUXTOROVNA');
    expect(r.fields.pinfl).toBe('40807841080026');
    expect(r.fields.passportSeries).toBe('AE');
    expect(r.fields.placeOfBirth).toBe("QORAKO'L TUMANI");
    expect(r.fields.passportIssueDate).toBe('2025-01-21T00:00:00.000Z');
    expect(r.confidence).toBe(100);
    expect(r.docType).toBe('ID');
    expect(r.unverifiedFields).toEqual(expect.arrayContaining(['fullName', 'passportIssueDate', 'placeOfBirth']));
  });
  it('flags a front/back date mismatch', () => {
    const r = mergeIdResult(backMrz(), { ...front, birthDate: '1990-01-01T00:00:00.000Z' }, viz);
    expect(r.warnings).toContain('front_back_mismatch');
    expect(r.fields.birthDate).toBe('1984-07-08T00:00:00.000Z'); // MRZ still wins
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `node ../../node_modules/jest/bin/jest.js --rootDir src --testRegex "id-fields.util.spec.ts$" -t "mergeIdResult|extractIdBackViz"`
Expected: FAIL — functions not exported.

- [ ] **Step 3: Implement (append to `id-fields.util.ts`)**

```ts
import type { PassportScanResult } from '@credit-core/shared';

export interface IdBackViz { placeOfBirth: string; issuer: string }

export function extractIdBackViz(text: string): IdBackViz {
  const ls = lines(text);
  const after = (kw: string[]) => {
    const i = labelIdx(ls, kw);
    return i >= 0 && i + 1 < ls.length ? ls[i + 1] : '';
  };
  return {
    placeOfBirth: after(['PLACE OF BIRTH', 'TUGILGAN JOYI']),
    issuer: after(['PLACE OF ISSUE', 'BERILGAN JOYI']),
  };
}

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
```

- [ ] **Step 4: Run tests, verify pass**

Run: `node ../../node_modules/jest/bin/jest.js --rootDir src --testRegex "id-fields.util.spec.ts$"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/passport/id-fields.util.ts apps/backend/src/passport/id-fields.util.spec.ts
git commit -m "feat(passport): ID back-VIZ extractor + front/back merge"
```

---

### Task 5: ID-back MRZ read (crop to band) in the service

The back MRZ sits over a pattern with QR/chip noise; cropping to the bottom band gives clean lines. Add a cropped preprocessing pass used only for the ID back, reusing the existing `attempt`/parse machinery.

**Files:**
- Modify: `apps/backend/src/passport/passport.service.ts`
- Test: `apps/backend/src/passport/passport.service.spec.ts`

**Interfaces:**
- Produces: `PassportService.scanIdBack(file: Buffer, ocr?: OcrFn): Promise<PassportScanResult>` — same shape as `scan`, but preprocessing also tries the bottom-band crop; returns MRZ fields (name ignored by callers). Uses the `mrz` worker in production.

- [ ] **Step 1: Write the failing test**

Add to `passport.service.spec.ts` (reuses `blankImage`, and a valid TD1 constant):

```ts
const VALID_TD1 = ['IUUZBAE1295616040807841080026<', '8407085F3501209UZBUZB<<<<<<<<8', 'QODIROVA<<XOLISXON<<<<<<<<<<<<'].join('\n');

it('scanIdBack reads a TD1 MRZ (stubbed) → PINFL + series/number', async () => {
  const res = await svc.scanIdBack(blankImage, async () => VALID_TD1);
  expect(res.confidence).toBe(100);
  expect(res.format).toBe('TD1');
  expect(res.fields.passportSeries).toBe('AE');
  expect(res.fields.passportNumber).toBe('1295616');
  expect(res.fields.pinfl).toBe('40807841080026');
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `node ../../node_modules/jest/bin/jest.js --rootDir src --testRegex "passport.service.spec.ts$" -t "scanIdBack"`
Expected: FAIL — `svc.scanIdBack` is not a function.

- [ ] **Step 3: Implement**

In `passport.service.ts`, generalise `preprocess` to accept an optional bottom-band crop and add `scanIdBack`. Change the `preprocess` signature and body:

```ts
  private async preprocess(file: Buffer, angle: number, binarize: boolean, cropBand = false): Promise<Buffer> {
    let img = sharp(file, { failOn: 'none' }).rotate(angle).grayscale().normalize().sharpen();
    if (cropBand) {
      const meta = await img.metadata();
      const h = meta.height ?? 0;
      if (h > 0) { const top = Math.round(h * 0.62); img = img.extract({ left: 0, top, width: meta.width ?? 1, height: h - top }); }
    }
    if (binarize) img = img.threshold(140);
    return img.resize({ width: 1600 }).toBuffer();
  }
```

Refactor `run` to accept a preprocessing flag and add the ID entrypoints. Replace the `run` method's `attempt` preprocessing call and add band passes. Concretely, change `run(file, ocr)` to `run(file, ocr, bands: boolean[] = [false])` where each `band` value is threaded into `attempt` → `preprocess(..., cropBand)`:

```ts
  private async run(file: Buffer, ocr: OcrFn, bands: boolean[] = [false]): Promise<PassportScanResult> {
    const attempt = async (binarize: boolean, cropBand: boolean, carried: Candidate | null) => {
      let best = carried;
      for (const angle of ORIENTATIONS) {
        const img = await this.preprocess(file, angle, binarize, cropBand);
        const text = await ocr(img);
        const lines = extractMrzLines(text);
        if (lines.length < 2) continue;
        const norm = normalizeMrzLines(lines);
        let parsed: any;
        try { parsed = parse(norm); } catch { continue; }
        const conf = scoreConfidence((parsed.details ?? []) as MrzDetail[]);
        const better = !best || (parsed.valid && !best.parsed.valid) || (parsed.valid === best.parsed.valid && conf > best.conf);
        if (better) best = { parsed, conf, lines: norm };
        if (parsed.valid) return { best, done: true };
      }
      return { best, done: false };
    };
    let r: { best: Candidate | null; done: boolean } = { best: null, done: false };
    for (const band of bands) {
      r = await attempt(false, band, r.best);
      if (!r.done) r = await attempt(true, band, r.best);
      if (r.done) break;
    }
    const best = r.best;
    if (!best || best.conf === 0) return emptyResult();
    const fields = mapMrzToBorrower(best.parsed.fields ?? {});
    const perField = ((best.parsed.details ?? []) as MrzDetail[])
      .filter((d) => d.field.endsWith('CheckDigit'))
      .map((d) => ({ key: d.field, value: String(d.value ?? ''), valid: !!d.valid }));
    const warnings: string[] = [];
    if (best.conf < 60) warnings.push('low_confidence');
    warnings.push(...expiryWarnings(fields.passportExpiry));
    return { confidence: best.conf, fields, perField, format: best.parsed.format ?? '', rawMrz: best.lines, warnings };
  }
```

Add `scanIdBack` next to `scan` (production uses the `mrz` worker exactly like `scan`, but runs full-frame **and** cropped-band passes):

```ts
  /** Scan the BACK of an ID card → TD1 MRZ fields (name is ignored by callers). */
  async scanIdBack(file: Buffer, ocr?: OcrFn): Promise<PassportScanResult> {
    if (ocr) return this.run(file, ocr, [false, true]);
    const worker = await createWorker(OCR_LANG, 1, { langPath: TESSDATA_DIR, cacheMethod: 'none', gzip: false });
    try {
      await worker.setParameters({ tessedit_char_whitelist: MRZ_WHITELIST });
      return await this.run(file, async (img) => (await worker.recognize(img)).data.text, [false, true]);
    } finally {
      await worker.terminate();
    }
  }
```

(Existing `scan` keeps calling `this.run(file, ocr)` — default `bands=[false]`, behaviour unchanged.)

- [ ] **Step 4: Run tests, verify pass**

Run: `node ../../node_modules/jest/bin/jest.js --rootDir src --testRegex "passport.service.spec.ts$"`
Expected: PASS (existing passport tests still green — default `bands=[false]`).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/passport/passport.service.ts apps/backend/src/passport/passport.service.spec.ts
git commit -m "feat(passport): scanIdBack with bottom-band crop for TD1 MRZ"
```

---

### Task 6: Orchestrate `scanIdCard` (front + back + VIZ) in the service

**Files:**
- Modify: `apps/backend/src/passport/passport.service.ts`
- Test: `apps/backend/src/passport/passport.service.spec.ts`

**Interfaces:**
- Consumes: `scanIdBack`, `extractIdFront`, `extractIdBackViz`, `mergeIdResult`.
- Produces: `PassportService.scanIdCard(front: Buffer, back: Buffer, mrzOcr?: OcrFn, textOcr?: OcrFn): Promise<PassportScanResult>` — `mrzOcr` reads the back MRZ (mrz model), `textOcr` reads front + back printed text (eng model). In production both are created internally.

- [ ] **Step 1: Write the failing test**

Add to `passport.service.spec.ts`:

```ts
it('scanIdCard merges back MRZ numbers with the front name', async () => {
  const frontText = ['Surname', 'QODIROVA', 'Given name(s)', 'XOLISXON', 'Patronymic', 'MUXTOROVNA', 'Date of issue', '21.01.2025'].join('\n');
  const res = await svc.scanIdCard(
    Buffer.from('front'), Buffer.from('back'),
    async () => VALID_TD1,          // mrz OCR (back)
    async () => frontText,          // text OCR (front + back VIZ, same stub here)
  );
  expect(res.docType).toBe('ID');
  expect(res.fields.fullName).toBe('QODIROVA XOLISXON MUXTOROVNA');
  expect(res.fields.pinfl).toBe('40807841080026');
  expect(res.fields.passportIssueDate).toBe('2025-01-21T00:00:00.000Z');
  expect(res.unverifiedFields).toContain('fullName');
});

it('scanIdCard reports id_back_mrz_not_found when the back has no MRZ', async () => {
  const res = await svc.scanIdCard(Buffer.from('f'), Buffer.from('b'), async () => 'no mrz', async () => 'Surname\nQODIROVA');
  expect(res.warnings).toContain('id_back_mrz_not_found');
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `node ../../node_modules/jest/bin/jest.js --rootDir src --testRegex "passport.service.spec.ts$" -t "scanIdCard"`
Expected: FAIL — `svc.scanIdCard` is not a function.

- [ ] **Step 3: Implement**

Add imports at the top of `passport.service.ts`:

```ts
import { extractIdFront, extractIdBackViz, mergeIdResult } from './id-fields.util';
```

Add the method (production creates one `mrz` worker for the back and one `eng` worker for text):

```ts
  /** Scan an ID card (front + back) → merged fields. Inject OCRs in tests. */
  async scanIdCard(front: Buffer, back: Buffer, mrzOcr?: OcrFn, textOcr?: OcrFn): Promise<PassportScanResult> {
    if (mrzOcr && textOcr) return this.mergeId(front, back, mrzOcr, textOcr);
    const mrzWorker = await createWorker(OCR_LANG, 1, { langPath: TESSDATA_DIR, cacheMethod: 'none', gzip: false });
    const textWorker = await createWorker('eng', 1, { langPath: TESSDATA_DIR, cacheMethod: 'none', gzip: false });
    try {
      await mrzWorker.setParameters({ tessedit_char_whitelist: MRZ_WHITELIST });
      const mrzOcrFn: OcrFn = async (img) => (await mrzWorker.recognize(img)).data.text;
      const textOcrFn: OcrFn = async (img) => (await textWorker.recognize(img)).data.text;
      return await this.mergeId(front, back, mrzOcrFn, textOcrFn);
    } finally {
      await mrzWorker.terminate();
      await textWorker.terminate();
    }
  }

  private async mergeId(front: Buffer, back: Buffer, mrzOcr: OcrFn, textOcr: OcrFn): Promise<PassportScanResult> {
    const backMrz = await this.scanIdBack(back, mrzOcr);
    const frontText = await textOcr(await this.preprocess(front, 0, false));
    const backText = await textOcr(await this.preprocess(back, 0, false));
    const merged = mergeIdResult(backMrz, extractIdFront(frontText), extractIdBackViz(backText));
    if (backMrz.warnings.includes('mrz_not_found')) {
      merged.warnings = [...merged.warnings.filter((w) => w !== 'mrz_not_found'), 'id_back_mrz_not_found'];
    }
    return merged;
  }
```

Note: `scanIdBack(back, mrzOcr)` here passes the injected OCR, so tests fully stub it; `this.preprocess(front, 0, false)` reuses the shared preprocessing for the text OCR input.

- [ ] **Step 4: Run tests, verify pass**

Run: `node ../../node_modules/jest/bin/jest.js --rootDir src --testRegex "passport.service.spec.ts$"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/passport/passport.service.ts apps/backend/src/passport/passport.service.spec.ts
git commit -m "feat(passport): scanIdCard orchestration (front+back merge)"
```

---

### Task 7: Endpoint, archive both sides, api-client

**Files:**
- Modify: `apps/backend/src/passport/scan-archive.ts` (add an optional side tag)
- Modify: `apps/backend/src/passport/scan-archive.spec.ts`
- Modify: `apps/backend/src/passport/passport.module.ts`
- Modify: `packages/api-client/src/index.ts`

**Interfaces:**
- Produces: `POST /passport/scan-id` (multipart fields `front`, `back`) → `PassportScanResult`; `api.scanIdCard(front: File, back: File)`.
- Changes: `buildScanFilename(now, result, ext, side?)` — optional `side: 'front'|'back'` inserted into the name.

- [ ] **Step 1: Write the failing test (archive side tag)**

Add to `scan-archive.spec.ts`:

```ts
it('includes a side tag in the filename when given', () => {
  const name = buildScanFilename(new Date('2026-07-06T12:30:05.123Z'), result(), 'jpg', 'back');
  expect(name).toContain('__back__');
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `node ../../node_modules/jest/bin/jest.js --rootDir src --testRegex "scan-archive.spec.ts$" -t "side tag"`
Expected: FAIL — 4th arg ignored.

- [ ] **Step 3: Implement archive change**

In `scan-archive.ts`, change `buildScanFilename` and `archiveScan` signatures to thread an optional side:

```ts
export function buildScanFilename(now: Date, result: PassportScanResult, ext: string, side?: 'front' | 'back'): string {
  const ts = now.toISOString().replace(/[:.]/g, '-');
  const found = result.warnings.includes('mrz_not_found') ? false : result.confidence > 0;
  const status = !found ? 'nomrz' : result.confidence >= 60 ? 'ok' : 'lowconf';
  const conf = String(result.confidence).padStart(3, '0');
  const sideTag = side ? `__${side}` : '';
  return `${ts}__${status}__conf${conf}${sideTag}__${randomBytes(3).toString('hex')}.${ext}`;
}

export async function archiveScan(dir: string, buffer: Buffer, mimetype: string | undefined, result: PassportScanResult, now: Date, side?: 'front' | 'back'): Promise<string> {
  await mkdir(dir, { recursive: true });
  const filename = buildScanFilename(now, result, extForMime(mimetype), side);
  const full = path.join(dir, filename);
  await writeFile(full, buffer);
  return full;
}
```

- [ ] **Step 4: Verify archive test passes**

Run: `node ../../node_modules/jest/bin/jest.js --rootDir src --testRegex "scan-archive.spec.ts$"`
Expected: PASS.

- [ ] **Step 5: Add the endpoint**

In `passport.module.ts`, add imports and a controller method (uses `FileFieldsInterceptor` for two named files):

```ts
import { FileFieldsInterceptor } from '@nestjs/platform-express';
```

Add to `PassportController`:

```ts
  @Post('scan-id')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'front', maxCount: 1 }, { name: 'back', maxCount: 1 }]))
  async scanId(@UploadedFiles() files: { front?: Express.Multer.File[]; back?: Express.Multer.File[] }): Promise<PassportScanResult> {
    const front = files?.front?.[0];
    const back = files?.back?.[0];
    if (!front || !back) throw new BadRequestException('Old va orqa tomon rasmlari kerak');
    if (!(front.mimetype || '').startsWith('image/') || !(back.mimetype || '').startsWith('image/')) {
      throw new BadRequestException('Faqat rasm fayllari qabul qilinadi');
    }
    const result = await this.svc.scanIdCard(front.buffer, back.buffer);
    const now = new Date();
    try {
      await archiveScan(SCAN_DIR, front.buffer, front.mimetype, result, now, 'front');
      const saved = await archiveScan(SCAN_DIR, back.buffer, back.mimetype, result, now, 'back');
      this.logger.log(scanSummary(result, path.basename(saved)));
    } catch (e) {
      this.logger.warn(`failed to archive id scan: ${(e as Error).message}`);
    }
    return result;
  }
```

Add `UploadedFiles` to the `@nestjs/common` import list at the top of the file.

- [ ] **Step 6: Add the api-client method**

In `packages/api-client/src/index.ts`, after `scanPassport`:

```ts
  /** Scan an ID card (front + back) → merged fields + confidence. */
  async scanIdCard(front: File, back: File): Promise<PassportScanResult> {
    const fd = new FormData();
    fd.append('front', front);
    fd.append('back', back);
    const { data } = await http.post<PassportScanResult>('/passport/scan-id', fd);
    return data;
  },
```

- [ ] **Step 7: Verify backend typecheck + build shared/api-client**

Run (from `apps/backend`): `node ../../node_modules/prisma/build/index.js generate >/dev/null 2>&1; node ../../node_modules/typescript/bin/tsc -p tsconfig.json --noEmit`
Expected: exit 0.
Run (from `packages/api-client`): `node ../../node_modules/typescript/bin/tsc -p tsconfig.json --noEmit` (if a tsconfig exists; else skip)
Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add apps/backend/src/passport/scan-archive.ts apps/backend/src/passport/scan-archive.spec.ts apps/backend/src/passport/passport.module.ts packages/api-client/src/index.ts
git commit -m "feat(passport): POST /passport/scan-id endpoint + scanIdCard client, archive both sides"
```

---

### Task 8: Bundle both traineddata (eng + mrz)

**Files:**
- Modify: `deploy/Dockerfile.backend:16-19`
- Modify: `apps/backend/scripts/fetch-ocr-model.mjs`

**Interfaces:**
- Produces: `apps/backend/tessdata/` contains both `mrz.traineddata` and `eng.traineddata` in dev and prod.

- [ ] **Step 1: Update the Dockerfile**

Replace the traineddata `RUN` block with:

```dockerfile
# Bundle both OCR models offline: `mrz` (OCR-B MRZ) for the machine-readable zone and `eng`
# (general text) for the ID-card printed fields. mrz.traineddata is BSD-3 (DoubangoTelecom).
RUN mkdir -p apps/backend/tessdata \
  && curl -fsSL -o apps/backend/tessdata/mrz.traineddata https://github.com/DoubangoTelecom/tesseractMRZ/raw/master/tessdata_fast/mrz.traineddata \
  && curl -fsSL -o apps/backend/tessdata/eng.traineddata https://github.com/tesseract-ocr/tessdata_best/raw/main/eng.traineddata
```

- [ ] **Step 2: Update the dev fetch script**

Rewrite `apps/backend/scripts/fetch-ocr-model.mjs` to fetch both models (skip any already present):

```js
// Fetch OCR models for local dev/test: `mrz` (MRZ) + `eng` (ID printed text). Prod bundles them
// (deploy/Dockerfile.backend). Both are gitignored. Run: npm run setup:ocr
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = process.env.TESSDATA_PATH || join(HERE, '..', 'tessdata');
const MODELS = [
  ['mrz.traineddata', 'https://github.com/DoubangoTelecom/tesseractMRZ/raw/master/tessdata_fast/mrz.traineddata'],
  ['eng.traineddata', 'https://github.com/tesseract-ocr/tessdata_best/raw/main/eng.traineddata'],
];
const exists = async (p) => stat(p).then((s) => s.isFile()).catch(() => false);
await mkdir(DIR, { recursive: true });
for (const [name, url] of MODELS) {
  const dest = join(DIR, name);
  if (await exists(dest)) { console.log(`✓ ${name} already present`); continue; }
  console.log(`Downloading ${name} …`);
  const res = await fetch(url);
  if (!res.ok) { console.error(`Download failed for ${name}: ${res.status}`); process.exit(1); }
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  console.log(`✓ ${name} done`);
}
```

- [ ] **Step 3: Fetch models locally + verify**

Run (from `apps/backend`): `node scripts/fetch-ocr-model.mjs`
Expected: both files present under `apps/backend/tessdata/` (`mrz.traineddata`, `eng.traineddata`).

- [ ] **Step 4: Commit**

```bash
git add deploy/Dockerfile.backend apps/backend/scripts/fetch-ocr-model.mjs
git commit -m "chore(passport): bundle both mrz + eng traineddata for ID scanning"
```

---

### Task 9: Frontend — Passport/ID toggle, two zones, field mapping

**Files:**
- Modify: `packages/ui/src/pages/origination/PassportScan.tsx`
- Modify: `packages/ui/src/pages/origination/steps.tsx:36-39`

**Interfaces:**
- Consumes: `api.scanIdCard(front, back)`, extended `Fields`.
- Produces: `PassportScan` supports an ID mode with two file inputs; `onExtract` patch may include `placeOfBirth`, `passportIssueDate`, `passportIssuer`.

- [ ] **Step 1: Extend the `Fields` type + confirm defaults**

In `PassportScan.tsx`, `Fields` is `PassportScanResult['fields']`, so the optional fields flow through automatically. Extend the `confirm()` patch to forward them. In `confirm()` add, before `onExtract(patch)`:

```ts
    if (form.placeOfBirth) patch.placeOfBirth = form.placeOfBirth;
    if (form.passportIssueDate) patch.passportIssueDate = form.passportIssueDate;
    if (form.passportIssuer) patch.passportIssuer = form.passportIssuer;
```

- [ ] **Step 2: Add the document-type toggle + ID two-zone upload**

Add state near the other `useState` hooks:

```ts
  const [docType, setDocType] = useState<'PASSPORT' | 'ID'>('PASSPORT');
  const [idFront, setIdFront] = useState<File | null>(null);
  const [idBack, setIdBack] = useState<File | null>(null);
```

Add a scan runner for ID:

```ts
  const runIdScan = async (front: File, back: File) => {
    setBusy(true); setError(null); setResult(null);
    try {
      const r = await api.scanIdCard(front, back);
      setResult(r);
      setForm(r.confidence >= TRUST ? r.fields : EMPTY);
    } catch (e) { setError(getErrorMessage(e)); } finally { setBusy(false); }
  };
```

Render a segmented toggle above the upload zone:

```tsx
      <div className="inline-flex rounded-lg border border-gray-200 p-0.5 dark:border-gray-700">
        {(['PASSPORT', 'ID'] as const).map((d) => (
          <button key={d} type="button" onClick={() => { setDocType(d); setResult(null); }}
            className={cn('rounded-md px-3 py-1.5 text-sm font-medium', docType === d ? 'bg-brand-600 text-white' : 'text-gray-600 dark:text-gray-300')}>
            {d === 'PASSPORT' ? 'Passport' : 'ID-karta'}
          </button>
        ))}
      </div>
```

Show the existing single drop-zone only when `docType === 'PASSPORT'`. When `docType === 'ID'`, render two labelled file inputs (Old tomon / Orqa tomon) and a Skanerlash button:

```tsx
      {docType === 'ID' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {([['Old tomon', idFront, setIdFront], ['Orqa tomon (MRZ)', idBack, setIdBack]] as const).map(([label, val, setter]) => (
              <label key={label} className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed border-gray-300 px-3 py-5 text-center text-xs dark:border-gray-700">
                <Upload className="h-5 w-5 text-brand-600" />
                <span className="font-medium text-gray-700 dark:text-gray-200">{label}</span>
                <span className="text-gray-400">{val ? val.name : 'tanlang'}</span>
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) setter(f); e.target.value = ''; }} />
              </label>
            ))}
          </div>
          <Button disabled={!idFront || !idBack || busy} onClick={() => idFront && idBack && runIdScan(idFront, idBack)}>
            <IdCard className="h-4 w-4" /> Skanerlash
          </Button>
        </div>
      )}
```

- [ ] **Step 3: Show the extra ID fields in the result grid (guarded)**

In the trusted result grid, after the existing fields, add (only meaningful for ID; harmless for passport since they are empty):

```tsx
            {form.placeOfBirth !== undefined && (
              <Field label="Tug‘ilgan joy"><Input value={form.placeOfBirth ?? ''} onChange={(e) => setForm({ ...form, placeOfBirth: e.target.value })} /></Field>
            )}
            {form.passportIssuer !== undefined && (
              <Field label="Pasport kim bergan"><Input value={form.passportIssuer ?? ''} onChange={(e) => setForm({ ...form, passportIssuer: e.target.value })} /></Field>
            )}
```

- [ ] **Step 4: Map the new fields into the borrower form**

In `steps.tsx`, the `onExtract` handler currently maps `nationality → citizenship`. It spreads `...rest`, so `placeOfBirth`, `passportIssueDate`, `passportIssuer` flow through to `set(...)` automatically **iff** the `Borrower` type has those keys. Verify `Borrower` has `placeOfBirth`, `passportIssueDate`, `passportIssuer` (it does — they are rendered in Step1). No change needed beyond confirming the spread; if TypeScript complains about extra keys, extend the `Partial<Fields>`→`Partial<Borrower>` cast already present.

- [ ] **Step 5: Typecheck the UI**

Run (from repo root): `node node_modules/typescript/bin/tsc -p tsconfig.uicheck.json`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/pages/origination/PassportScan.tsx packages/ui/src/pages/origination/steps.tsx
git commit -m "feat(ui): passport/ID toggle with front+back ID scanning"
```

---

### Task 10: Opt-in real-image integration test (ID)

**Files:**
- Create: `apps/backend/src/passport/id-scan.real.spec.ts`
- Local (gitignored) fixtures: `apps/backend/test-fixtures/id-karta-front.jpg`, `id-karta-orqa.jpg`

**Interfaces:**
- Consumes: `PassportService.scanIdCard` (production OCR path).

- [ ] **Step 1: Write the test (self-skips without assets)**

```ts
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import sharp from 'sharp';
import { PassportService } from './passport.service';

sharp.concurrency(1); // bound native memory under jest

const FRONT = path.join(__dirname, '..', '..', 'test-fixtures', 'id-karta-front.jpg');
const BACK = path.join(__dirname, '..', '..', 'test-fixtures', 'id-karta-orqa.jpg');
const MODELS = ['mrz', 'eng'].map((m) => path.join(__dirname, '..', '..', 'tessdata', `${m}.traineddata`));
const ready = process.env.RUN_OCR_IT === '1' && existsSync(FRONT) && existsSync(BACK) && MODELS.every(existsSync);

(ready ? describe : describe.skip)('PassportService — real ID card OCR', () => {
  it('reads verified numbers from the back and the clean name from the front', async () => {
    const svc = new PassportService();
    const res = await svc.scanIdCard(readFileSync(FRONT), readFileSync(BACK));
    expect(res.docType).toBe('ID');
    expect(res.fields.passportSeries).toBe('AE');
    expect(res.fields.passportNumber).toBe('1295616');
    expect(res.fields.pinfl).toBe('40807841080026');
    expect(res.fields.gender).toBe('FEMALE');
    expect(res.fields.fullName).toContain('QODIROVA');
    expect(res.fields.fullName).toContain('XOLISXON');
    expect(res.fields.placeOfBirth).toContain('QORAKO');
    expect(res.confidence).toBe(100);
  }, 180000);
});
```

- [ ] **Step 2: Run it (opt-in)**

Run (from `apps/backend`, after `node scripts/fetch-ocr-model.mjs` and placing the two fixtures):
`node scripts/test-ocr.mjs` won't target this file — run directly:
`RUN_OCR_IT=1 node --max-old-space-size=2048 ../../node_modules/jest/bin/jest.js --rootDir src --runInBand --testRegex "id-scan.real.spec.ts$"`
Expected: PASS (fields as asserted). If `fullName` lacks patronymic or `placeOfBirth` differs, tune the front/back-VIZ anchors in `id-fields.util.ts` and re-run.

- [ ] **Step 3: Run the whole passport suite (default, real specs skip)**

Run: `node ../../node_modules/jest/bin/jest.js --rootDir src --testRegex "passport|mrz|scan-archive|id-fields"`
Expected: all PASS, real specs `skipped`.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/passport/id-scan.real.spec.ts
git commit -m "test(passport): opt-in real-image ID scan integration test"
```

---

## Self-Review

**Spec coverage:**
- UX toggle + two zones → Task 9. ✅
- Extended DTO fields → Task 1. ✅
- Back TD1 MRZ crop + PINFL(optional1) → Tasks 2, 5. ✅
- Front VIZ label extraction → Task 3. ✅
- Back VIZ (place of birth/issuer) → Task 4. ✅
- Merge + confidence + cross-check → Task 4, 6. ✅
- Endpoint + api-client + archive both → Task 7. ✅
- Bundle eng + mrz → Task 8. ✅
- Tests (unit + opt-in integration) → Tasks 2,3,4,5,6,7,10. ✅
- Field→source map honored in `mergeIdResult` (MRZ wins numbers; OCR fields in `unverifiedFields`). ✅

**Placeholder scan:** No TBD/TODO; each code step shows complete code. ✅

**Type consistency:** `IdFrontFields`, `IdBackViz`, `mergeIdResult(back, front, viz)`, `scanIdBack`, `scanIdCard(front, back, mrzOcr?, textOcr?)`, `buildScanFilename(..., side?)`, `archiveScan(..., side?)` are used consistently across tasks. `run(file, ocr, bands?)` keeps the passport default `[false]`. PINFL field name `optional1` matches the mrz parser (verified). ✅

**Open follow-ups (not blockers):** issuer OCR is best-effort; the UI "tekshiring" hint rendering for `unverifiedFields` can be refined after the fields land (Task 9 shows the fields; a per-field hint chip is optional polish).
