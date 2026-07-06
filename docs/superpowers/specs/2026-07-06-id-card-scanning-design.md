# ID-card scanning (front + back) — design

Date: 2026-07-06
Status: approved (design), pending implementation plan

## Goal

Extend the passport MRZ scanner to also read **Uzbek ID cards (SHAXS GUVOHNOMASI)**. An ID
card has no MRZ on the front — the machine-readable zone is on the **back**, and it sits over a
security-pattern background with a QR/chip nearby, so the MRZ **name line** reads poorly. The
front, however, prints the name and other fields as clean labelled text that OCRs well.

Solution: for ID cards the operator uploads **both sides**. We take the **check-digit-verified
numbers from the back MRZ** and the **name (+ a few fields) from the front VIZ**, and merge them.

## Feasibility evidence (verified against real fixtures)

- Passport (TD3) already reads at 100% with the dedicated `mrz` model. Unchanged.
- ID **back** MRZ: cropping to the bottom band + PSM 3/4 yields **lines 1 & 2 perfect** (30 chars,
  no noise) → doc `AE1295616`, DOB `840708`, expiry `350120`, sex `F` all correct at 100%
  check-digit confidence. The **name line** (line 3) stays corrupted (`CQODIROVA<<XOLISX0O8`).
- ID **front** VIZ (general `eng-best` model): cleanly reads `QODIROVA`, `XOLISXON`,
  `MUXTOROVNA`, `08.07.1984`, `AYOL`, `21.01.2025`, `O'ZBEKISTON`, `20.01.2035`, `AE1295616`,
  with all bilingual labels legible for anchoring.
- ID **back** printed VIZ: `Place of birth = QORAKO'L TUMANI` reads cleanly; `Place of issue
  (IIV 6230)` reads poorly (`vé230`) → best-effort; printed personal number has a 1-digit OCR
  error, so PINFL is taken from the **MRZ** (correct), not the printed VIZ.

## Scope

**In:** UZ ID card (TD1) front+back scanning; a Passport/ID toggle; merged field extraction;
archiving both images; unit + opt-in integration tests.

**Out (future):** auto-detecting document side/type; non-UZ ID cards; perfect issuer OCR;
reading the MRZ name line reliably.

## UX (frontend — `packages/ui/src/pages/origination/PassportScan.tsx`)

- A segmented **`Passport / ID-karta`** toggle at the top of the scan card. Default: Passport.
- **Passport mode:** one upload zone (unchanged).
- **ID mode:** two labelled zones — **Old tomon** and **Orqa tomon**. A **Skanerlash** button
  runs once both images are chosen. (Each zone keeps its own preview + clear/retry.)
- Result view unchanged: confidence ring + editable fields grid + trust gate (`<60%` → prompt
  retake, no prefill) + "Formani to'ldirish".
- Fields sourced from the front VIZ (name, issue date, place of birth, issuer) show a neutral
  **"tekshiring"** hint (they are OCR, not check-digit verified). MRZ fields keep the existing
  validity chips.

## Data model (`packages/shared/src/dto.ts`)

Extend `PassportScanResult.fields` with three **optional** fields (passport results simply omit
them, so nothing changes for the passport flow):

```ts
fields: {
  ...existing,
  placeOfBirth?: string;      // 'Tug'ilgan joy'  (back VIZ)
  passportIssueDate?: string | null; // ISO — 'Berilgan sana' (front VIZ)
  passportIssuer?: string;    // 'Pasport kim bergan' (back VIZ, best-effort)
}
```

Add `docType?: 'PASSPORT' | 'ID'` to the result and a `unverifiedFields: string[]` list naming
the OCR-sourced (non-check-digit) fields, so the UI can render the "tekshiring" hints generically.

## Backend (`apps/backend/src/passport`)

New endpoint **`POST /passport/scan-id`** — multipart with `front` and `back` files → the same
`PassportScanResult` shape (`docType: 'ID'`). Existing `POST /passport/scan` (passport, 1 file)
is unchanged. `api-client` gains `scanIdCard(front, back)`.

### Back MRZ (verified numbers)

Reuse the MRZ pipeline with an ID-optimised preprocessing path (we know this image is the back):
- **Crop to the bottom MRZ band** before OCR (removes QR/chip/hologram noise) — proven to make
  lines 1 & 2 clean. Still sweep the 4 orientations; keep the full-frame fallback for robustness
  to padding.
- **TD1 handling:** accept the 3-line group; lower the per-line length floor so a short/mangled
  name line isn't dropped; map **PINFL from `optionalData1`** (Uzbek puts the 14-digit personal
  number there), not the `personalNumber` field.
