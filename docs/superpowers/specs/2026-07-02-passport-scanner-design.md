# Passport scanner (on-prem MRZ + check-digit) — design

Date: 2026-07-02

## Problem

During application creation (the origination wizard's borrower step), the operator types
the borrower's passport fields by hand. We want a fast passport scanner: the operator
uploads/photographs the passport, and the app extracts the ID fields and reports how
accurate the read is ("necha foiz aniq"). It must tolerate blurry, skewed, upside-down,
or sideways images, and be fast. The bank is on-prem — customer passport PII must not
leave the server.

## Chosen approach — on-prem, MRZ-based

The read targets the passport's **Machine-Readable Zone (MRZ)** — the two `<<<` lines at
the bottom (TD3 for the passport booklet; TD1/TD2 also supported). The MRZ is printed in
OCR-B and carries **check digits** for the document number, birth date, expiry date, the
optional/personal-number field, and a final **composite** check. Each check digit is a
`[7,3,1]`-weighted, mod-10 checksum over its field. Validating them gives a rigorous,
non-guessed accuracy percentage — this is the "formula/rules" the user asked for.

Everything runs on the backend (the bank's own server): the image is processed in memory
and is **not persisted by the scan endpoint** (stateless), so scanning works before a
draft case exists and no PII is stored by the feature itself.

## Scope boundary

- **In:** MRZ read → extract fullName, passportSeries+passportNumber, birthDate, sex,
  expiryDate, and PINFL (when the MRZ optional field carries a 14-digit JSHSHIR);
  confidence % + per-field validity; robustness to rotation (0/90/180/270) and mild
  skew/blur; a scan UI in the borrower step that prefills the form on confirm.
- **Out:** data-page (non-MRZ) OCR of address / issuing authority / photo; liveness or
  anti-fraud; storing the passport image (the existing document-upload flow already
  covers attaching a passport document to a saved case — unchanged).

## Architecture

### Backend — new module `apps/backend/src/passport/`

`POST /passport/scan` (JWT-guarded, multipart `file`) → `PassportScanResult`. Stateless.

Pipeline:
1. **Preprocess** (`sharp`): decode, auto-orient by EXIF, grayscale, normalize/contrast,
   downscale to a max width for speed.
2. **Orientation search**: for each rotation in `[0, 90, 180, 270]` degrees, run OCR on the
   bottom band (where the MRZ lives) and attempt an MRZ parse; keep the rotation whose
   parse scores highest. This handles upside-down / sideways captures.
3. **OCR** (`tesseract.js`, WASM — no native deps): recognise the MRZ band with the
   character whitelist `A-Z0-9<`. Traineddata (`eng`, `osd`) is **bundled offline** in the
   image (no runtime CDN fetch) to satisfy the air-gapped on-prem constraint.
4. **Parse + validate** (`mrz` npm package): parse the two/three MRZ lines into fields and
   per-check-digit validity (`details[]` with `valid` flags).
5. **Score + map** (our code): compute the confidence % from the check-digit validities and
   map MRZ fields to borrower fields.

### Confidence formula (pure, unit-tested)

From the `mrz` parse `details[]`, take the check-digit entries and weight them:

```
CHECK_WEIGHT = {
  compositeCheckDigit: 4,     // whole-MRZ integrity — weighted highest
  documentNumberCheckDigit: 3,
  birthDateCheckDigit: 2,
  expirationDateCheckDigit: 2,
  personalNumberCheckDigit: 1,
}
confidence% = round(100 * Σ(weight·valid) / Σ(weight)) over the check digits present
```

Thresholds shown in the UI: **≥ 90** green "aniq" · **60–89** yellow "tekshiring" ·
**< 60** red "qayta suratga oling".

### Field mapping (pure, unit-tested)

`mrz` `fields` → borrower:
- `lastName` + `firstName` → `fullName` (strip `<`, collapse spaces, trim).
- `documentNumber` (e.g. `AA1234567`) → `passportSeries` = leading 2 letters,
  `passportNumber` = remaining digits (max 7).
- `birthDate` (YYMMDD) → ISO `birthDate` (century rule: birth is in the past).
- `expirationDate` (YYMMDD) → ISO `passportExpiry` (future-biased century rule).
- `sex` `M`/`F` → `gender` `MALE`/`FEMALE`.
- `personalNumber` → `pinfl` only when it reduces to exactly 14 digits.

### Shared DTO — `packages/shared/src/dto.ts`

```ts
export interface PassportScanResult {
  confidence: number; // 0..100
  fields: {
    fullName: string; passportSeries: string; passportNumber: string;
    birthDate: string | null; passportExpiry: string | null;
    gender: 'MALE' | 'FEMALE' | ''; pinfl: string;
  };
  perField: { key: string; value: string; valid: boolean }[];
  format: string;        // 'TD1' | 'TD2' | 'TD3' | ''
  rawMrz: string[];      // the recognised MRZ lines (for debugging/manual check)
  warnings: string[];    // e.g. 'mrz_not_found', 'low_confidence'
}
```

### API client — `packages/api-client/src/index.ts`

`scanPassport(file: File): Promise<PassportScanResult>` (multipart POST, existing FormData
pattern).

### Frontend — `packages/ui/src/pages/origination/PassportScan.tsx`

A card at the top of the borrower step (`steps.tsx` `BorrowerStep`). Uses the
**ui-ux-pro-max** guidelines. Flow:
- Dropzone + mobile camera (`<input type="file" accept="image/*" capture="environment">`).
- On select: preview + async scan with a progress/skeleton state (feedback < 100 ms; no
  blocking spinner beyond ~1 s → skeleton).
- Result panel: an overall **confidence ring** (green/yellow/red per thresholds) and each
  extracted field as an editable input with a per-field validity chip. Low-confidence or
  failed fields are highlighted with a "qayta oling" hint (lighting / flat / MRZ visible).
- "Formani to'ldirish" button → `set({...})` merges the confirmed fields into the borrower
  form. The operator can edit any field before confirming (never auto-commit silently).
- Accessibility: labelled inputs, focus-visible, 44px targets, error text below the field.

### Deps + Docker

- Backend deps: `sharp`, `tesseract.js`, `mrz`.
- Dockerfile: Debian-based Node image (sharp/libvips prebuilt binary available; avoid
  Alpine unless `vips` is installed). Bundle `eng.traineddata` + `osd.traineddata` into a
  local `tessdata/` dir and point tesseract.js `langPath`/`cachePath` at it (offline).
- Guard rails: max upload size (~10 MB), image-only mime check, a per-scan timeout so a
  pathological image can't hang a worker.

## Testing

- **Unit (pure):** confidence formula over crafted `details[]` (all valid → ≥90; composite
  invalid → capped < 90; partial → weighted); MRZ→borrower field mapping (name join,
  documentNumber split, YYMMDD→ISO century rules, sex, 14-digit PINFL gate); MRZ-line
  extraction from noisy OCR text.
- **Integration (backend):** the scan orchestration with a stubbed OCR returning a known
  MRZ pair → asserts fields + confidence; orientation search picks the correct rotation
  when the stub only "reads" at 180°.
- **Frontend:** the scan component renders confidence + fields, low-confidence highlight,
  and confirm calls `onExtract` with the mapped fields.
- **Manual:** photograph a passport straight, rotated 180°, sideways, and mildly blurred;
  confirm fields fill and the confidence badge matches the check-digit outcome.
- Node is not on the dev machine's PATH; `tsc`/tests run at the Docker deploy build. Verify
  locally via targeted reads + review.

## Risks / notes

- **tesseract.js speed:** WASM OCR of the MRZ band (small crop, whitelisted charset) is the
  fast path; running four orientations multiplies work — cap by trying orientation 0 first
  and short-circuiting when the composite check passes.
- **`mrz` field keys:** the mapping/scoring reads the `mrz` package's documented
  `fields`/`details[].field` names; confirm against the installed version at build.
- **Uzbek PINFL in MRZ:** present in the optional/personal-number field on most UZ
  biometric passports but not guaranteed — mapped only when it yields 14 digits, else left
  for manual entry.
- **On-prem:** no image or PII leaves the server; the scan endpoint persists nothing.
