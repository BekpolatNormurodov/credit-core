# Spec A — Origination Wizard Fixes (Liniya coverage card + Garov validation gating)

**Date:** 2026-07-13
**Status:** Approved design → ready for implementation plan
**Scope:** Two origination-wizard changes. This is the first of three specs decomposed from a larger request (A: wizard fixes, B: workflow/permissions, C: document-system overhaul). B and C are separate specs.

## Goal

1. **Task 1 (Liniya):** Add a "Kerakli qoplama" (required coverage) card to the Liniya step that shows the mol-mulk amount × **140%** and the polis amount × **130%**, each auto-computed but with an **optional, editable, persisted override**. Effective value = `override ?? computed`.
2. **Task 3 (Garov):** The collateral step must start **empty**, must **block the step** while there are zero collaterals **or** any incomplete collateral, and must show clear per-field errors. This fixes a live bug: today a collateral with a value but no address/model silently passes the step.

## Architecture / approach

- **Single source of truth for collateral completeness.** Add `collateralComplete(c)` and `collateralMissing(c)` to `packages/shared`. Both the wizard's submit gate (`useOriginationForm`) and the per-collateral tab color (`StepGarov`) read these — they must never diverge again (today they do: the gate uses a weak `.some(hasValue)` while the tab uses a stricter check).
- **Override flows through `override ?? computed` everywhere.** The two new `CreditLine` amounts must feed *every* place the 140%/130% products are displayed or persisted, or the wizard preview, sticky summary, saved-case view, and persisted `InsurancePolicy` will drift apart.
- **Empty collaterals is a valid draft state, but never a valid document.** The array may be `[]` while drafting (autosave persists it), but document generation must refuse a zero-collateral case.

---

## Task 1 — Liniya coverage card (auto-compute + editable override)

### Behavior

New card in the Liniya step (`Step3`), below the existing РКЛ summary card, titled **"Kerakli qoplama"**:

| Manba | Hisoblangan (auto) | Override (ixtiyoriy) |
|---|---|---|
| Mol-mulk summasi (`amountAuto`) | × **140%** (`COLLATERAL_COVERAGE_TARGET`) | editable `MoneyInput` |
| Polis summasi (`amountPolis`) | × **130%** (insured sum) | editable `MoneyInput` |

- Each row shows the auto-computed value. If the operator enters an override, that value is used; if left blank, the computed value is used.
- Helper message: *"Bu maydonlar ixtiyoriy — hisoblangan qiymat avtomatik ishlatiladi, keyinroq ham tahrirlashingiz mumkin."*
- Both overrides are **optional** (never block any step).

### Data model — two new nullable `CreditLine` columns

Both nullable Decimal(18,2), additive, no backfill.

- `requiredCollateralAmount` — override for `amountAuto × 140%`. `null` → use `amountAuto × COLLATERAL_COVERAGE_TARGET`.
- `requiredInsuredAmount` — override for `amountPolis × 130%`. `null` → use the computed insured sum.

Placed beside the amount fields they override, threaded end-to-end:

