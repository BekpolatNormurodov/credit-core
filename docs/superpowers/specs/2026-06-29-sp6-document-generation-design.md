# SP-6 — Document Generation (PDF) — Design Spec

> Sub-project 6 of the CLEVER Mikromoliya workbook program. Generates the workbook's official
> documents as PDFs inside credit-core.
> Companion reference: [`docs/analysis/2026-06-29-mko-workbook-analysis.md`](../../analysis/2026-06-29-mko-workbook-analysis.md) §4 (document inventory).
> Depends on: **SP-1** (data model) and **SP-2** (number/date → words utilities).

## 1. Goal

From a credit-core case's data, generate the workbook's official documents as **PDF**, each
**viewable in-app** and **downloadable separately**. Documents are visible from the moment the case
is submitted (leaves DRAFT), carry a **"TASDIQLANMAGAN / НЕ УТВЕРЖДЕНО" watermark until the director
approves**, and render clean afterwards.

## 2. Scope

**In scope:** 13 of the 15 documents (§5; the 2 servicing/collections docs — monitoring act, claim
letter — land in SP-8); on-demand PDF rendering (no persistence); conditional watermark; list + view
+ download API; a "Hujjatlar" panel in `CaseView`; Cyrillic/Uzbek fonts.

**Out of scope:** editable Word/Excel output (PDF only); persisting generated files; e-signatures;
the Excel-workbook export (that is SP-7); data entry for the documents (SP-1/SP-3 own that).

## 3. Behaviour

### 3.1 Availability & roles
- Available when `case.status != DRAFT` (i.e. from `MODERATION` onward).
- Visible to **all roles**: operator, moderator, director, admin (operator sees their own submitted case).
- In `DRAFT` the panel shows "case hali yuborilmagan" and the endpoints return 409 (not yet available).

### 3.2 Watermark (approval state)
Rendered server-side based on `case.status`:

| Status | Render |
|---|---|
| `DRAFT` | not available (409) |
| `MODERATION`, `DIRECTOR_REVIEW` | **watermarked** "ТASDIQLANMAGAN / НЕ УТВЕРЖДЕНО" (diagonal, grey, low opacity) |
| `ADMIN_FINALIZE`, `FINALIZED` | **clean** (no watermark) — director has approved |
| `REJECTED`, `CANCELLED` | watermarked "RAD ETILGAN" / "BEKOR QILINGAN" |

> Rule: the watermark drops the moment the case moves **past** `DIRECTOR_REVIEW` (director's APPROVE
> transition to `ADMIN_FINALIZE`). This matches the user decision "director tasdiqlaganda".

### 3.3 Generation strategy
- **On-demand, transient**: each request renders a fresh PDF from current case data. Nothing is
  stored — documents always reflect the latest data and approval state. (Persisting an official
  finalized copy as `Document(GENERATED_PDF)` is a possible later add; out of scope now.)

## 4. Architecture

### 4.1 Backend (`apps/backend`)
Extend the existing **`output`** module (already renders the valuation-act PDF via `pdfmake`).

- **Document registry**: `Map<DocKey, TemplateFn>` where
  `TemplateFn = (data: CaseDocumentData, opts: { watermark?: string }) => TDocumentDefinitions`.
- **`CaseDocumentData`**: a single loader assembles the case with all SP-1 relations
  (`Organization`, `Borrower`, `Employment`, `Affordability`, `CreditHistory`, `ScoringResult`,
  `CreditLine` → `Tranche` → `PaymentSchedule`, `Collateral`/`CollateralOwner`, `ValuationAct`,
  `InsurancePolicy`).
- **Shared layout helpers**: org letterhead/requisites block (from `Organization`), signature
  blocks, the diagonal watermark layer (pdfmake `watermark: { text, opacity, angle }`), and amount/
  date → words via **SP-2** utilities.
- **Fonts**: register a Cyrillic-capable font (Roboto covers Uzbek Cyrillic ў/қ/ғ/ҳ; bundle as a
  vfs font) so RU/UZ text renders correctly.

### 4.2 API (NestJS, `JwtAuthGuard`)
- `GET /api/cases/:id/documents` → `[{ key, title, lang, available, watermarked }]` for the 15 docs.
- `GET /api/cases/:id/documents/:key/pdf?download=0|1` → streams `application/pdf`.
  `download=1` → `Content-Disposition: attachment; filename="<case>-<key>.pdf"`; else `inline`.
- Guards: authenticated; `case.status != DRAFT` (else 409); all roles allowed.