- Take from the back MRZ (check-digit verified): `passportSeries`+`passportNumber` (from doc
  number, e.g. `AE1295616` → `AE`/`1295616`), `birthDate`, `gender`, `passportExpiry`, `pinfl`,
  `nationality`. The corrupted MRZ **name is ignored** — the name comes from the front.

### Front VIZ (name + a few fields) — `id-front.util.ts`

- OCR the full front with the general text model (`eng`).
- **Label-anchored extraction** (pure, testable function over the OCR text): find known bilingual
  labels and take the value on the same/next line; dates via `dd.mm.yyyy`:
  - Surname → `Familiyasi / Surname`; Given → `Ismi / Given name(s)`; Patronymic →
    `Otasining ismi / Patronymic` → `fullName = "SURNAME GIVEN PATRONYMIC"`.
  - `passportIssueDate` → `Berilgan sanasi / Date of issue`.
  - `nationality` → `Fuqaroligi / Citizenship` (fallback to MRZ nationality).
  - DOB / expiry / card number extracted too, used only as a **cross-check** against the MRZ.
- Label matching is fuzzy (tolerate OCR noise in the label words); values are trimmed to sane
  charsets (letters for names, digits/dots for dates).

### Back VIZ (bonus)

OCR the upper region of the back with `eng`; anchor `Place of birth` → `placeOfBirth`,
`Place of issue` → `passportIssuer` (best-effort; may be blank if unreadable).

### Merge, confidence, cross-check

- **Verified MRZ numbers win** for series/number, DOB, sex, expiry, PINFL, nationality.
- Name, issue date, place of birth, issuer come from OCR → listed in `unverifiedFields`.
- **Confidence = the back MRZ check-digit score.** If the back MRZ isn't found → return
  `mrz_not_found` (warning `id_back_mrz_not_found`) so the UI says "orqa tomonni qayta oling".
- **Cross-check:** if front DOB/expiry ≠ MRZ DOB/expiry → add warning `front_back_mismatch`
  (keep the MRZ value, flag for the operator).

## Models / infra (`deploy/Dockerfile.backend`)

Bundle **both** traineddata: `mrz` (MRZ) **and** `eng` (VIZ text). Dev fetches both via
`npm run setup:ocr`. Model choice for VIZ: `eng` — start with `tessdata_best/eng` for accuracy
(front read clean in testing); revisit `tessdata_fast/eng` if image size/latency matters.

## Field → source map

| Form field            | Source                          | Verified            |
|-----------------------|---------------------------------|---------------------|
| F.I.O (fullName)      | Front VIZ (surname+given+patr.) | No (OCR)            |
| Pasport seriya/raqami | Back MRZ (doc number)           | Yes (check digit)   |
| PINFL                 | Back MRZ (optionalData1)        | Yes (composite)     |
| Tug'ilgan sana        | Back MRZ (front = cross-check)  | Yes                 |
| Jinsi                 | Back MRZ                        | Yes                 |
| Amal muddati          | Back MRZ (front = cross-check)  | Yes                 |
| Fuqarolik             | Back MRZ nationality / front    | Yes (MRZ)           |
| Berilgan sana         | Front VIZ                       | No (OCR)            |
| Tug'ilgan joy         | Back VIZ                        | No (OCR)            |
| Pasport kim bergan    | Back VIZ (best-effort)          | No (OCR)            |

## Error handling & audit

- Missing front or back → `400`. Back MRZ not found → result with `id_back_mrz_not_found`.
- Archive **both** images (front + back) under the scan dir with a shared id, and log the merged
  outcome (reuse the existing `scan-archive` + `PassportScan` logger).

## Testing

- Unit: `id-front.util` label extraction over sample OCR text (name incl. patronymic, dates,
  fuzzy/noisy labels, missing fields).
- Unit: TD1 mapping — PINFL from `optionalData1`; series/number from doc number.
- Unit: merge logic — MRZ wins for numbers; cross-check mismatch warning; `unverifiedFields`.
- Opt-in integration (`RUN_OCR_IT=1`): real front+back fixtures → asserts
  `fullName = "QODIROVA XOLISXON MUXTOROVNA"`, doc `AE1295616`, DOB/expiry/sex, PINFL
  `40807841080026`, place of birth `QORAKO'L TUMANI`.

## Risks / open items

- Issuer ("IIV 6230") OCRs unreliably → best-effort, operator fills manually. Acceptable.
- Front OCR has no check digits → name could be mis-read; mitigated by the "tekshiring" hint and
  operator review. The prefill still saves most typing.
- Bundling `eng-best` adds ~15 MB to the image; acceptable, revisit with `eng-fast` if needed.
- Label layouts assume the current UZ ID template; a redesigned card would need new anchors.
