# Origination Capture Workspace — Design Spec

> Sub-project of the CLEVER Mikromoliya workbook program: the **manual data-entry** counterpart to
> SP-3 (Excel import). Lets an operator capture the full 4-tab workbook dataset (Д1/Д2/Д3 + b4) into
> the existing **SP-1 data model** through a guided wizard, with live auto-calculations and the loan
> business rules (type / term caps / rate governance) enforced inline.
> Companion reference: [`docs/analysis/2026-06-29-mko-workbook-analysis.md`](../../analysis/2026-06-29-mko-workbook-analysis.md) §2 (data dictionary), §3 (scoring affordability block).
> Depends on: **SP-1** (data model — already built). Feeds: SP-4 (schedule), SP-5 (scoring), SP-6 (documents).

## 1. Goal

Today the SP-1 models (`Employment`, `Affordability`, `CreditLine`, `Tranche`, `InsurancePolicy`,
`CreditHistory`, plus the rich `Borrower` fields) exist and the document templates **read** them, but
there is **no UI to enter or edit** any of it — the case form captures only basic borrower + collateral
data. This module closes that gap: a **5-step capture wizard** on the case workspace that fills every
field the four key Excel tabs hold, computes the derived/affordability values live, and enforces the
loan business rules. After it ships, an operator can originate a complete case end-to-end in-app.

**No new database models are required.** This is a UI + DTO + backend-upsert extension over SP-1, plus
two new `AppConfig` fields for rate governance.

## 2. Scope