### 4.3 Frontend (`packages/ui`)
- New **"Hujjatlar"** section in `CaseView`: a list/grid of the 15 documents — title, language badge,
  a "TASDIQLANMAGAN" chip when watermarked, and **[Ko'rish]** + **[Yuklab olish]** actions.
- **View**: modal with `<iframe src={pdfInlineUrl}>` (browser-native PDF view).
- **Download**: anchor to `?download=1`.
- Uses the typed `api-client`; new methods `listCaseDocuments(id)` and `documentPdfUrl(id, key, download)`.

## 5. The 15 documents

`SP-1✓` = renders from SP-1 data as specced. `model-gap` = needs a model deferred from SP-1.

| Key | Document (sheet) | Lang | Primary data | Status |
|---|---|---|---|---|
| `questionnaire` | Анкета (b3) | UZ | Borrower, CreditHistory, Employment | SP-1✓ |
| `scoringReport` | Score отчёт | UZ | ScoringResult, CreditLine, CreditHistory | SP-1✓ |
| `petition` | Ходатайство | UZ | Organization, Borrower, CreditLine | SP-1✓ |
| `committeeProtocol` | Протокол | UZ | Borrower, CreditLine, Tranche, CreditHistory | SP-1✓ |
| `generalAgreement` | РКЛ Ген | UZ | Organization, Borrower, CreditLine | SP-1✓ |
| `contractRu` | договор рус | RU | Org, Borrower, CreditLine, Tranche, Collateral, Insurance | SP-1✓ |
| `contractUz` | договор узб | UZ | (same as contractRu) | SP-1✓ |
| `valuationAct` | Акт согласования | UZ | Org, Borrower, Collateral, ValuationAct | SP-1✓ (act exists today) |
| `dealOrder` | Приказ на сделку | UZ | Organization, Borrower, CreditLine | SP-1✓ |
| `creditApplication` | Кредитная заявка | UZ | Org, Borrower, CreditLine, Tranche | SP-1✓ |
| `coverPage` | обложка | UZ | Organization, Borrower, CreditLine | SP-1✓ |
| `fileChecklist` | перечень | UZ | static packet list + case meta | SP-1✓ |
| `incomeCertificate` | Справка | RU | IncomeCertificate + SalaryMonth | SP-1✓ (pulled into SP-1) |
| `monitoringAct` | Акт мониторинга | UZ | **MonitoringAct** (+180/+360/+540) | model-gap |
| `claimLetter` | Претензион | RU | **ClaimLetter** | model-gap |

**13 of 15 render off SP-1 as specced. 2 (`monitoringAct`, `claimLetter`) need models still deferred.**
See §7.

## 6. Dependencies & build order
- **SP-1** (data model) — documents read its entities. Must be implemented first.
- **SP-2** (number/date → words) — contracts/orders need amount & date in words (RU + UZ).
- SP-6 is implemented after SP-1 + SP-2. The 12 SP-1✓ documents can ship before the 3 model-gap ones.

## 7. The 2 deferred documents (resolved 2026-06-29)
- ✅ `IncomeCertificate` + `SalaryMonth` (Справка) — **pulled into SP-1**, so the income certificate
  ships with the other origination documents.
- ⏳ `MonitoringAct` (Акт мониторинга — +180/+360/+540 days) and `ClaimLetter` (Претензион) — these
  are **post-finalization** servicing/collections documents. Their models + templates land in a
  separate later sub-project (call it **SP-8 — servicing & collections**), not in SP-6's first cut.

So SP-6 ships **13 documents** off SP-1; `monitoringAct` + `claimLetter` follow in SP-8.

## 8. Testing / verification
- Each template renders to a non-empty valid PDF from the **TADJIYEV fixture** (SP-1 §8 fixture).
- Watermark present for `MODERATION`/`DIRECTOR_REVIEW`, absent for `ADMIN_FINALIZE`/`FINALIZED`.
- Endpoint: 409 in DRAFT; 200 + `application/pdf` otherwise; `download=1` sets attachment filename.
- Cyrillic/Uzbek glyphs render (visual check on contractUz + questionnaire).
- Frontend: panel lists 15, view modal opens the PDF, download saves the file.

## 9. Risks
- **Template fidelity is the bulk of the effort** — 15 officially-formatted documents (heavy tables,
  merged-cell layouts) reproduced in pdfmake. Budget accordingly; the 12 SP-1✓ docs first.
- **Fonts**: must bundle a Cyrillic font in pdfmake vfs or Uzbek glyphs break.
- **Words utilities (SP-2)** must support both RU and UZ number/date wording used across contracts.
- Transient generation re-renders on every view; fine at expected volumes, revisit if it becomes hot.
