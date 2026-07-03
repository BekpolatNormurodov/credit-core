# Passport Scanner v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the on-prem passport MRZ scanner against tilted/upside-down/blurry photos, warn when a passport is expired, auto-fill nationality (UZB-first, ~20 mapped), and redesign the scan UI.

**Architecture:** Backend stays a stateless NestJS pipeline: `sharp` preprocess → `tesseract.js` OCR (offline) → `mrz` parse → check-digit confidence. This plan adds a stronger preprocessing pass (sharpen + upscale + a binarized second attempt across all four orientations), a corrected expiry-century rule with expiry warnings, and an ISO-alpha-3 → localized nationality map shared between backend and UI. The `PassportScan.tsx` card is rebuilt with a drag-drop/camera zone, animated confidence, per-field validity chips, an expiry banner, and a nationality field.

**Tech Stack:** NestJS, `sharp`, `tesseract.js`, `mrz`, Jest/ts-jest (backend); React + Tailwind + Iconsax, Vite (UI); TypeScript monorepo with `@credit-core/shared`.

## Global Constraints

- **Base branch:** work on `feat/passport-scanner` (or a branch off it). This plan builds on the existing passport module.
- **Fully offline runtime:** no new network calls at request time. OCR core loads from the local `tesseract.js-core` package; traineddata from the bundled `TESSDATA_PATH`. Do not introduce CDN fetches.
- **Shared package resolves to `dist`:** `@credit-core/shared` `main` is `./dist/index.js`. Any change to shared requires `npm run build -w @credit-core/shared` before backend Jest or UI type-checks see it.
- **UI verification:** splash/login previews fail (Spline + rAF). Verify UI via `npm run typecheck` + `npm run build` in `packages/ui`, not screenshots. Shared UI lives in `packages/ui`; brand tokens (`brand-*`, `success/warning/error-*`) and dark-mode variants are deliberate — reuse them.
- **Copy language:** all user-facing strings are Uzbek (Latin), matching existing components.
- **Commands run from repo root** unless noted. Backend tests: `npm test -w @credit-core/backend -- <file>`.

---

## File Structure

- `packages/shared/src/nationality.ts` — **Create.** ISO alpha-3 → Uzbek name map, `nationalityName()`, `NATIONALITY_OPTIONS`.
- `packages/shared/src/index.ts` — **Modify.** Re-export `./nationality`.
- `packages/shared/src/dto.ts` — **Modify.** Add `fields.nationality` and document new warnings on `PassportScanResult`.
- `apps/backend/src/passport/mrz.util.ts` — **Modify.** Expiry century fix, `nationality` extraction, `expiryWarnings()`.
- `apps/backend/src/passport/mrz.util.spec.ts` — **Modify.** New tests.
- `apps/backend/src/passport/nationality.spec.ts` — **Create.** Nationality map tests (imports from `@credit-core/shared`).
- `apps/backend/src/passport/passport.service.ts` — **Modify.** Sharpen+upscale preprocess, binarized 2nd pass, expiry warnings, `nationality: ''` in `emptyResult`.
- `apps/backend/src/passport/passport.service.spec.ts` — **Modify.** 2nd-pass recovery + expired-warning tests.
- `packages/ui/src/pages/origination/PassportScan.tsx` — **Rewrite.** Redesigned scan card with nationality field + expiry banner.
- `packages/ui/src/pages/origination/steps.tsx` — **Modify.** Citizenship dropdown → `NATIONALITY_OPTIONS` (searchable); translate scanned `nationality` → `citizenship`.
- `deploy/Dockerfile.backend` — **Modify.** Drop the unused `osd.traineddata` download/copy.

---

## Task 1: Nationality map (shared)

**Files:**
- Create: `packages/shared/src/nationality.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `apps/backend/src/passport/nationality.spec.ts`

**Interfaces:**
- Produces:
  - `NATIONALITY_UZ: Record<string, string>` — alpha-3 code → Uzbek name.
  - `nationalityName(code?: string | null): string` — localized name, falls back to the upper-cased raw code, `''` for nullish.
  - `NATIONALITY_OPTIONS: string[]` — ordered display names (UZB first) ending with `'Boshqa'`.

- [ ] **Step 1: Write the failing test**

Create `apps/backend/src/passport/nationality.spec.ts`:

```ts
import { nationalityName, NATIONALITY_OPTIONS } from '@credit-core/shared';