1. `apps/backend/prisma/schema.prisma` — `CreditLine` model, after `amountTotal`.
2. `packages/shared/src/dto.ts` — `CreditLineDto` (after `amountTotal`, ~line 180).
3. `apps/backend/src/credit-cases/dto.ts` — `CreditLineInput` validation class (`@IsOptional() @IsNumber() @Min(0)`).
4. **Read** mapper `toCreditLine` in `apps/backend/src/credit-cases/case.mapper.ts` — add both to the returned DTO.
5. **Write** mapper `creditLineNested(l, rate)` in `apps/backend/src/credit-cases/credit-cases.service.ts` — the *single* function used by **both** create and update (create at ~line 170, update's `creditLine.create` at ~line 302 after `deleteMany`). Add both fields to the persisted data.
6. **No Prisma `select` change needed** — all reads use `include`, which auto-selects new scalars. (The one narrow `select: { interestRate: true }` in the service is intentional; leave it.)

### Calc changes — the override must reach every consumer

`requiredCollateralAmount` (the 140% product) drives the **Garov coverage threshold**:
- In `StepGarov` (`steps.tsx`), the coverage pass/fail and % currently use `amountAuto × COLLATERAL_COVERAGE_TARGET`. Change the **threshold** to `requiredCollateral = l.requiredCollateralAmount ?? (amountAuto × COLLATERAL_COVERAGE_TARGET)`, and compare `collateralTotal >= requiredCollateral`.
- The "Kerakli qoplama" card in `Step3` displays this same computed/override value.

`requiredInsuredAmount` (the 130% product) drives the **insured sum and premium**. In `packages/shared/src/origination.ts`:
- Add `requiredInsuredAmount?` to `OriginationCalcInput`.
- In `originationCalc`: `const effectiveInsured = i.requiredInsuredAmount ?? insuredSum;` return `insuredSum: effectiveInsured`, and compute `premium = roundUpTo(effectiveInsured × insurancePremiumRate(i.policyTermMonths), 1)`.
- Add `requiredInsuredAmount?` to `PersistedInput` and forward it in `originationPersistedValues` → `originationCalc({...})`.

**Every `originationCalc` / `originationPersistedValues` call site must pass the override** (this is where the critic found drift):
- `packages/ui/src/pages/origination/steps.tsx` — insurance preview (`StepSugurta`, ~line 234) **and** the `StepGarov` calc (~line 287).
- `packages/ui/src/pages/origination/Summary.tsx` (~line 11) — sticky wizard summary. **Was missed by the naive design.**
- `packages/ui/src/pages/CaseView.tsx` (~line 946) — submitted-case detail / CapturePanel. **Was missed.** Prefer reading the persisted `InsurancePolicy.insuredSum` here rather than recomputing, to avoid drift.
- `apps/backend/src/credit-cases/credit-cases.service.ts` (~line 100) — `creditLineNested` calls `originationPersistedValues`; pass `requiredInsuredAmount: l.requiredInsuredAmount ?? null` so the persisted `InsurancePolicy.insuredSum`/`premium` (which documents read) honor the override.

### UI

- `Step3` gains the "Kerakli qoplama" card with two rows (computed value + optional override `MoneyInput`) and the helper message.
- The override setters live on `creditLine` via the existing `setLine` patch pattern.

### Liniya sanasi + muddat (maturity) defaults (added on review)

- `Step3` `lineDate` field: **default to today** on mount when empty — mirror `Step4`'s `applicationDate` pattern (`useEffect` that sets `lineDate` to `new Date().toISOString().slice(0,10)` only if it is currently empty). Stays **optional**, editable, never blocks a step.
- `Step3` `lineMaturity`: **auto-derive = `lineDate` + `termMonths`** whenever both are present (skip if already set). It exists in `CreditLineDto` (`dto.ts:183`) and is read by the Bosh kelishuv / РКЛ Ген document (`rkl-gen.ts:22` → line end-date) but is **never set today**, so that document currently prints "—" for the maturity. No UI field needed — derived like the tranche's payment day; stays optional (null until both inputs exist).
- `orderNumber` (РКЛ order №) is intentionally **left to Spec C** — the Kredit arizasi reads `c.contractNumber ?? line.orderNumber` (`credit-application.ts:24`), so `contractNumber` already fills it; no Spec A change.

---

## Task 3 — Garov step: empty start + strict per-collateral validation

### Shared helpers (single source of truth)

Add to `packages/shared` (e.g. `origination.ts` or a small `collateral.ts`):

```ts
// Required set (confirmed with operator — "kengroq"):
//   REAL_ESTATE: agreedValue > 0 && address && cadastreNo
//   AUTO:        agreedValue > 0 && model && stateNumber && techPassportNo
// NOTE: realtyKind is intentionally NOT gated — newCollateral() hard-defaults it to
//   'APARTMENT' and every read uses `?? 'APARTMENT'`, so it can never be empty; requiring
//   it would be dead validation (no error path). It stays a default, not a gate.
export function collateralMissing(c: CollateralDto): string[]  // returns Uz field labels that are missing
export function collateralComplete(c: CollateralDto): boolean   // collateralMissing(c).length === 0
```

`collateralMissing` returns human labels (e.g. `['Kadastr №']`) so the UI can name the missing field. Both the hook and the tab consume these — no duplicated rules.

### Empty start (two places — both required)

1. `useOriginationForm.ts` `emptyForm.collaterals` — change `[newCollateral(REAL_ESTATE)]` → `[]`.
2. `useOriginationForm.ts` loader (~line 85) — change `collaterals: c.collaterals.length ? c.collaterals : [newCollateral(REAL_ESTATE)]` → `collaterals: c.collaterals`. **Critical and easy to miss:** without this, any autosave+reload re-injects a phantom REAL_ESTATE collateral the operator never added, silently undoing the empty-start on every refetch.

`applyPrefill` (add-to-draft from "Hujjatlar tekshirish") already works with an empty array: `findIndex` returns −1 → the append branch adds exactly one prefilled collateral. No change needed there.

### Empty-state UI + `active` clamp (StepGarov)

With `collaterals: []`, `const active = Math.min(activeCol, cols.length - 1)` = `Math.min(0, -1)` = **−1**. Today it doesn't crash only because the card render is guarded by `{cols[active] && …}` (`cols[-1]` is `undefined`) — the result is a **blank void** between the header and the coverage footer.

Required changes in `StepGarov`:
- Clamp: `const active = cols.length ? Math.min(activeCol, cols.length - 1) : 0;` (never negative).
- **Keep an existence guard** on the card render (`cols.length > 0 &&` or `cols[active] &&`). A naive clamp to `0` without a length check would render `<CollateralCard c={undefined}>` and crash inside the card.
- Render an explicit empty-state block when `cols.length === 0`: e.g. *"Hali garov qo'shilmagan — Uy-joy yoki Avto qo'shing"* with the two add buttons prominent. The add buttons already stay visible, so adding still works.

### Submit gate rewrite (the actual bug fix)

`useOriginationForm.ts`:
- Replace `hasValuedCollateral = form.collaterals.some((c) => (c.agreedValue ?? 0) > 0)` with a strict gate: **`collaterals.length > 0 && collaterals.every(collateralComplete)`**. An empty array **and** any incomplete collateral must both block save.
- `errors.collateral` derives from that. Its message should name the offending collateral/field, derived from `collateralMissing` — e.g. *"Garov 2: Kadastr № majburiy"* — instead of the coarse single string. `STEP_ERRORS[4]` stays `['collateral']`; `stepHasErrors(4)`/`stepComplete(4)`/`valid` all flow from the tightened `errors.collateral`.
- `StepGarov`'s local `isColComplete` is **deleted** and replaced by the shared `collateralComplete` (drives tab green/red + `!`/✓ badge).

### CollateralCard per-field errors

`CaseForm.tsx` `CollateralCard` currently exposes a **single** `error?: string` prop, wired to only one field (`model` for auto, `address` for real-estate). It cannot express per-field errors for the full required sets.

- Change the prop from `error?: string` to a per-field error map, e.g. `errors?: Partial<Record<'agreedValue' | 'address' | 'cadastreNo' | 'model' | 'stateNumber' | 'techPassportNo', string>>`.
- Wire `<Field error={errors?.X}>` on each required field: `agreedValue`, `address`, `cadastreNo` (real-estate); `agreedValue`, `model`, `stateNumber`, `techPassportNo` (auto). Add `required` markers.
- **Update the other caller** of `CollateralCard` (the standalone `CaseForm`) so the prop change compiles.
- `StepGarov` passes `errors={attempted ? collateralErrorsFor(cols[active]) : undefined}` where the per-field map is derived from `collateralMissing` on the active collateral.

### Backend guards — refuse documents for zero-collateral cases

Task 3 makes a zero-collateral case reachable on **every new ariza**. Two `@Roles(ADMIN)` endpoints in `apps/backend/src/output/output.controller.ts` currently have **no status/empty guard**:
- `POST /output/:id/pdf/valuation-act` (~line 26/32) → `pdf.valuationAct(c)`.
- `GET /output/:id/excel` (~line 53/55) → `exportCaseToExcel(c)`.

On a zero-collateral case, `pdf.service.ts:50` computes `value = totalCollateral || c.amount`, so the valuation act reports the **loan amount** as total collateral value and spells it in words — a legally false "Garov baholash akti".

Required:
- Add a guard in `output.controller.ts` (both endpoints): reject with `ConflictException` when `c.collaterals.length === 0` (and/or `status === DRAFT`) before generating.
- In `pdf.service.ts:50`, stop letting `value` fall back to `c.amount` for the collateral total (the collateral total must be the collateral total, or `0`/`—`, never the loan amount).
- Keep the existing submit gate (`credit-cases.service.ts` `if (!c.collaterals.length) throw` on DRAFT→MODERATION). The registry docs route (`case-documents.controller.ts`) already blocks DRAFT — leave it.

(The registry templates — `contract.ts`, `act.ts`, `petition.ts`, `prikaz.ts`, `protokol.ts`, `rkl-gen.ts`, `_shared.ts:collateralDetails` — all render blank/zero collateral sections on an empty array but are already protected by the DRAFT guard + submit gate, so they need no change under this spec. They are re-touched in Spec C.)

---

## Back-compat / migration

- **Migration:** add both nullable columns via `npx prisma migrate dev --name credit_line_required_amounts` (generates the SQL migration + applies locally + regenerates the client). Prod applies schema through the existing migrate service. Both columns nullable → additive, no backfill, safe.
- **In-flight drafts:** existing drafts carry the old default empty REAL_ESTATE collateral. After the loader fix (Task 3, item 2), they load with that single empty collateral, which under the new strict `collateralComplete` now shows as an **incomplete red tab** blocking resubmit until filled or removed. This is acceptable and intended (it surfaces exactly the incompleteness that caused the original bug), but call it out to operators.

---

## Complete file map

**Shared (`packages/shared/src`)**
- `dto.ts` — `CreditLineDto`: add `requiredCollateralAmount`, `requiredInsuredAmount`.
- `origination.ts` — `OriginationCalcInput`/`PersistedInput`: add `requiredInsuredAmount?`; `originationCalc` honors override for `insuredSum`+`premium`; `originationPersistedValues` forwards it. Add `collateralComplete` / `collateralMissing` (+ required-field label sets).

**Backend (`apps/backend/src`)**
- `credit-cases/dto.ts` — `CreditLineInput`: two optional validated fields.
- `credit-cases/case.mapper.ts` — `toCreditLine`: read both new fields.
- `credit-cases/credit-cases.service.ts` — `creditLineNested`: persist both new fields; pass `requiredInsuredAmount` into `originationPersistedValues`.
- `output/output.controller.ts` — guard valuation-act + Excel endpoints against zero-collateral / DRAFT.
- `output/pdf.service.ts` — collateral total must not fall back to loan amount.
- `prisma/schema.prisma` — `CreditLine`: two nullable Decimal columns (+ migration).

**Frontend (`packages/ui/src`)**
- `pages/origination/useOriginationForm.ts` — `emptyForm.collaterals = []`; loader keeps `c.collaterals`; submit gate `length>0 && every(collateralComplete)`; `errors.collateral` names the missing field.
- `pages/origination/steps.tsx` — `Step3` coverage card (140%/130% + override); `StepGarov` empty-state + `active` clamp + existence guard, uses shared `collateralComplete`, passes per-field errors, override threshold for coverage %; `StepSugurta`/`StepGarov` pass `requiredInsuredAmount` to `originationCalc`.
- `pages/origination/Summary.tsx` — pass `requiredInsuredAmount` to `originationCalc`.
- `pages/CaseView.tsx` — pass `requiredInsuredAmount` (or read persisted `InsurancePolicy.insuredSum`).
- `pages/CaseForm.tsx` — `CollateralCard` per-field `errors` map + `required` markers; update the standalone caller.

## Testing

- **New ariza** starts with `collaterals: []` and cannot be submitted (hook gate).
- **Draft saved empty RELOADS empty** — no phantom collateral (the loader fix).
- **One complete + one incomplete collateral is NOT saveable** (`every(collateralComplete)`), and the incomplete tab is red.
- **`applyPrefill` on empty array** appends exactly one prefilled collateral (findIndex −1 → append).
- **Backend rejects** valuation-act/Excel for a zero-collateral case; the valuation act never reports the loan amount as collateral value.
- **`requiredCollateralAmount` override** drives the Garov coverage threshold (`steps.tsx`).
- **`requiredInsuredAmount` override** drives insured sum + premium consistently across wizard preview, `Summary`, `CaseView`, and persisted `InsurancePolicy`.
- **Both new `CreditLine` fields round-trip** create → read → update (`case.mapper`/`creditLineNested`).
- `collateralComplete`/`collateralMissing` unit tests for both product types (required-field matrix).

## Out of scope (later specs)

- Document overhaul (14 docs + notary + scanned uploads + accountant) — **Spec C**. The empty-collateral template rendering is only *guarded* here, not redesigned.
- Upload-by-all-roles and the director=final / admin-invisible workflow — **Spec B**.

### Reference-form findings deferred to Spec C (2026-07-13 doc analysis)

The three Downloads reference forms were analyzed. Two (`ариза.pdf`, `Ариза_МИКРОКАРЗ`) are the **microloan disbursement application** ("пул ўтказиш аризаси" — the borrower asks the director to transfer the contracted amount to a bank account); one (`Чек лист`) is the deal checklist. The wizard captures identity/economics correctly, but the disbursement payload — **where the money goes** — is entirely uncaptured. These belong to Spec C's accountant/disbursement flow:

- **Destination account block:** Х/Р (20-digit account №), МФО (bank BIC), account-holder ИНН, 16-digit card №, holder name → a structured `DisbursementDto`, surfaced in a new "Ariza reqvizitlari" step or appended to Step4.
- **Loan amount in words** (e.g. "(бир юз ўттиз миллион сум)") — only collateral value has a `*Words` field today (the wrong quantity); add `principalWords` or generate at render.
- **СКАН №** (passport-scan reference in the org system) on the borrower.
- **Latent bug:** reusing `BorrowerDto.inn` for the account-block ИНН is wrong when the disbursement account belongs to a third party — the account-holder ИНН must be its own field, defaulted from the borrower only when the holder IS the borrower.
- **Checklist** acknowledgment initials are signing artifacts, not origination capture.