**In scope (Phase 1):**
- A 5-step wizard (Qarz oluvchi → Ish & daromad → Liniya & garov & sug'urta → Transh → KATM) on the
  case workspace, replacing the single-screen new/edit form for the full dataset.
- Capture for: extended `Borrower` (demographics), `Employment`, `Affordability` (actual income/expense
  → DTI/surplus), `CreditLine` (РКЛ), `InsurancePolicy`, `Tranche`, `CreditHistory` (replaces the
  admin-only `KatmInputs` placeholder). Collateral + `ValuationAct` **reuse** the existing
  `CollateralCard`.
- **Live "Xulosa" summary panel**: real-time auto-calculations (affordability, insurance premium,
  collateral coverage, loan type, maturity dates) + an affordability flag.
- **Loan business rules** enforced inline (see §4).
- DTO (`UpsertCasePayload`), backend upsert (`credit-cases.service`), `api-client`, and the case mapper
  extended to round-trip the new entities.

**Out of scope (separate sub-projects):**
- Scoring **computation** (SP-5) and payment-**schedule generation** (SP-4) — this module captures the
  inputs and the chosen schedule type/monthly payment, but does not compute the 20-factor score or the
  amortization rows. The summary panel shows affordability only.
- Document generation, incl. the **4 notary documents** + general-document completion — that is
  **Phase 2** (SP-6 extension), tracked in §9. It needs the list of which 4 notary docs.
- Excel import (SP-3) and Excel export (SP-7).

## 3. Wizard structure → model mapping

The wizard lives on the case workspace. A case is created light (number/branch auto, product inferred),
then filled across 5 steps; **each step saves independently** (PATCH) so progress is never lost, and in
edit mode the user can jump to any step. "Moderatsiyaga yuborish" (submit) uses the existing workflow
transition (DRAFT → MODERATION).

| # | Step | Captures | Model(s) (all exist in SP-1) |
|---|------|----------|------------------------------|
| 1 | **Qarz oluvchi** | existing identity **+** gender, citizenship, placeOfBirth, previousName, inn, passportIssuer/IssueDate/Expiry, regAddress + actualAddress + landmarks + tenure, regMatchesActual, maritalStatus, familySize, childrenCount, education, residenceDuration, ownsHome, depositsBand, phones[] | `Borrower` (fields present) |
| 2 | **Ish & daromad** | employer, employerAddress, **sector (17-list → sectorRiskCode auto)**, position, employedSince, experienceBand · **actual** income lines + expense lines | `Employment`, `Affordability` |
| 3 | **Liniya · garov · sug'urta** | РКЛ: lineNumber, loanType (auto), amountAuto/amountPolis/amountTotal, termMonths, lineDate, lineMaturity (auto), interestRate (default min), penaltyRate, orderNumber · **collateral** (reuse `CollateralCard`) + `ValuationAct` · **insurance**: company, gen-agreement, policy no/dates, insuredSum (×1.3 auto), insuranceRate, premium (auto) | `CreditLine`, `Collateral`, `ValuationAct`, `InsurancePolicy` |
| 4 | **Transh** | trancheNo, application/contract no+date, principal (+words), termMonths, maturity (auto), **scheduleType (annuity/diff)**, monthlyPayment, insurancePayment | `Tranche` |
| 5 | **KATM** | repaidLoansCount, activeLoansCount, overdueSubstandardFlag, otherObligations, loansOver5MFlag, priorMfiPawnshopFlag, totalOutstandingDebt, avgMonthlyPaymentExisting, committeeProtocolRef/Date | `CreditHistory` |

The `sector` → `sectorRiskCode` map (1–17) is the lookup table from b3!M:N (analysis §2.3); stored as a
shared constant and applied on selection.

## 4. Loan business rules (enforced inline)

1. **Loan type (auto).** `loanType = amountTotal ≤ 100,000,000 ? MICROLOAN (микроқарз) : MICROCREDIT
   (микрокредит)`. Derived, read-only, shown as a badge. The 100M threshold also labels per-tranche.
2. **Term caps by schedule type.** `ANNUITY → termMonths ≤ 30`; `DIFFERENTIATED → termMonths ≤ 48`.
   Enforced on the Transh step (and the line term): values above the cap show an inline error and block
   step-save / submit.
3. **Interest-rate governance.**
   - New `AppConfig` fields: **`minRate`** (default `0.55` = 55%) and **`maxRate`** (admin-set in
     Sozlamalar; seed default `0.60`). These are the **client lending rate** bounds and are distinct
     from the existing `markupPercent`/`bankRate` (loan-economics calculator) — do not conflate.
   - Per-case `CreditLine.interestRate` initialises to `minRate` (55%).
   - **Operator** sees the rate read-only at the min in DRAFT.
   - **Moderator** (during MODERATION) may **raise** the per-case rate within `[minRate, maxRate]` — a
     risk premium when a case is borderline — but never below `minRate`. Server validates the bound.
   - **Admin** owns the global `minRate`/`maxRate` (and the per-case `penaltyRate`, default `1.05` =
     105%) in Sozlamalar.
4. **Documents (Phase 2 only).** General documents (existing SP-6 set) **plus 4 notary documents**
   generated additionally — list pending (§9).

## 5. Auto-calculations (live "Xulosa" panel)

Pure, deterministic, recomputed on every change; a shared `originationCalc(input)` helper in
`@credit-core/shared` so the same math runs in the UI panel and in backend validation. Income is the
operator's **actual** declared figure (honest underwriting); the 2.2× rule is shown as a guide, never
back-filled.

| Output | Formula | Source |
|---|---|---|
| `totalIncome` | Σ income lines (main + secondary + family + other) | Afford. |
| `totalExpenses` | utilities + family + existing-credit burden + other + **new-loan payment** | Afford. |
| `dtiRatio` | totalCreditPayments ÷ totalIncome | b3!D46 |
| `surplus` | totalIncome − totalExpenses | балл C30 |
| **minRequiredIncome** (guide) | `ROUNDUP((existingBurden + newPayment) × 2.2, −3)` | Д1!C44 rule |
| **affordability flag** | `surplus < 0` **or** `totalIncome < minRequiredIncome` → red warning | scoring income gate |
| `insuredSum` | `loanUnderPolicy × 1.3` | Д2!B78 |
| `premium` | `(insuredSum × insuranceRate) ÷ 12 × policyTermMonths` | Д2!B81 |
| `collateral coverage` | `Σ agreedValue ÷ amountTotal` (target ≥ 140%) | Д2!B59 rule |
| `loanType` | ≤100M ? микроқарз : микрокредит | §4.1 |
| `lineMaturity` / `trancheMaturity` | start + termMonths (day-snap; +10-day rule retained) | Д2!B14, Д3!B13 |

The flag is advisory in DRAFT (does not block submit) — the formal income/score gates belong to SP-5.

## 6. Architecture & data flow

### 6.1 Shared (`packages/shared`)
- Extend `BorrowerDto` with the demographic fields; add `EmploymentDto`, `AffordabilityDto`,
  `CreditLineDto`, `TrancheDto`, `InsurancePolicyDto`, `CreditHistoryDto`.
- Extend `UpsertCasePayload` with optional `employment`, `affordability`, `creditLine` (with nested
  `insurance`), `tranche`, `creditHistory`.
- Extend `CreditCaseDto` (read side) and `AppConfigDto` (`minRate`, `maxRate`).
- New: `SECTOR_RISK` map + `originationCalc()` helper + `TERM_CAP` constants.

### 6.2 Backend (`apps/backend`)
- `dto.ts`: new class-validator input classes mirroring the shared DTOs, added (optional) to
  `UpsertCaseDto`. Rate-bound validation (`minRate ≤ interestRate ≤ maxRate`) in the service.
- `credit-cases.service.ts`: extend `createCase`/`updateCase` `$transaction` to upsert the new
  one-to-one relations (`employment`, `affordability`, `creditHistory`, `creditLine` → nested
  `insurance` + `tranche`) following the existing **delete-and-recreate / upsert** pattern. Keep the
  DRAFT-only + operator-ownership guards. A new **`PATCH /cases/:id/section`** endpoint persists a single
  wizard step (partial upsert) for per-step autosave.
- `case.mapper.ts`: add the new relations to `caseInclude` and `toCaseDto`.
- Moderator rate change: a small `PATCH /cases/:id/rate` (MODERATOR/ADMIN, MODERATION status, bound-checked).
- `AppConfig` service/seed: add `minRate`/`maxRate`.

### 6.3 Frontend (`packages/ui`)
- New `OriginationWizard` (stepper shell + per-step panels) under `pages/origination/`. Reuses
  `Field`/`Input`/`MoneyInput`/`DatePicker`/`Select`/`PhoneInput` primitives and the existing
  `CollateralCard`. The stepper reuses the visual language of the Settings step rail.
- `useOriginationForm` hook (extends the shape of `useCaseForm`) holding the full payload + per-step
  validity + autosave via the section endpoint.
- The **Xulosa** panel (sticky aside) renders `originationCalc()` output with the affordability flag.
- `KatmInputs` placeholder in `CaseView` is replaced by the real Step 5 (CreditHistory), and the
  captured data is surfaced read-only on `CaseView` for moderator/director/admin.
- `api-client`: extend `createCase`/`updateCase` payload types; add `saveCaseSection`, `setCaseRate`.

### 6.4 Settings (`packages/ui` SettingsPage)
- Add **min foiz / max foiz** inputs (whole-number %) to the existing financial-config card.

## 7. Validation & roles

- **Operator** (DRAFT, own case): fills steps 1–5; required = borrower fullName + ≥1 collateral (as
  today) + amountTotal + termMonths + scheduleType; everything else optional but flagged in the summary.
  Term-cap and type rules enforced. Submit → MODERATION.
- **Moderator** (MODERATION, assigned branch): read-only data + may raise the rate within bounds; RETURN/APPROVE as today.
- **Director / Admin**: read-only capture data; existing decisions.
- All step inputs use the existing inline-error pattern (`Field error=` after a save attempt).
- Server re-validates type/term/rate bounds (never trust the client).

## 8. Testing / verification

- **Unit (`@credit-core/shared`)**: `originationCalc()` against the TADJIYEV fixture — DTI 0.4545,
  premium 3,120,000, insuredSum 78,000,000, minRequiredIncome 18,838,000, loanType MICROCREDIT (130M
  tranche) / line MICROCREDIT (150M); term-cap booleans (annuity 31 → invalid, diff 48 → valid).
- **Backend**: create + update round-trips persist and re-read every new relation; DRAFT-only guard
  holds; rate PATCH rejects out-of-bound values (54% and 61% with default config) and non-moderator roles.
- **Frontend**: `tsc --noEmit` + `vite build` (preview screenshots unreliable on this app — verify via
  build per `ui-verification` memory). Manual: wizard fills + autosaves each step; summary updates live;
  type badge + term-cap error behave; rate field editable only for moderator.

## 9. Phasing

- **Phase 1 (this build):** §2 in-scope — capture wizard + business rules + summary. Ships first; it is
  the foundation every downstream sub-project reads.
- **Phase 2 (follow-on, needs input):** document generation — finish the general SP-6 documents and add
  the **4 notary documents**. Blocked on the list of which 4 (likely pledge/zalog agreement + related
  notary-certified docs). Own spec + plan when the list is provided.

## 10. Risks

- **Volume of fields.** Д1+Д2+Д3+b4 ≈ 90 fields; the wizard + per-step autosave keeps it manageable, and
  collateral reuse avoids re-implementing the richest part.
- **Rate semantics.** Moderator-raises-rate is risk-based pricing, not affordability help — documented in
  §4.3; server-enforced bounds prevent abuse.
- **Calc parity.** `originationCalc()` must match the workbook formulas exactly (§5) — covered by the
  fixture test; it is the single source so UI and backend cannot drift.
- **Scope discipline.** Scoring/schedule computation and document generation are explicitly deferred so
  Phase 1 stays a focused, shippable unit.
