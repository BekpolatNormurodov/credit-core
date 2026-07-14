# Excel-Fidelity Document Rebuild — Design

**Date:** 2026-07-15
**Status:** Approved direction (pending written-spec review)

## Goal

Rebuild every generated PDF document so its structure, labels, full legal text,
tables, collateral detail, and signature lines match the reference Excel workbooks
**1:1**, filled from data we already store. No truncation, no thinned-out forms.

## Context & source of truth

Three reference workbooks (one per collateral type), all sharing the same ~31 sheets:

- `АВТО мфл TRUST (3).xlsx` — auto collateral
- `КВАРТИРА мфл TRUST (3).xlsx` — apartment (Kvartira)
- `ХОВЛИ мфл TRUST (3).xlsx` — house (Hovli)

The sheets differ only in the collateral-specific rows. **Each sheet is the exact
form to reproduce.** During implementation, every template's sheet will be re-dumped
(cells + merges) and matched cell-by-cell.

### Sheet → document mapping

| Excel sheet | Template / registry key | Depth |
|---|---|---|
| Score отчет | `scoreReport` | rebuild |
| Приказ на сделку | `prikaz` (+ `prikazNotary`) | rebuild |
| Кредитная заявка | `creditApplication` | rebuild |
| договор узб | `contract` | verify vs Excel + typography |
| Ходатайство | `petition` | verify + typography |
| Протокол | `protokol` | rebuild |
| РКЛ Ген | `rklGen` (+ `rklGenNotary`) | rebuild (numbered chapters) |
| Акт согласования | `act` (+ `actNotary`) | rebuild (two valuation tables) |
| обложка | `obloshka` | rebuild (big centered borrower name) |
| перечень | `cheklist` | rebuild |
| Акт мониторинга 1/2/3 | `monitoring1/2/3` | rebuild |
| График N мес | `grafik` | already live-computed; add two-party requisites block + typography |
| (buxgalteriya, our own) | `accountantSplit`, `disbursement` | keep; apply typography |

Sheets NOT in our set (out of scope): `Д0–Д3`, `балл`, `b3`, `b4`, `договор рус`,
`Претензион`, `Справка`, `перечень` duplicates. `Претензион`/`Справка` may be added in
a later cycle if requested.

## Global changes (shared, apply to every document)

In `apps/backend/src/output/documents/doc-layout.ts`:

1. **Line spacing** — `defaultStyle.lineHeight = 1.15` (≥1.1× as requested), applied
   via a shared base so every template inherits it.
2. **Headings** — bump `docTitle` size; add `sectionTitle(text)` = centered, bold,
   larger, for contract/kelishuv chapter headings ("1. КЕЛИШУВ ПРЕДМЕТИ", etc.).
3. **Signatures** — dash-line signature blocks (`____________`) with
   `Ф.И.Ш. / Имзо / Сана` captions, matching the Excel exactly.

### Organization trademark «PULMAKON»

