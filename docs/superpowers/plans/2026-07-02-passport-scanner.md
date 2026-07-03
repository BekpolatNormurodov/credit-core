# Passport Scanner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** Add an on-prem passport scanner to the origination borrower step that reads the MRZ, reports a check-digit-based accuracy %, and prefills the borrower form — robust to rotation/skew/blur, private (no PII leaves the server).

**Architecture:** Backend `POST /passport/scan` (stateless, JWT) → sharp preprocess + 4-orientation search + tesseract.js OCR of the MRZ band + `mrz` parse/validation → weighted check-digit confidence + field mapping. React `PassportScan` in the wizard borrower step prefills via `f.setBorrower`.

**Tech Stack:** NestJS, `sharp`, `tesseract.js` (offline traineddata), `mrz`; React + Vite.

## Global Constraints

- On-prem: the scan endpoint persists nothing; image processed in memory only.
- Accuracy % = weighted mean of MRZ check-digit validities: `compositeCheckDigit`=4, `documentNumberCheckDigit`=3, `birthDateCheckDigit`=2, `expirationDateCheckDigit`=2, `personalNumberCheckDigit`=1. Thresholds: ≥90 green, 60–89 yellow, <60 red.
- Uzbek text UI (this branch is off master — labels are single-language here).
- Node not on PATH locally → build/tests run at Docker deploy. Commit trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## File map

- `packages/shared/src/dto.ts` — add `PassportScanResult`.
- `apps/backend/src/passport/mrz.util.ts` — pure: `scoreConfidence`, `mapMrzToBorrower`, `yymmddToIso`, `extractMrzLines`.
- `apps/backend/src/passport/mrz.util.spec.ts` — unit tests.
- `apps/backend/src/passport/passport.service.ts` — OCR pipeline (sharp + tesseract.js + orientation loop), injectable OCR for tests.
- `apps/backend/src/passport/passport.module.ts` — controller `POST /passport/scan` + module.
- `apps/backend/src/app.module.ts` — register `PassportModule`.
- `apps/backend/package.json` — deps `sharp`, `tesseract.js`, `mrz`.
- `deploy/Dockerfile.backend` — download `eng`/`osd` traineddata into `tessdata/` (offline runtime).
- `packages/api-client/src/index.ts` — `scanPassport(file)`.
- `packages/ui/src/pages/origination/PassportScan.tsx` — scan UI.
- `packages/ui/src/pages/origination/steps.tsx` — mount `<PassportScan>` in `Step1`.

---

### Task 1: Shared DTO

Add to `packages/shared/src/dto.ts`:

```ts
export interface PassportScanResult {
  confidence: number;
  fields: {
    fullName: string; passportSeries: string; passportNumber: string;
    birthDate: string | null; passportExpiry: string | null;
    gender: 'MALE' | 'FEMALE' | ''; pinfl: string;
  };
  perField: { key: string; value: string; valid: boolean }[];
  format: string;
  rawMrz: string[];
  warnings: string[];
}
```

Commit: `feat(passport): PassportScanResult DTO`.

### Task 2: Pure MRZ util (formula + mapping) — TDD

Create `apps/backend/src/passport/mrz.util.ts` and `mrz.util.spec.ts`. Code is in the implementation; the confidence weights and mapping rules follow Global Constraints and the spec. Tests: all-valid details → ≥90; composite-invalid → <90; `mapMrzToBorrower` name join, documentNumber split (2 letters + 7 digits), YYMMDD→ISO century rules, sex→gender, 14-digit PINFL gate; `extractMrzLines` picks the trailing MRZ lines from noisy OCR text.

Commit: `feat(passport): MRZ confidence formula + field mapping`.

### Task 3: OCR pipeline service

Create `apps/backend/src/passport/passport.service.ts`. `scan(buffer, ocr?)`: create one tesseract worker (whitelist `A-Z0-9<`), loop orientations `[0,90,180,270]` — preprocess via sharp (rotate, grayscale, normalize, resize), OCR, `extractMrzLines`, `mrz.parse`, `scoreConfidence`; keep best, short-circuit when `parsed.valid`. Map fields, build `perField` from check-digit details. `ocr` param injectable for tests.

Commit: `feat(passport): sharp+tesseract MRZ scan pipeline`.

### Task 4: Controller + module + wiring

Create `apps/backend/src/passport/passport.module.ts` (`@Controller('passport')`, `POST scan` with `FileInterceptor`, JWT guard, image-mime + presence checks), register `PassportModule` in `app.module.ts`.

Commit: `feat(passport): POST /passport/scan endpoint`.

### Task 5: Backend deps + Docker offline traineddata

`apps/backend/package.json`: add `sharp`, `tesseract.js`, `mrz` to dependencies. `deploy/Dockerfile.backend`: in the build stage, `curl` `eng.traineddata` + `osd.traineddata` into `/app/apps/backend/tessdata/`, copy to runtime, set `ENV TESSDATA_PATH=/app/apps/backend/tessdata`.

Commit: `build(passport): sharp/tesseract/mrz deps + offline tessdata`.

### Task 6: API client

`packages/api-client/src/index.ts`: `scanPassport(file: File): Promise<PassportScanResult>` (multipart, existing FormData pattern).

Commit: `feat(passport): api-client scanPassport`.

### Task 7: PassportScan component (ui-ux-pro-max)

Create `packages/ui/src/pages/origination/PassportScan.tsx`: dropzone + mobile camera input, preview, async scan with skeleton, confidence ring + per-field editable inputs with validity chips, low-confidence hint, "Formani to'ldirish" → `onExtract(fields)`.

Commit: `feat(passport): scan UI card`.

### Task 8: Integrate into borrower step

`steps.tsx` `Step1`: render `<PassportScan onExtract={(x) => set(x)} />` above the fields.

Commit: `feat(passport): mount scanner in borrower step`.

### Task 9: Verify

Build/tests at Docker deploy; manual: straight / 180° / sideways / blurred photo → fields fill, confidence matches check digits.