describe('nationalityName', () => {
  it('maps UZB to the primary Uzbek name', () => {
    expect(nationalityName('UZB')).toBe('O‘zbekiston Respublikasi');
  });
  it('maps other known codes, case-insensitively', () => {
    expect(nationalityName('rus')).toBe('Rossiya Federatsiyasi');
    expect(nationalityName('KAZ')).toBe('Qozog‘iston');
  });
  it('falls back to the raw code for an unknown nationality', () => {
    expect(nationalityName('XYZ')).toBe('XYZ');
  });
  it('returns empty string for nullish input', () => {
    expect(nationalityName(null)).toBe('');
    expect(nationalityName(undefined)).toBe('');
  });
});

describe('NATIONALITY_OPTIONS', () => {
  it('lists UZB first and Boshqa last', () => {
    expect(NATIONALITY_OPTIONS[0]).toBe('O‘zbekiston Respublikasi');
    expect(NATIONALITY_OPTIONS[NATIONALITY_OPTIONS.length - 1]).toBe('Boshqa');
  });
  it('has ~20 entries', () => {
    expect(NATIONALITY_OPTIONS.length).toBeGreaterThanOrEqual(20);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run build -w @credit-core/shared && npm test -w @credit-core/backend -- nationality.spec`
Expected: FAIL — `nationalityName`/`NATIONALITY_OPTIONS` not exported from `@credit-core/shared`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/shared/src/nationality.ts`:

```ts
/**
 * ISO 3166-1 alpha-3 nationality code → Uzbek display name.
 * UZB is the primary case; the rest cover the ~20 nationalities seen in practice.
 * Unknown codes fall through to the raw code so nothing is silently dropped.
 */
export const NATIONALITY_UZ: Record<string, string> = {
  UZB: 'O‘zbekiston Respublikasi',
  RUS: 'Rossiya Federatsiyasi',
  KAZ: 'Qozog‘iston',
  KGZ: 'Qirg‘iziston',
  TJK: 'Tojikiston',
  TKM: 'Turkmaniston',
  AZE: 'Ozarbayjon',
  ARM: 'Armaniston',
  GEO: 'Gruziya',
  BLR: 'Belarus',
  UKR: 'Ukraina',
  MDA: 'Moldova',
  TUR: 'Turkiya',
  AFG: 'Afg‘oniston',
  CHN: 'Xitoy',
  KOR: 'Janubiy Koreya',
  IND: 'Hindiston',
  PAK: 'Pokiston',
  IRN: 'Eron',
  USA: 'AQSh',
  DEU: 'Germaniya',
  GBR: 'Buyuk Britaniya',
};

/** Localized nationality name for an MRZ alpha-3 code; raw code if unknown, '' if absent. */
export function nationalityName(code?: string | null): string {
  if (!code) return '';
  const c = code.toUpperCase().replace(/[^A-Z]/g, '');
  return NATIONALITY_UZ[c] ?? c;
}

/** Ordered citizenship dropdown options: every mapped name (UZB first) + 'Boshqa'. */
export const NATIONALITY_OPTIONS: string[] = [...Object.values(NATIONALITY_UZ), 'Boshqa'];
```

Add to `packages/shared/src/index.ts` (after the existing `export * from './dto';` line):

```ts
export * from './nationality';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run build -w @credit-core/shared && npm test -w @credit-core/backend -- nationality.spec`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/nationality.ts packages/shared/src/index.ts apps/backend/src/passport/nationality.spec.ts
git commit -m "feat(passport): shared ISO-alpha3 nationality map (UZB-first, ~20)"
```

---

## Task 2: MRZ util — expiry fix, nationality, expiry warnings

**Files:**
- Modify: `apps/backend/src/passport/mrz.util.ts`
- Test: `apps/backend/src/passport/mrz.util.spec.ts`

**Interfaces:**
- Consumes: `nationalityName` from `@credit-core/shared` (Task 1).
- Produces:
  - `MrzFields.nationality?: string | null` (new optional field).
  - `mapMrzToBorrower(fields)` return gains `nationality: string`.
  - `yymmddToIso(yymmdd, future)` — when `future` is true the year is always `2000 + yy` (no 1900s rollover).
  - `expiryWarnings(expiryIso: string | null, now?: Date): string[]` — `['expired']`, `['expiring_soon']` (≤ 90 days), or `[]`.

- [ ] **Step 1: Write the failing test**

Add to `apps/backend/src/passport/mrz.util.spec.ts` (append these blocks; add `expiryWarnings` to the import on line 1):

```ts
// line 1 becomes:
import { scoreConfidence, mapMrzToBorrower, yymmddToIso, extractMrzLines, expiryWarnings, MrzDetail } from './mrz.util';

describe('yymmddToIso — expiry century', () => {
  it('always resolves an expiry to the 2000s (no 1900s rollover)', () => {
    expect(yymmddToIso('490101', true)).toBe('2049-01-01T00:00:00.000Z');
    expect(yymmddToIso('300101', true)).toBe('2030-01-01T00:00:00.000Z');
  });
});

describe('mapMrzToBorrower — nationality', () => {
  it('maps a nationality code to its localized name', () => {
    expect(mapMrzToBorrower({ nationality: 'UZB' }).nationality).toBe('O‘zbekiston Respublikasi');
    expect(mapMrzToBorrower({ nationality: 'KAZ' }).nationality).toBe('Qozog‘iston');
  });
  it('keeps an unknown code as-is and empty when absent', () => {
    expect(mapMrzToBorrower({ nationality: 'UTO' }).nationality).toBe('UTO');
    expect(mapMrzToBorrower({}).nationality).toBe('');
  });
});

describe('expiryWarnings', () => {
  const now = new Date('2026-07-03T00:00:00.000Z');
  it('flags an expired passport', () => {
    expect(expiryWarnings('2020-01-01T00:00:00.000Z', now)).toEqual(['expired']);
  });
  it('flags one expiring within 90 days', () => {
    expect(expiryWarnings('2026-08-01T00:00:00.000Z', now)).toEqual(['expiring_soon']);
  });
  it('no warning for a comfortably valid passport', () => {
    expect(expiryWarnings('2030-01-01T00:00:00.000Z', now)).toEqual([]);
  });
  it('no warning when expiry is missing', () => {
    expect(expiryWarnings(null, now)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @credit-core/backend -- mrz.util.spec`
Expected: FAIL — `expiryWarnings` not exported; `mapMrzToBorrower(...).nationality` undefined; `yymmddToIso('490101', true)` returns `1949-…`.

- [ ] **Step 3: Write minimal implementation**

In `apps/backend/src/passport/mrz.util.ts`:

(a) Add the shared import at the top (after the file header comment):

```ts
import { nationalityName } from '@credit-core/shared';
```

(b) Add `nationality` to the `MrzFields` interface (after the `sex?` line):

```ts
  personalNumber?: string | null;
  nationality?: string | null; // ISO alpha-3 (e.g. 'UZB')
```

(c) Replace the `year` computation inside `yymmddToIso` so expiry never rolls to the 1900s:

```ts
  const cc = new Date().getFullYear() % 100;
  // Expiry is always this century (passports don't expire in the 1900s). Birth is past-biased.
  const year = future ? 2000 + yy : yy <= cc ? 2000 + yy : 1900 + yy;
  return new Date(Date.UTC(year, mm - 1, dd)).toISOString();
```

(d) In `mapMrzToBorrower`, add `nationality` to the returned object (after the `gender` line):

```ts
    gender,
    nationality: nationalityName(fields.nationality),
    pinfl: pinflDigits.length === 14 ? pinflDigits : '',
```

(e) Append `expiryWarnings` at the end of the file:

```ts
/** Passport-validity warnings from an ISO expiry date: 'expired', 'expiring_soon' (≤90d), or none. */
export function expiryWarnings(expiryIso: string | null, now: Date = new Date()): string[] {
  if (!expiryIso) return [];
  const exp = new Date(expiryIso).getTime();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (exp < today) return ['expired'];
  const ninetyDays = 90 * 24 * 60 * 60 * 1000;
  if (exp - today <= ninetyDays) return ['expiring_soon'];
  return [];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run build -w @credit-core/shared && npm test -w @credit-core/backend -- mrz.util.spec`
Expected: PASS. (`npm run build -w @credit-core/shared` guarantees the Task 1 exports resolve.)

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/passport/mrz.util.ts apps/backend/src/passport/mrz.util.spec.ts
git commit -m "feat(passport): expiry century fix + nationality mapping + expiryWarnings"
```

---

## Task 3: Passport service + DTO — robust preprocessing, nationality, expiry warnings

**Files:**
- Modify: `packages/shared/src/dto.ts`
- Modify: `apps/backend/src/passport/passport.service.ts`
- Test: `apps/backend/src/passport/passport.service.spec.ts`

**Interfaces:**
- Consumes: `mapMrzToBorrower`, `scoreConfidence`, `extractMrzLines`, `expiryWarnings`, `MrzDetail` (Task 2); `OcrFn` (unchanged).
- Produces: `PassportScanResult.fields.nationality: string`; `warnings` may include `'expired' | 'expiring_soon'` alongside existing `'mrz_not_found' | 'low_confidence'`. `PassportService.scan` behavior unchanged in signature; internal 2-pass (base then binarized) across all four orientations.

- [ ] **Step 1: Write the failing test**

Add to `apps/backend/src/passport/passport.service.spec.ts` (append; add `OcrFn` where needed):

```ts
import { PassportService } from './passport.service';
import type { OcrFn } from './passport.service';

// ... existing VALID_TD3 + describe block stay ...

describe('PassportService — robustness & warnings', () => {
  const svc = new PassportService();
  let tinyImage: Buffer;
  beforeAll(async () => {
    const sharp = (await import('sharp')).default;
    tinyImage = await sharp({ create: { width: 12, height: 12, channels: 3, background: '#fff' } }).png().toBuffer();
  });

  it('recovers via the binarized second pass when the base pass is unreadable', async () => {
    let calls = 0;
    const flaky: OcrFn = async () => (++calls > 4 ? VALID_TD3 : 'blurry noise ####');
    const res = await svc.scan(tinyImage, flaky);
    expect(res.confidence).toBe(100);
    expect(calls).toBeGreaterThan(4);
  });

  it('warns when the scanned passport is already expired', async () => {
    // VALID_TD3 expires 2012-04-15 → always in the past.
    const res = await svc.scan(tinyImage, async () => VALID_TD3);
    expect(res.warnings).toContain('expired');
  });

  it('exposes a nationality string on the result fields', async () => {
    const res = await svc.scan(tinyImage, async () => VALID_TD3);
    expect(typeof res.fields.nationality).toBe('string');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @credit-core/backend -- passport.service.spec`
Expected: FAIL — no binarized 2nd pass (flaky stub never reaches call 5), no `'expired'` warning, and `res.fields.nationality` is a type error / undefined.

- [ ] **Step 3: Update the DTO**

In `packages/shared/src/dto.ts`, inside `PassportScanResult.fields`, add `nationality` (after `gender`) and extend the warnings comment:

```ts
    gender: 'MALE' | 'FEMALE' | '';
    nationality: string; // localized citizenship name, '' if unknown
    pinfl: string;
  };
  /** Per check-digit outcome, for the UI validity chips. */
  perField: { key: string; value: string; valid: boolean }[];
  format: string; // 'TD1' | 'TD2' | 'TD3' | ''
  rawMrz: string[];
  warnings: string[]; // 'mrz_not_found' | 'low_confidence' | 'expired' | 'expiring_soon'
```

- [ ] **Step 4: Update the service**

In `apps/backend/src/passport/passport.service.ts`:

(a) Import `expiryWarnings`:

```ts
import { extractMrzLines, mapMrzToBorrower, scoreConfidence, expiryWarnings, MrzDetail } from './mrz.util';
```

(b) Add `nationality: ''` to `emptyResult()` fields:

```ts
    fields: { fullName: '', passportSeries: '', passportNumber: '', birthDate: null, passportExpiry: null, gender: '', nationality: '', pinfl: '' },
```

(c) Replace the `run` method with a two-pass version:

```ts
  /** Two passes: base preprocessing, then binarized, each across all orientations. Best MRZ wins. */
  private async run(file: Buffer, ocr: OcrFn): Promise<PassportScanResult> {
    let best: { parsed: any; conf: number; lines: string[] } | null = null;

    const attempt = async (binarize: boolean) => {
      for (const angle of ORIENTATIONS) {
        const img = await this.preprocess(file, angle, binarize);
        const text = await ocr(img);
        const lines = extractMrzLines(text);
        if (lines.length < 2) continue;
        let parsed: any;
        try {
          parsed = parse(lines);
        } catch {
          continue;
        }
        const conf = scoreConfidence((parsed.details ?? []) as MrzDetail[]);
        if (!best || conf > best.conf) best = { parsed, conf, lines };
        if (parsed.valid) return true;
      }
      return false;
    };

    // Base pass; if nothing confident, retry binarized (recovers low-contrast / blurry scans).
    const done = await attempt(false);
    if (!done && (!best || best.conf < 60)) await attempt(true);
    if (!best) return emptyResult();

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

(d) Replace `preprocess` to add the `binarize` variant, sharpen, larger width, and tolerant decode:

```ts
  /** Rotate + grayscale + normalize + sharpen (+ optional threshold) + upscale for a legible MRZ read. */
  private async preprocess(file: Buffer, angle: number, binarize: boolean): Promise<Buffer> {
    let img = sharp(file, { failOn: 'none' }).rotate(angle).grayscale().normalize().sharpen();
    if (binarize) img = img.threshold(140);
    return img.resize({ width: 1500, withoutEnlargement: true }).toBuffer();
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run build -w @credit-core/shared && npm test -w @credit-core/backend -- passport.service.spec mrz.util.spec`
Expected: PASS — both new and existing passport tests green.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/dto.ts apps/backend/src/passport/passport.service.ts apps/backend/src/passport/passport.service.spec.ts
git commit -m "feat(passport): binarized 2nd-pass OCR, nationality field, expiry warnings"
```

---

## Task 4: Redesigned PassportScan UI

**Files:**
- Rewrite: `packages/ui/src/pages/origination/PassportScan.tsx`

**Interfaces:**
- Consumes: `api.scanPassport`, `getErrorMessage` (`@credit-core/api-client`); `PassportScanResult` (now with `fields.nationality` + expiry warnings, Task 3); primitives `Button, Card, Field, Input`; `Select` from `../../components/forms`; icons `Upload, Camera, IdCard, CheckCircle2, RotateCcw, Globe, Warning, ShieldCheck`; `cn`.
- Produces: `PassportScan({ onExtract }: { onExtract: (patch: Partial<PassportScanResult['fields']>) => void })` — the patch now includes `nationality`.

**Execution note:** apply the `ui-ux-pro-max` skill for visual refinement, but keep the props/behavior below. Verify with `npm run typecheck` + `npm run build` in `packages/ui` (no preview screenshots — splash/login rAF limitation).

- [ ] **Step 1: Rewrite the component**

Replace the entire contents of `packages/ui/src/pages/origination/PassportScan.tsx`:

```tsx
import { useState } from 'react';
import type { PassportScanResult } from '@credit-core/shared';
import { api, getErrorMessage } from '@credit-core/api-client';
import { Upload, Camera, IdCard, CheckCircle2, RotateCcw, Globe, Warning, ShieldCheck } from '../../lib/icons';
import { Button, Card, Field, Input } from '../../components/primitives';
import { Select } from '../../components/forms';
import { cn } from '../../lib/cn';

type Fields = PassportScanResult['fields'];

const EMPTY: Fields = {
  fullName: '', passportSeries: '', passportNumber: '',
  birthDate: null, passportExpiry: null, gender: '', nationality: '', pinfl: '',
};

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
}

function tone(c: number) {
  if (c >= 90) return { ring: 'text-success-500', chip: 'bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-500', label: 'Aniq' };
  if (c >= 60) return { ring: 'text-warning-500', chip: 'bg-warning-50 text-warning-600 dark:bg-warning-500/10 dark:text-warning-500', label: 'Tekshiring' };
  return { ring: 'text-error-500', chip: 'bg-error-50 text-error-600 dark:bg-error-500/10 dark:text-error-500', label: 'Qayta oling' };
}

function ConfidenceRing({ value, className }: { value: number; className?: string }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(100, value)) / 100);
  return (
    <div className="relative h-12 w-12 shrink-0">
      <svg viewBox="0 0 48 48" className="h-12 w-12 -rotate-90">
        <circle cx="24" cy="24" r={r} className="stroke-gray-200 dark:stroke-gray-700" strokeWidth="4" fill="none" />
        <circle cx="24" cy="24" r={r} className={cn('transition-all duration-700', className)} stroke="currentColor" strokeWidth="4" fill="none" strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-gray-700 dark:text-gray-200">{value}</span>
    </div>
  );
}

function ValidChip({ valid }: { valid?: boolean }) {
  if (valid === undefined) return null;
  return valid ? (
    <span className="rounded-full bg-success-50 px-1.5 py-0.5 text-[10px] font-semibold text-success-600 dark:bg-success-500/10 dark:text-success-500">✓ tekshirildi</span>
  ) : (
    <span className="rounded-full bg-error-50 px-1.5 py-0.5 text-[10px] font-semibold text-error-600 dark:bg-error-500/10 dark:text-error-500">✗ nomuvofiq</span>
  );
}

function FieldWithChip({ label, valid, children }: { label: string; valid?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
        <ValidChip valid={valid} />
      </div>
      {children}
    </div>
  );
}

function ReadonlyRow({ label, value, valid }: { label: string; value: string; valid?: boolean }) {
  return (
    <FieldWithChip label={label} valid={valid}>
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">{value || '—'}</div>
    </FieldWithChip>
  );
}

/** Passport MRZ scanner — prefills the borrower form. Mounted in the origination borrower step. */
export function PassportScan({ onExtract }: { onExtract: (patch: Partial<Fields>) => void }) {
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PassportScanResult | null>(null);
  const [form, setForm] = useState<Fields>(EMPTY);

  const runScan = async (file: File) => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await api.scanPassport(file);
      setResult(r);
      setForm(r.fields);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) runScan(f);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith('image/')) runScan(f);
  };

  const validOf = (key: string) => result?.perField.find((p) => p.key === key)?.valid;

  const confirm = () => {
    const patch: Partial<Fields> = {};
    if (form.fullName) patch.fullName = form.fullName;
    if (form.passportSeries) patch.passportSeries = form.passportSeries;
    if (form.passportNumber) patch.passportNumber = form.passportNumber;
    if (form.birthDate) patch.birthDate = form.birthDate;
    if (form.passportExpiry) patch.passportExpiry = form.passportExpiry;
    if (form.gender) patch.gender = form.gender;
    if (form.nationality) patch.nationality = form.nationality;
    if (form.pinfl) patch.pinfl = form.pinfl;
    onExtract(patch);
    setResult(null);
  };

  const t = result ? tone(result.confidence) : null;
  const expired = result?.warnings.includes('expired');
  const expiringSoon = result?.warnings.includes('expiring_soon');

  return (
    <Card className="space-y-4 border-brand-100 bg-brand-50/40 dark:border-brand-500/20 dark:bg-brand-500/5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white"><IdCard className="h-5 w-5" /></span>
        <div>
          <h3 className="font-semibold text-gray-800 dark:text-white">Passportni skanerlash</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">MRZ (pastdagi 2 qator) o‘qiladi — maydonlar avtomatik to‘ladi</p>
        </div>
      </div>

      {/* Upload / drag-drop / camera zone */}
      <label
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition',
          drag ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10' : 'border-gray-300 hover:border-brand-400 dark:border-gray-700',
        )}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-brand-600 shadow-sm dark:bg-gray-800"><Upload className="h-5 w-5" /></span>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Rasmni bu yerga tashlang yoki tanlang</span>
        <span className="text-xs text-gray-400">MRZ (pastki qatorlar) tekis va yorug‘ ko‘rinsin</span>
        <input type="file" accept="image/*" className="hidden" onChange={onFile} />
      </label>

      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 outline-none transition hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-brand-600/30 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 sm:hidden">
        <Camera className="h-4 w-4" /> Kamera bilan olish
        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
      </label>

      {busy && (
        <div className="flex items-center gap-3 rounded-lg bg-white/70 px-4 py-3 text-sm text-gray-600 dark:bg-white/5 dark:text-gray-300">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          Skanerlanmoqda…
        </div>
      )}
      {error && <p className="text-sm text-error-600 dark:text-error-500">{error}</p>}

      {result && t && (
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <ConfidenceRing value={result.confidence} className={t.ring} />
            <div>
              <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold', t.chip)}><ShieldCheck className="h-3.5 w-3.5" /> {t.label} · {result.confidence}%</span>
              {result.confidence < 60 && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Yorug‘roq joyda, tekis ushlab, MRZ (pastdagi qatorlar) to‘liq ko‘rinsin — qayta oling.</p>
              )}
            </div>
          </div>

          {(expired || expiringSoon) && (
            <div className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
              expired ? 'bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-400' : 'bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-400',
            )}>
              <Warning className="h-4 w-4 shrink-0" />
              {expired
                ? `Passport muddati o‘tgan${form.passportExpiry ? ` — ${fmtDate(form.passportExpiry)}` : ''}`
                : `Passport muddati tugayapti${form.passportExpiry ? ` — ${fmtDate(form.passportExpiry)}` : ''}`}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="F.I.O"><Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></Field>
            <FieldWithChip label="Pasport seriya" valid={validOf('documentNumberCheckDigit')}>
              <Input value={form.passportSeries} onChange={(e) => setForm({ ...form, passportSeries: e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2) })} placeholder="AA" />
            </FieldWithChip>
            <FieldWithChip label="Pasport raqami" valid={validOf('documentNumberCheckDigit')}>
              <Input inputMode="numeric" value={form.passportNumber} onChange={(e) => setForm({ ...form, passportNumber: e.target.value.replace(/\D/g, '').slice(0, 7) })} />
            </FieldWithChip>
            <FieldWithChip label="PINFL" valid={validOf('personalNumberCheckDigit')}>
              <Input inputMode="numeric" value={form.pinfl} onChange={(e) => setForm({ ...form, pinfl: e.target.value.replace(/\D/g, '').slice(0, 14) })} />
            </FieldWithChip>
            <Field label="Jinsi">
              <Select value={form.gender} onChange={(v) => setForm({ ...form, gender: v as Fields['gender'] })} options={[{ value: 'MALE', label: 'Erkak' }, { value: 'FEMALE', label: 'Ayol' }]} />
            </Field>
            <FieldWithChip label="Fuqarolik">
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
                <Globe className="h-4 w-4 shrink-0 text-gray-400" />
                <input className="w-full bg-transparent text-sm text-gray-700 outline-none dark:text-gray-200" value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} placeholder="O‘zbekiston Respublikasi" />
              </div>
            </FieldWithChip>
            <ReadonlyRow label="Tug‘ilgan sana" value={fmtDate(form.birthDate)} valid={validOf('birthDateCheckDigit')} />
            <ReadonlyRow label="Amal qilish muddati" value={fmtDate(form.passportExpiry)} valid={validOf('expirationDateCheckDigit')} />
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={confirm}><CheckCircle2 className="h-4 w-4" /> Formani to‘ldirish</Button>
            <button type="button" onClick={() => setResult(null)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-gray-500 outline-none transition hover:text-gray-700 focus-visible:ring-2 focus-visible:ring-brand-600/30 dark:hover:text-gray-300">
              <RotateCcw className="h-4 w-4" /> Qayta
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 2: Type-check and build**

Run: `npm run build -w @credit-core/shared && npm run typecheck -w @credit-core/ui && npm run build -w @credit-core/ui`
Expected: no type errors; build succeeds. (If `typecheck` script is absent, use `npx tsc -p packages/ui/tsconfig.json --noEmit`.)

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/pages/origination/PassportScan.tsx
git commit -m "feat(passport): redesigned scan card — drag-drop, nationality, expiry banner"
```

---

## Task 5: Citizenship dropdown + nationality wiring (steps.tsx)

**Files:**
- Modify: `packages/ui/src/pages/origination/steps.tsx`

**Interfaces:**
- Consumes: `NATIONALITY_OPTIONS` (Task 1); redesigned `PassportScan` (Task 4).
- Produces: Step1 citizenship `Select` uses the shared ~20 list (searchable); scanned `nationality` maps to the borrower's `citizenship`.

- [ ] **Step 1: Import the shared list**

In `packages/ui/src/pages/origination/steps.tsx`, add `NATIONALITY_OPTIONS` to the existing `@credit-core/shared` import (the line that imports `ProductType, RepaymentMethod, …` — or add a new import if the file imports types only):

```ts
import { NATIONALITY_OPTIONS } from '@credit-core/shared';
```

- [ ] **Step 2: Wire nationality → citizenship in the scanner mount**

Replace the `PassportScan` line in `Step1`:

```tsx
      <PassportScan onExtract={(x) => {
        const { nationality, ...rest } = x;
        set({ ...rest, ...(nationality ? { citizenship: nationality } : {}) } as Partial<Borrower>);
      }} />
```

- [ ] **Step 3: Expand the citizenship dropdown**

Replace the `Fuqarolik` field's `options` so it uses the shared list and is searchable:

```tsx
        <Field label="Fuqarolik"><Select searchable value={(b.citizenship ?? '') as string} onChange={(v) => set({ citizenship: v })} options={opt(NATIONALITY_OPTIONS)} /></Field>
```

- [ ] **Step 4: Type-check and build**

Run: `npm run build -w @credit-core/shared && npm run typecheck -w @credit-core/ui && npm run build -w @credit-core/ui`
Expected: no type errors; build succeeds. (`Select` already preserves values not in the option list, so a scanned name outside the ~20 still displays.)

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/pages/origination/steps.tsx
git commit -m "feat(passport): ~20-nationality citizenship dropdown + scan→citizenship"
```

---

## Task 6: Dockerfile — drop the unused OSD traineddata

**Files:**
- Modify: `deploy/Dockerfile.backend`

**Interfaces:** none (build-only). The scanner brute-forces orientations, so Tesseract OSD is never invoked; `osd.traineddata` is dead weight.

- [ ] **Step 1: Remove the OSD download**

In `deploy/Dockerfile.backend`, change the traineddata download block to fetch only `eng.traineddata`:

```dockerfile
# Bundle Tesseract traineddata so passport OCR runs fully offline at runtime (no CDN fetch).
RUN mkdir -p apps/backend/tessdata \
  && curl -fsSL -o apps/backend/tessdata/eng.traineddata https://github.com/tesseract-ocr/tessdata_fast/raw/main/eng.traineddata
```

(Delete the `&& curl … osd.traineddata …` continuation line.)

- [ ] **Step 2: Sanity-check the Dockerfile**

Run: `grep -n "traineddata" deploy/Dockerfile.backend`
Expected: only `eng.traineddata` references remain; no `osd.traineddata`.

- [ ] **Step 3: Commit**

```bash
git add deploy/Dockerfile.backend
git commit -m "chore(passport): drop unused OSD traineddata from the image"
```

---

## Final verification

- [ ] Run the whole passport suite: `npm run build -w @credit-core/shared && npm test -w @credit-core/backend -- passport`
      Expected: all `mrz.util.spec`, `nationality.spec`, `passport.service.spec` tests pass.
- [ ] Build the UI: `npm run build -w @credit-core/ui`
      Expected: success.
- [ ] Optional manual smoke (needs deps installed + a passport image): start the backend, `POST /passport/scan` with an image, confirm `fields.nationality` and any `expired` warning.

---

## Self-Review

**Spec coverage:**
- Tilted/upside-down photos → four-orientation brute force retained (Task 3). ✅
- Blurry ("xira") → sharpen + upscale-to-1500 + binarized 2nd pass + `failOn:'none'` (Task 3). ✅
- Expiry warning ("muddati") → `expiryWarnings` + century fix (Task 2), surfaced in service (Task 3) and UI banner (Task 4). ✅
- Nationality UZB-first + ~20 → shared map (Task 1), extraction (Task 2), DTO+service (Task 3), UI field (Task 4), dropdown + wiring (Task 5). ✅
- Ideal UI via ui-ux-pro-max → Task 4 (drag-drop, animated confidence, chips, banner). ✅

**Type consistency:** `nationality: string` is added to `MrzFields` (optional input) and to `PassportScanResult.fields` + `EMPTY` + `emptyResult()` consistently. `expiryWarnings(expiryIso, now?)` signature matches its call in `run`. `onExtract` patch type `Partial<PassportScanResult['fields']>` matches both producer (PassportScan) and consumer (steps translates `nationality`→`citizenship`). ✅

**Placeholder scan:** no TBD/TODO; every code step shows full content. ✅