The reference forms brand the org as **«PULMAKON» Савдо белгиси МЧЖ «CLEVER
MIKROMOLIYA TASHKILOTI»** (clearest in РКЛ Ген's opening clause). Add:

- `tradeMark String?` to `Organization` (nullable — small `prisma db push` migration).
- Expose it on the organization DTO / doc data.
- Templates render `«{tradeMark}» Савдо белгиси {nameUpper}` wherever the Excel does
  (РКЛ Ген opening; anywhere else the sheets show it). Falls back cleanly to just
  `{nameUpper}` when `tradeMark` is null.

The real org values (name, director Б.Исмоилов, address, р/с, МФО, ИНН, trademark)
are **configuration** the user seeds via the admin org settings — not hardcoded here.

## Collateral variants

Every collateral-bearing form branches on `collateral.type`:

- **AUTO** — model, `bodyType` (тип кузова), `bodyNo` (кузов №), `engineNo`
  (двигатель №), `chassis` (шасси), `techPassportNo` + `techPassportDate`,
  `stateNumber` (давлат рақами), garage/reg address, `color`, `year`.
- **REAL_ESTATE** (Hovli / Kvartira via `realtyKind`) — `roomCount`, `roomNames`,
  `totalAreaM2`, `livingAreaM2`, `landAreaM2`, `usableAreaM2`, `registryNo` (реестр),
  `cadastreNo` (кадастр), `address`.

Multi-collateral cases list each item. Auto-only cases hide the insurance-polis line
(the Excel's "если обеспечывается только автомобилем полис скрыть" rule).

All required fields already exist in the `Collateral` schema and are captured in the
wizard (`CaseForm.tsx`, `TexScan.tsx`) — **no schema/wizard change** beyond the org
trademark. A genuinely-empty field renders `—`.

## Data mapping & null-safety

Each template maps Excel cells → `CaseDocData` fields. Every value null-safe (`—`),
sums spelled with `sumToWordsUz` (e.g. "Тўқсон миллион сўм 00 тийин"), dates via
`dateToUzbekWords`. No `NaN`, no raw `Date`/GMT leaks.

## Per-document structure notes (high level; exact cells re-dumped at build time)

- **scoreReport** — header table (Ф.И.Ш / Манзил / Фаолият тури / Кредит тури /
  лимит-in-words / муддат / фоиз), "Скоринг натижаси:" 6 gate rows each with a verdict
  from the stored `ScoringResult`, Скоринг балл, highlighted ХУЛОСА, credit-manager
  signature line.
- **prikaz** — org header, "…йилдаги №… БУЙРУҒИ", 5 numbered conditions (shakl, limit
  in words, term, rate + penalty 105%, taʼminot), collateral block (auto/real-estate),
  owner + reestr/kadastr/address lines, director signature.
- **creditApplication** — "Микроқарз олиш учун АРИЗА", borrower address/citizenship
  line, туғилган сана, паспорт маълумотлари, фаолият жойи, лавозими, ўртача даромад,
  loan terms (sum-in-words, term-in-words, rate), taʼminот paragraph (collateral
  variant), insurance-polis line (hidden when auto-only), acceptless-withdrawal clause,
  KATM/bureau/garov-reestr consent checkboxes, ариза санаси, signature.
- **rklGen (Бош келишув)** — title "№… СОНЛИ … БОШ КЕЛИШУВ", parties clause with
  «PULMAKON» trademark, numbered chapters via `sectionTitle` (1. КЕЛИШУВ ПРЕДМЕТИ,
  2. МИКРОҚАРЗ/МИКРОКРЕДИТ БЕРИШ ШАРТЛАРИ, …), two-party requisites + signatures.
- **act (Далолатнома)** — title "…ҚИЙМАТИНИ КЕЛИШИШ ДАЛОЛАТНОМАСИ №1", intro clause,
  **two valuation tables** (declared vs agreed value) with collateral composition /
  living area / land area / agreed залоговая стоимость, owner/reestr/kadastr/address
  lines, 1-тарафдан / 2-тарафдан signatures.
- **obloshka** — big centered borrower name, org header, "№… БОШ КЕЛИШУВ" subtitle,
  Фоиз ставкаси / муддати / микдори, city + date footer.
- **grafik** — existing live schedule + append the two-party requisites block from the
  Excel (ММТ: адрес/р-с/МФО/ИНН/тел/director // Қарздор: манзил/паспорт/тел/signature).
- **protokol, cheklist, monitoring1/2/3** — rebuilt to their sheet layouts.

## Non-goals

- No scoring engine changes (scoreReport renders the stored `ScoringResult`).
- No new wizard capture fields (data already sufficient; org trademark is admin config).
- `Претензион` / `Справка` sheets deferred unless requested.

## Testing / verification

- One `*.spec.ts` per rebuilt template asserting: key labels/rows present, correct
  collateral-variant text (auto vs real-estate), sum-in-words present, no `NaN`, no raw
  `Date`/GMT leak, null-safety when sections are missing.
- `sumToWordsUz`/`dateToUzbekWords` reused (already tested).
- Gate: full backend Jest suite green + all 4 web apps `tsc --noEmit` before each commit.
- Manual: post-auth, not previewable locally — verification is the test suite + visual
  diff of generated PDFs against the Excel sheets.

## Risks

- Some Excel cells embed cross-sheet formulas (`={'Акт согласования'!C18}`) — resolved
  by mapping to the underlying `CaseDocData` field, not the formula.
- Exact wording is long Cyrillic legal text — transcription errors are the main risk;
  mitigated by re-dumping each sheet at build time and diffing.
