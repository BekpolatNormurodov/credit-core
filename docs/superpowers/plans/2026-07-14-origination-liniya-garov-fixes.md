# Origination Liniya + Garov Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the origination wizard so the Garov step starts empty and cannot save with an incomplete collateral (the live bug), add the Liniya 140%/130% coverage card with editable overrides, default the line date/maturity, and guard the backend from generating collateral documents for a zero-collateral case.

**Architecture:** Put all pure validation/calc logic in `@credit-core/shared` (Jest-tested via the backend project, which resolves shared from its built `dist`). Keep the React wizard as thin wiring verified by `tsc --noEmit` + the browser preview. Persist two new nullable `CreditLine` override columns end-to-end (Prisma → DTO → mappers). Add backend guards so the valuation-act/Excel endpoints refuse a zero-collateral case.

**Tech Stack:** NestJS 10 + Prisma 6 (MySQL) backend, React 18 + Vite + react-query frontend, `@credit-core/shared` (tsc-built) shared package, pdfmake, Jest (ts-jest) for backend tests.

## Global Constraints

- **Commits are LOCAL only.** Never run `git push` — the user pushes. Commit after each task.
- **Two new `CreditLine` columns are nullable/additive:** `requiredCollateralAmount`, `requiredInsuredAmount` (`Decimal? @db.Decimal(18, 2)`). Migrate with `prisma migrate dev --name credit_line_required_amounts`. Requires a reachable dev DB (the `DATABASE_URL` MySQL).
- **Effective value = `override ?? computed`.** Collateral target = `requiredCollateralAmount ?? amountAuto * 1.4`; insured sum = `requiredInsuredAmount ?? loanUnderPolicy * 1.3`.
- **Required collateral fields (gate):** REAL_ESTATE = `agreedValue>0` + `address` + `cadastreNo`; AUTO = `agreedValue>0` + `model` + `stateNumber` + `techPassportNo`. **`realtyKind` is NOT gated** (it always defaults to `APARTMENT`, so a check could never fail).
- **One source of truth:** `collateralComplete`/`collateralMissing`/`collateralErrors` in shared drive BOTH the wizard submit gate and the tab colour — they must never diverge.
- **Verification commands** (run from repo root `C:\Users\JONIBEK\Desktop\credit-core`):
  - Build shared: `npm run build -w @credit-core/shared`
  - Backend tests: `npm test -w @credit-core/backend` (filter: append `-- <pattern>`)
  - Backend compile: `npm run build -w @credit-core/backend`
  - Frontend typecheck: `npx tsc --noEmit -p apps/web-operator/tsconfig.json`
  - Migration: `npm run db:migrate -w @credit-core/backend -- --name credit_line_required_amounts`

## File Structure

- `packages/shared/src/origination.ts` — **all new pure logic**: `collateralComplete/Missing/Errors`, `CollateralField` type; `requiredInsuredAmount` threaded through `OriginationCalcInput`/`originationCalc`/`PersistedInput`/`originationPersistedValues`. (Already re-exported from `@credit-core/shared`.)
- `packages/shared/src/dto.ts` — two new `CreditLineDto` fields.
- `apps/backend/prisma/schema.prisma` — two new `CreditLine` columns (+ migration).
- `apps/backend/src/credit-cases/dto.ts` — two new `CreditLineInput` fields.
- `apps/backend/src/credit-cases/case.mapper.ts` — read mapper (`toCreditLine`).
- `apps/backend/src/credit-cases/credit-cases.service.ts` — write mapper (`creditLineNested`).
- `apps/backend/src/output/output.controller.ts` — zero-collateral guard on both endpoints.
- `apps/backend/src/output/pdf.service.ts` — collateral total must not fall back to loan amount.
- `packages/ui/src/pages/origination/useOriginationForm.ts` — empty start + strict submit gate.
- `packages/ui/src/pages/CaseForm.tsx` — `CollateralCard` per-field error map.
- `packages/ui/src/pages/origination/steps.tsx` — `StepGarov` empty state/clamp/errors/coverage override; `Step3` coverage card + date defaults; calc override threading.
- `packages/ui/src/pages/origination/Summary.tsx` + `packages/ui/src/pages/CaseView.tsx` — thread `requiredInsuredAmount` into `originationCalc`.
- Tests: `apps/backend/src/credit-cases/collateral-validation.spec.ts`, `apps/backend/src/credit-cases/origination-calc.spec.ts`.

---

### Task 1: Shared collateral validation helpers

**Files:**
- Modify: `packages/shared/src/origination.ts`
- Test: `apps/backend/src/credit-cases/collateral-validation.spec.ts`

**Interfaces:**
- Produces: `type CollateralField = 'agreedValue'|'address'|'cadastreNo'|'model'|'stateNumber'|'techPassportNo'`; `collateralMissing(c: CollateralDto): { field: CollateralField; label: string }[]`; `collateralComplete(c: CollateralDto): boolean`; `collateralErrors(c: CollateralDto): Partial<Record<CollateralField, string>>`.

- [ ] **Step 1: Add the helpers to `origination.ts`.** At the top, extend the imports (the file already has `import { LoanType, RepaymentMethod } from './enums';`) to also pull `ProductType`, and import the DTO type:

```ts
import { LoanType, ProductType, RepaymentMethod } from './enums';
import type { CollateralDto } from './dto';
```

Then append at the end of the file:

```ts
/** The collateral fields the Garov step gates on (per type). realtyKind is intentionally excluded
 *  — it always defaults to APARTMENT, so requiring it could never fail. */
export type CollateralField = 'agreedValue' | 'address' | 'cadastreNo' | 'model' | 'stateNumber' | 'techPassportNo';

/** Missing required fields for one collateral, as {field, Uz label}. Single source of truth for
 *  both the wizard submit gate and the per-collateral tab colour. */
export function collateralMissing(c: CollateralDto): { field: CollateralField; label: string }[] {
  const out: { field: CollateralField; label: string }[] = [];
  const need = (ok: boolean, field: CollateralField, label: string) => { if (!ok) out.push({ field, label }); };
  need((c.agreedValue ?? 0) > 0, 'agreedValue', 'Kelishilgan qiymat');
  if (c.type === ProductType.AUTO) {
    need(!!c.model?.trim(), 'model', 'Model');
    need(!!c.stateNumber?.trim(), 'stateNumber', 'Davlat raqami');
    need(!!c.techPassportNo?.trim(), 'techPassportNo', 'Tex passport №');
  } else {
    need(!!c.address?.trim(), 'address', 'Manzil');
    need(!!c.cadastreNo?.trim(), 'cadastreNo', 'Kadastr №');
  }
  return out;
}

/** A collateral is complete when it has no missing required fields. */
export const collateralComplete = (c: CollateralDto): boolean => collateralMissing(c).length === 0;

/** Per-field error map for the CollateralCard (field → "<Label> majburiy"). */
export function collateralErrors(c: CollateralDto): Partial<Record<CollateralField, string>> {
  const out: Partial<Record<CollateralField, string>> = {};
  for (const { field, label } of collateralMissing(c)) out[field] = `${label} majburiy`;
  return out;
}
```

- [ ] **Step 2: Write the failing test.** Create `apps/backend/src/credit-cases/collateral-validation.spec.ts`:

```ts
import { collateralComplete, collateralMissing, collateralErrors } from '@credit-core/shared';
import { ProductType } from '@credit-core/shared';
import type { CollateralDto } from '@credit-core/shared';

const auto = (over: Partial<CollateralDto> = {}): CollateralDto => ({
  type: ProductType.AUTO, agreedValue: 50_000_000, agreedValueWords: null, owners: [],
  model: 'SPARK', stateNumber: '10 A 111 AA', techPassportNo: 'AAS1234567', ...over,
});
const realEstate = (over: Partial<CollateralDto> = {}): CollateralDto => ({
  type: ProductType.REAL_ESTATE, agreedValue: 200_000_000, agreedValueWords: null, owners: [],
  realtyKind: 'APARTMENT', address: 'Toshkent', cadastreNo: '10:01:05:03:01:1234', ...over,
});

describe('collateral validation', () => {
  it('a fully-filled auto collateral is complete', () => {
    expect(collateralComplete(auto())).toBe(true);
    expect(collateralMissing(auto())).toEqual([]);
  });
  it('auto without stateNumber or techPassport is incomplete', () => {
    const c = auto({ stateNumber: null, techPassportNo: '' });
    expect(collateralComplete(c)).toBe(false);
    expect(collateralMissing(c).map((m) => m.field)).toEqual(['stateNumber', 'techPassportNo']);
  });
  it('a fully-filled real-estate collateral is complete', () => {
    expect(collateralComplete(realEstate())).toBe(true);
  });
  it('real-estate without cadastreNo is incomplete but does NOT require realtyKind', () => {
    const c = realEstate({ cadastreNo: null, realtyKind: null });
    expect(collateralMissing(c).map((m) => m.field)).toEqual(['cadastreNo']);
  });
  it('agreedValue of 0 is missing', () => {
    expect(collateralMissing(auto({ agreedValue: 0 }))[0].field).toBe('agreedValue');
  });
  it('collateralErrors maps fields to "<Label> majburiy"', () => {
    expect(collateralErrors(auto({ model: null }))).toEqual({ model: 'Model majburiy' });
  });
});
```

- [ ] **Step 3: Build shared, then run the test.**

Run: `npm run build -w @credit-core/shared && npm test -w @credit-core/backend -- collateral-validation`
Expected: PASS (6 tests). (The build step is required — the backend Jest resolves `@credit-core/shared` from its built `dist`.)

- [ ] **Step 4: Commit.**

```bash
git add packages/shared/src/origination.ts apps/backend/src/credit-cases/collateral-validation.spec.ts
git commit -m "feat(shared): collateralComplete/Missing/Errors helpers (single source for garov validation)"
```

---

### Task 2: Shared CreditLine override fields + insured-sum override in the calc

**Files:**
- Modify: `packages/shared/src/dto.ts` (CreditLineDto), `packages/shared/src/origination.ts` (calc)
- Test: `apps/backend/src/credit-cases/origination-calc.spec.ts`

**Interfaces:**
- Produces: `CreditLineDto.requiredCollateralAmount: number | null`, `CreditLineDto.requiredInsuredAmount: number | null`; `OriginationCalcInput.requiredInsuredAmount?`, `PersistedInput.requiredInsuredAmount?`. `originationCalc` returns `insuredSum = requiredInsuredAmount ?? loanUnderPolicy*1.3`, and `premium = insuredSum * bracketRate`.

- [ ] **Step 1: Add the two `CreditLineDto` fields.** In `packages/shared/src/dto.ts`, after the `amountTotal` line (currently `dto.ts:180`):

```ts
  amountTotal: number | null;
  requiredCollateralAmount: number | null; // override for amountAuto × 140% (null → computed)
  requiredInsuredAmount: number | null;    // override for amountPolis × 130% insured sum (null → computed)
```

- [ ] **Step 2: Thread the insured-sum override through the calc.** In `packages/shared/src/origination.ts`:

In `OriginationCalcInput` (after `collateralTotal?: number | null;`):

```ts
  collateralTotal?: number | null;
  requiredInsuredAmount?: number | null; // manual override of the ×1.3 insured sum
```

In `originationCalc`, replace the `insuredSum`/`premium` lines:

```ts
  const insuredSum = i.requiredInsuredAmount ?? roundUpTo(n(i.loanUnderPolicy) * 1.3, 1); // override ?? ×1.3
  // Flat premium by term bracket (≤2 yil → 2%, 2–4 yil → 4%) of the effective insured sum.
  const premium = roundUpTo(insuredSum * insurancePremiumRate(i.policyTermMonths), 1);
```

In `PersistedInput` (after `policyTermMonths?: number | null;`):

```ts
  policyTermMonths?: number | null;
  requiredInsuredAmount?: number | null;
```

In `originationPersistedValues`, forward it into the `originationCalc({...})` call:

```ts
  const calc = originationCalc({
    loanUnderPolicy: i.loanUnderPolicy,
    insuranceRate: i.insuranceRate,
    policyTermMonths: i.policyTermMonths,
    requiredInsuredAmount: i.requiredInsuredAmount,
  });
```

- [ ] **Step 3: Write the failing test.** Create `apps/backend/src/credit-cases/origination-calc.spec.ts`:

```ts
import { originationCalc, originationPersistedValues } from '@credit-core/shared';

describe('originationCalc insured-sum override', () => {
  it('uses ×1.3 when no override', () => {
    const c = originationCalc({ loanUnderPolicy: 100_000_000, policyTermMonths: 12 });
    expect(c.insuredSum).toBe(130_000_000);
    expect(c.premium).toBe(2_600_000); // 130M × 2% (≤24 oy)
  });
  it('honours requiredInsuredAmount override for insuredSum AND premium', () => {
    const c = originationCalc({ loanUnderPolicy: 100_000_000, policyTermMonths: 12, requiredInsuredAmount: 200_000_000 });
    expect(c.insuredSum).toBe(200_000_000);
    expect(c.premium).toBe(4_000_000); // 200M × 2%
  });
  it('originationPersistedValues forwards the override', () => {
    const d = originationPersistedValues({ amountTotal: 100_000_000, loanUnderPolicy: 100_000_000, policyTermMonths: 12, requiredInsuredAmount: 50_000_000 });
    expect(d.insuredSum).toBe(50_000_000);
    expect(d.premium).toBe(1_000_000); // 50M × 2%
  });
});
```

- [ ] **Step 4: Build shared, then run the test.**

Run: `npm run build -w @credit-core/shared && npm test -w @credit-core/backend -- origination-calc`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit.**

```bash
git add packages/shared/src/dto.ts packages/shared/src/origination.ts apps/backend/src/credit-cases/origination-calc.spec.ts
git commit -m "feat(shared): CreditLine required-amount overrides + insured-sum override in originationCalc"
```

---

### Task 3: Backend — persist the two override columns end-to-end

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`, `apps/backend/src/credit-cases/dto.ts`, `apps/backend/src/credit-cases/case.mapper.ts`, `apps/backend/src/credit-cases/credit-cases.service.ts`

**Interfaces:**
- Consumes: `CreditLineDto.requiredCollateralAmount/requiredInsuredAmount` (Task 2), `PersistedInput.requiredInsuredAmount` (Task 2).
- Produces: both columns round-trip create → read → update.

- [ ] **Step 1: Add the Prisma columns.** In `apps/backend/prisma/schema.prisma`, in `model CreditLine`, after the `amountTotal` line (currently `:436`):

```prisma
  amountTotal  Decimal?         @db.Decimal(18, 2)
  requiredCollateralAmount Decimal? @db.Decimal(18, 2) // mol-mulk (amountAuto) × 140% override; null = computed
  requiredInsuredAmount    Decimal? @db.Decimal(18, 2) // polis (amountPolis) × 130% insured-sum override
```

- [ ] **Step 2: Run the migration (creates the SQL + applies + regenerates the client).**

Run: `npm run db:migrate -w @credit-core/backend -- --name credit_line_required_amounts`
Expected: a new folder `apps/backend/prisma/migrations/<ts>_credit_line_required_amounts/migration.sql` with two `ALTER TABLE CreditLine ADD COLUMN ...` statements, and "Your database is now in sync". (Both columns nullable → no backfill.)

- [ ] **Step 3: Accept the columns on the input DTO.** In `apps/backend/src/credit-cases/dto.ts`, in `class CreditLineInput`, after the `amountTotal` line (`:174`):

```ts
  @IsOptional() @IsNumber() @Min(0) amountTotal?: number | null;
  @IsOptional() @IsNumber() @Min(0) requiredCollateralAmount?: number | null;
  @IsOptional() @IsNumber() @Min(0) requiredInsuredAmount?: number | null;
```

- [ ] **Step 4: Read mapper.** In `apps/backend/src/credit-cases/case.mapper.ts`, in `toCreditLine`, extend the returned object (the line after `interestRate: ..., penaltyRate: ..., orderNumber: l.orderNumber,` at `:79`):

```ts
    interestRate: num(l.interestRate), penaltyRate: num(l.penaltyRate), orderNumber: l.orderNumber,
    requiredCollateralAmount: num(l.requiredCollateralAmount), requiredInsuredAmount: num(l.requiredInsuredAmount),
```

- [ ] **Step 5: Write mapper.** In `apps/backend/src/credit-cases/credit-cases.service.ts`, in `creditLineNested`: (a) forward the override into `originationPersistedValues` (the object passed at `:100-106`) and (b) persist both columns.

In the `originationPersistedValues({...})` argument, add:

```ts
      trancheMonthlyPayment: t?.monthlyPayment ?? null,
      requiredInsuredAmount: l.requiredInsuredAmount ?? null,
    });
```

In the returned object, after the `orderNumber: l.orderNumber ?? null,` line (`:111`):

```ts
      interestRate: rate, penaltyRate: l.penaltyRate ?? 1.05, orderNumber: l.orderNumber ?? null,
      requiredCollateralAmount: l.requiredCollateralAmount ?? null, requiredInsuredAmount: l.requiredInsuredAmount ?? null,
```

- [ ] **Step 6: Compile-verify the whole backend (no DB test harness exists for round-trip).**

Run: `npm run build -w @credit-core/shared && npm run db:generate -w @credit-core/backend && npm run build -w @credit-core/backend`
Expected: builds clean (Prisma client now types the two columns; the mappers compile against them).

> Note: the repo has no DB-integration test harness, so the create→read→update round-trip is verified at runtime in Task 8's preview check (enter an override, save, reload the draft, confirm it persists).

- [ ] **Step 7: Commit.**

```bash
git add apps/backend/prisma/schema.prisma apps/backend/prisma/migrations apps/backend/src/credit-cases/dto.ts apps/backend/src/credit-cases/case.mapper.ts apps/backend/src/credit-cases/credit-cases.service.ts
git commit -m "feat(backend): persist CreditLine required-amount overrides (schema + migration + mappers)"
```

---

### Task 4: Backend — refuse collateral documents for a zero-collateral case

**Files:**
- Modify: `apps/backend/src/output/output.controller.ts`, `apps/backend/src/output/pdf.service.ts`

- [ ] **Step 1: Guard both output endpoints.** In `apps/backend/src/output/output.controller.ts`, add `ConflictException` to the `@nestjs/common` import:

```ts
import { ConflictException, Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
```

In `generateValuationAct`, right after `const c = await this.cases.getOne(id);` (`:32`):

```ts
    const c = await this.cases.getOne(id);
    if (!c.collaterals.length) throw new ConflictException('Garovsiz arizaga hujjat yaratib bo‘lmaydi');
```

In `exportExcel`, right after `const c = await this.cases.getOne(id);` (`:55`):

```ts
    const c = await this.cases.getOne(id);
    if (!c.collaterals.length) throw new ConflictException('Garovsiz arizani eksport qilib bo‘lmaydi');
```

- [ ] **Step 2: Stop the valuation act reporting the loan amount as collateral value.** In `apps/backend/src/output/pdf.service.ts`, change the value line (`:51`):

```ts
    const totalCollateral = c.collaterals.reduce((s, x) => s + (x.agreedValue ?? 0), 0);
    const value = totalCollateral; // collateral total only — never fall back to the loan amount
    const words = value ? sumToWordsUz(value) : '—';
```

- [ ] **Step 3: Compile-verify.**

Run: `npm run build -w @credit-core/backend`
Expected: builds clean.

> Note: these `@Roles(ADMIN)` endpoints have no DB test harness; behaviour is verified manually — hitting `POST /output/:id/pdf/valuation-act` on a zero-collateral draft must return HTTP 409, and a valued case still renders. Confirm during Task 8's preview session (or with an authenticated `curl`).

- [ ] **Step 4: Commit.**

```bash
git add apps/backend/src/output/output.controller.ts apps/backend/src/output/pdf.service.ts
git commit -m "fix(backend): refuse valuation-act/excel for zero-collateral cases; collateral total never falls back to loan amount"
```

---

### Task 5: Frontend — empty Garov start + strict submit gate

**Files:**
- Modify: `packages/ui/src/pages/origination/useOriginationForm.ts`

**Interfaces:**
- Consumes: `collateralComplete`, `collateralMissing` (Task 1).
- Produces: `errors.collateral` is undefined only when `collaterals.length > 0 && every(collateralComplete)`.

- [ ] **Step 1: Import the shared helpers.** In the `@credit-core/shared` import block at the top of `useOriginationForm.ts`, add `collateralComplete, collateralMissing`:

```ts
import {
  ProductType, RepaymentMethod, loanTypeFor, isTermValid, termCapFor, LINE_TERM_CAP,
  collateralComplete, collateralMissing,
  type UpsertCasePayload, type CaseSectionKey, type CollateralDto,
} from '@credit-core/shared';
```

- [ ] **Step 2: Start empty.** Change the `emptyForm` default (`:23`) from `collaterals: [newCollateral(ProductType.REAL_ESTATE)],` to:

```ts
  collaterals: [],
```

- [ ] **Step 3: Do not re-inject a phantom collateral on load.** In the loader (`:85`), change:

```ts
        collaterals: c.collaterals.length ? c.collaterals : [newCollateral(ProductType.REAL_ESTATE)],
```
to:
```ts
        collaterals: c.collaterals,
```

- [ ] **Step 4: Replace the weak gate.** Remove the `hasValuedCollateral` line (`:126`) and add a strict collateral-error derivation just before the `errors` object:

```ts
  const collateralError = (() => {
    const cs = form.collaterals;
    if (cs.length === 0) return 'Kamida 1 ta garov qo‘shing';
    const i = cs.findIndex((c) => !collateralComplete(c));
    return i >= 0
      ? `Garov ${i + 1}: ${collateralMissing(cs[i]).map((m) => m.label).join(', ')} majburiy`
      : undefined;
  })();
```

Then in the `errors` object, replace the `collateral:` line (`:146`):

```ts
    collateral: collateralError,
```

- [ ] **Step 5: Typecheck.**

Run: `npm run build -w @credit-core/shared && npx tsc --noEmit -p apps/web-operator/tsconfig.json`
Expected: no type errors. (`newCollateral` is still used by `applyPrefill`/`addCol`, so no unused-symbol error.)

- [ ] **Step 6: Commit.**

```bash
git add packages/ui/src/pages/origination/useOriginationForm.ts
git commit -m "fix(origination): Garov starts empty; submit gate requires every collateral complete"
```

---

### Task 6: Frontend — CollateralCard per-field errors

**Files:**
- Modify: `packages/ui/src/pages/CaseForm.tsx`

**Interfaces:**
- Consumes: `CollateralField` (Task 1).
- Produces: `CollateralCard` accepts `errors?: Partial<Record<CollateralField, string>>` (replacing `error?: string`).

- [ ] **Step 1: Import the field type.** In the `@credit-core/shared` import in `CaseForm.tsx` (`:6`):

```ts
import { ProductType, DocumentType, type CollateralDto, type CollateralField } from '@credit-core/shared';
```

- [ ] **Step 2: Change the prop.** In the `CollateralCard` signature, replace `error` in both the destructure and the type (`:59-60`):

```ts
export function CollateralCard({ index, c, errors, onChange, onRemove, canRemove, docs, onAddDocs, onRemoveDoc, onSetDocField, hideDocs = false, mediaSlot, texSlot }: {
  index: number; c: CollateralDto; errors?: Partial<Record<CollateralField, string>>; onChange: (p: Partial<CollateralDto>) => void; onRemove: () => void; canRemove: boolean;
```

- [ ] **Step 3: Wire the AUTO fields.** Update the three auto Fields (`:91`, `:95`, `:96`):

```tsx
          <Field label="Model (markasi)" required icon={Car} error={errors?.model}>
            <Select<string> value={c.model ?? ''} onChange={(v) => onChange({ model: v })} searchable placeholder="— mashinani tanlang —"
              options={CAR_MODELS.map((m) => ({ value: m, label: m }))} />
          </Field>
          <Field label="Davlat raqami" required icon={Hashtag} error={errors?.stateNumber}><PlateInput value={c.stateNumber ?? null} onChange={(v) => onChange({ stateNumber: v })} /></Field>
          <Field label="Tex passport (AAS №)" required icon={IdCard} error={errors?.techPassportNo}><Input value={c.techPassportNo ?? ''} onChange={(e) => onChange({ techPassportNo: e.target.value })} /></Field>
```

- [ ] **Step 4: Wire the real-estate fields.** Update the address (`:125`) and cadastre (`:127`) Fields:

```tsx
            <Field label="Manzil" required className="sm:col-span-2" icon={Location} error={errors?.address}><Input value={c.address ?? ''} onChange={(e) => onChange({ address: e.target.value })} /></Field>
```
```tsx
            <Field label="Kadastr №" required icon={Hashtag} hint="10:01:05:03:01:1234" error={errors?.cadastreNo}><KadastrInput value={c.cadastreNo ?? null} onChange={(v) => onChange({ cadastreNo: v })} /></Field>
```

- [ ] **Step 5: Wire the agreed-value field.** Update the value Field (`:148`):

```tsx
        <Field label="Kelishilgan garov qiymati" required icon={Money} error={errors?.agreedValue}><MoneyInput value={c.agreedValue ?? null} onChange={(v) => onChange({ agreedValue: v })} /></Field>
```

- [ ] **Step 6: Typecheck (expect one error in `steps.tsx` — its caller doesn't pass `errors` yet; Task 7 fixes it).**

Run: `npx tsc --noEmit -p apps/web-operator/tsconfig.json`
Expected: compiles for `CaseForm.tsx`; any error is limited to the `<CollateralCard>` usage in `steps.tsx` (no `error`/`errors` prop mismatch) — that call site is updated in Task 7. Proceed to Task 7 before committing if you prefer a green typecheck; otherwise commit now (the prop is optional, so removing the old `error` usage is source-compatible — there is no current `error=` at the call site).

- [ ] **Step 7: Commit.**

```bash
git add packages/ui/src/pages/CaseForm.tsx
git commit -m "feat(origination): CollateralCard per-field required errors (errors map)"
```

---

### Task 7: Frontend — StepGarov empty state, clamp, shared validation, coverage override

**Files:**
- Modify: `packages/ui/src/pages/origination/steps.tsx` (StepGarov + StepSugurta calc)

**Interfaces:**
- Consumes: `collateralComplete`, `collateralErrors` (Task 1); `CollateralCard errors` prop (Task 6); `creditLine.requiredCollateralAmount/requiredInsuredAmount` (Task 2).

- [ ] **Step 1: Import the shared helpers.** In the `@credit-core/shared` import block in `steps.tsx` (`:4-10`), add `collateralComplete, collateralErrors`:

```ts
  INSURANCE_MAX_MONTHS, INSURANCE_GEN_PREFIX, COLLATERAL_COVERAGE_TARGET, LINE_TERM_CAP, insurancePremiumRate,
  collateralComplete, collateralErrors,
  monthlyPaymentFor, termCapFor, isTermValid, paymentDayFor, DocumentType, type RepaymentMethod,
```

- [ ] **Step 2: Clamp `active` and drop the local `isColComplete`.** In `StepGarov` (`:276-279`), replace:

```ts
  const active = Math.min(activeCol, cols.length - 1);
  // A collateral is "complete" (green tab) once its required fields are filled: value + identity.
  const isColComplete = (c: (typeof cols)[number]) =>
    (c.agreedValue ?? 0) > 0 && (c.type === ProductType.AUTO ? !!c.model : !!c.address);
```
with:
```ts
  const active = cols.length ? Math.min(activeCol, cols.length - 1) : 0; // never -1 on empty
```

- [ ] **Step 3: Use the shared predicate for the tab colour.** In the `cols.map` tab loop, change `const done = isColComplete(c);` (`:304`) to:

```ts
            const done = collateralComplete(c);
```

- [ ] **Step 4: Render an empty state, and pass per-field errors to the card.** Replace the block that renders the collateral card (`:329-348`, the `{cols[active] && ( <CollateralCard ... /> )}`) with:

```tsx
        {cols.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/60 p-8 text-center dark:border-gray-700 dark:bg-white/5">
            <p className="font-medium text-gray-700 dark:text-gray-200">Hali garov qo‘shilmagan</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Yuqoridagi tugmalar bilan <b>Uy-joy</b> yoki <b>Avto</b> garov qo‘shing — kamida bittasi to‘liq to‘ldirilishi shart.</p>
            <div className="mt-4 flex justify-center gap-2">
              <Button variant="secondary" onClick={() => addCol(ProductType.REAL_ESTATE)}><Plus className="h-4 w-4" /><House className="h-4 w-4" /> Uy-joy</Button>
              <Button variant="secondary" onClick={() => addCol(ProductType.AUTO)}><Plus className="h-4 w-4" /><Car className="h-4 w-4" /> Avto</Button>
            </div>
          </div>
        ) : cols[active] && (
          <CollateralCard
            key={active}
            index={active}
            c={cols[active]}
            errors={f.attempted ? collateralErrors(cols[active]) : undefined}
            onChange={(p) => f.setCol(active, p)}
            onRemove={() => { f.removeCol(active); setActiveCol(Math.max(0, active - 1)); }}
            canRemove={cols.length > 1}
            mediaSlot={<>
              <CollateralAttachments f={f} colIndex={active} type={DocumentType.COLLATERAL_PHOTO} accept="image/*,video/*" title="Rasm / video" max={10} />
              <CollateralAttachments f={f} colIndex={active} type={DocumentType.GEN_DOVERNOST} accept="image/*,application/pdf" title="Ishonchnoma" max={5} />
            </>}
            texSlot={<TexScan
              storeKey={`tex:${f.caseId ?? 'new'}:${active}`}
              onExtract={(p) => f.setCol(active, p)}
              onScanImages={async (files) => { const id = await saveCollateralMedia(f, active, files); if (id) qc.invalidateQueries({ queryKey: ['col-att', id, active, DocumentType.COLLATERAL_PHOTO] }); }}
            />}
            docs={[]} onAddDocs={() => undefined} onRemoveDoc={() => undefined} onSetDocField={() => undefined}
          />
        )}
```

- [ ] **Step 5: Apply the collateral-coverage override.** In `StepGarov`, replace the coverage line (`:355-357`, the `amountAuto`-based coverage `<p>`):

```tsx
          {amountAuto != null && amountAuto > 0 && (() => {
            const requiredCollateral = l.requiredCollateralAmount ?? amountAuto * COLLATERAL_COVERAGE_TARGET;
            const ok = collateralTotal >= requiredCollateral;
            return <p>Garov qoplami (mol-mulk qismi): <b className={`nums ${ok ? 'text-gray-800 dark:text-white' : 'text-error-600 dark:text-error-500'}`}>{((collateralTotal / amountAuto) * 100).toFixed(0)}%</b> (kerak: {formatMoney(requiredCollateral)})</p>;
          })()}
```

- [ ] **Step 6: Thread the insured-sum override into the two `originationCalc` calls.** In `StepSugurta` (`:234`) and `StepGarov` (`:287`), add `requiredInsuredAmount: l.requiredInsuredAmount` to each `originationCalc({ ... })`:

```ts
  const calc = originationCalc({ loanUnderPolicy: ins.loanUnderPolicy, policyTermMonths: policyMonths, requiredInsuredAmount: l.requiredInsuredAmount });
```

(In `StepSugurta` the credit line is `l`; the call is on the line building `calc`. Apply the same added property in both functions.)

- [ ] **Step 7: Typecheck.**

Run: `npm run build -w @credit-core/shared && npx tsc --noEmit -p apps/web-operator/tsconfig.json`
Expected: no type errors (the `<CollateralCard errors=...>` now matches Task 6's prop).

- [ ] **Step 8: Preview-verify the Garov behaviour.** Start the operator dev server and open a new ariza. Confirm: (a) the Garov step shows the empty state with no tabs; (b) "Saqlash va davom" on the empty step shows the "Kamida 1 ta garov qo‘shing" error and does not advance; (c) adding an Avto with only a model keeps the tab red and blocks save with "Garov 1: Davlat raqami, Tex passport № majburiy"; (d) filling value+model+plate+tex turns the tab green and lets the step save.

- [ ] **Step 9: Commit.**

```bash
git add packages/ui/src/pages/origination/steps.tsx
git commit -m "fix(origination): Garov empty state + clamp + shared validation + per-field errors + coverage override"
```

---

### Task 8: Frontend — Liniya coverage card + date/maturity defaults

**Files:**
- Modify: `packages/ui/src/pages/origination/steps.tsx` (Step3)

**Interfaces:**
- Consumes: `creditLine.requiredCollateralAmount/requiredInsuredAmount`, `COLLATERAL_COVERAGE_TARGET`.

- [ ] **Step 1: Import `useEffect` (Step3 will default the dates).** `steps.tsx` already imports `{ useEffect, useState }` at the top (used by Step4) — confirm; no change needed if present.

- [ ] **Step 2: Default `lineDate` (today) and derive `lineMaturity`.** In `Step3`, right after `const amountTotal = l.amountTotal ?? null;` (`:182`), add:

```ts
  // Liniya sanasi defaults to today (optional, editable); maturity auto-derives = lineDate + termMonths.
  useEffect(() => {
    const patch: Partial<Line> = {};
    if (!l.lineDate) patch.lineDate = new Date().toISOString().slice(0, 10);
    if (!l.lineMaturity && (l.lineDate || patch.lineDate) && l.termMonths) {
      const base = new Date(l.lineDate ?? patch.lineDate!);
      base.setMonth(base.getMonth() + l.termMonths);
      patch.lineMaturity = base.toISOString().slice(0, 10);
    }
    if (Object.keys(patch).length) setLine(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [l.lineDate, l.termMonths]);
```

- [ ] **Step 3: Add the "Kerakli qoplama" card.** In `Step3`, inside the outer `<div className="space-y-6">`, after the closing `</Card>` of the main РКЛ card (before the final `</div>`), add a second card:

```tsx
      <Card className="space-y-4">
        <div>
          <h2 className="font-semibold text-gray-800 dark:text-white">Kerakli qoplama</h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Bu maydonlar ixtiyoriy — hisoblangan qiymat avtomatik ishlatiladi, keyinroq ham tahrirlashingiz mumkin.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Garov qoplami — mol-mulk ×140%" hint={l.amountAuto ? `hisoblangan: ${formatMoney(l.amountAuto * COLLATERAL_COVERAGE_TARGET)}` : 'summa kiriting'}>
            <MoneyInput value={l.requiredCollateralAmount ?? null} onChange={(v) => setLine({ requiredCollateralAmount: v })} placeholder={l.amountAuto ? formatMoney(l.amountAuto * COLLATERAL_COVERAGE_TARGET) : '—'} />
          </Field>
          <Field label="Sug‘urta summasi — polis ×130%" hint={l.amountPolis ? `hisoblangan: ${formatMoney(l.amountPolis * 1.3)}` : 'polis summasini kiriting'}>
            <MoneyInput value={l.requiredInsuredAmount ?? null} onChange={(v) => setLine({ requiredInsuredAmount: v })} placeholder={l.amountPolis ? formatMoney(l.amountPolis * 1.3) : '—'} />
          </Field>
        </div>
      </Card>
```

> Note: `setLine` in `Step3` merges into `creditLine`; `requiredCollateralAmount`/`requiredInsuredAmount` are not split fields, so they do NOT trigger the `amountTotal` recompute branch (which keys off `amountAuto`/`amountPolis`). No change to `setLine` needed.

- [ ] **Step 4: Typecheck.**

Run: `npx tsc --noEmit -p apps/web-operator/tsconfig.json`
Expected: no type errors.

- [ ] **Step 5: Preview-verify.** On the Liniya step: (a) entering an avto/ko‘chmas summa shows the computed 140% as the placeholder/hint; entering an override replaces it; (b) the Liniya sanasi field is pre-filled with today and is editable; (c) after entering term + date, reopening the draft shows a persisted maturity is used by the Bosh kelishuv doc. Then save the draft and reload it (react-query refetch) — confirm the two override amounts persist (validates Task 3's round-trip).

- [ ] **Step 6: Commit.**

```bash
git add packages/ui/src/pages/origination/steps.tsx
git commit -m "feat(origination): Liniya kerakli-qoplama card (140%/130% + override) + lineDate/lineMaturity defaults"
```

---

### Task 9: Frontend — thread insured-sum override into Summary + CaseView

**Files:**
- Modify: `packages/ui/src/pages/origination/Summary.tsx`, `packages/ui/src/pages/CaseView.tsx`

- [ ] **Step 1: Summary.** In `Summary.tsx`, in the `originationCalc({...})` call (`:11-17`), add the override alongside the insurance inputs:

```ts
    loanUnderPolicy: ins?.loanUnderPolicy, insuranceRate: ins?.insuranceRate, policyTermMonths: ins?.policyTermMonths,
    requiredInsuredAmount: form.creditLine?.requiredInsuredAmount,
    amountTotal, collateralTotal,
```

- [ ] **Step 2: CaseView.** In `CaseView.tsx`, in the `originationCalc({...})` call (`:946-951`), add the override:

```ts
    newLoanPayment: line?.tranche?.monthlyPayment,
    requiredInsuredAmount: line?.requiredInsuredAmount,
    amountTotal: line?.amountTotal ?? c.amount, collateralTotal: c.collaterals.reduce((s, col) => s + (col.agreedValue ?? 0), 0),
```

- [ ] **Step 3: Typecheck (all four web apps import CaseView; operator app covers it).**

Run: `npx tsc --noEmit -p apps/web-operator/tsconfig.json`
Expected: no type errors.

- [ ] **Step 4: Commit.**

```bash
git add packages/ui/src/pages/origination/Summary.tsx packages/ui/src/pages/CaseView.tsx
git commit -m "fix(origination): Summary + CaseView use the insured-sum override consistently"
```

---

## Final verification

- [ ] Backend tests green: `npm run build -w @credit-core/shared && npm test -w @credit-core/backend` (the new `collateral-validation` + `origination-calc` specs pass; existing specs unaffected).
- [ ] Backend compiles: `npm run db:generate -w @credit-core/backend && npm run build -w @credit-core/backend`.
- [ ] Frontend typechecks: `npx tsc --noEmit -p apps/web-operator/tsconfig.json`.
- [ ] Preview walk-through (operator): new ariza → Garov empty state blocks advance → add avto, partial fill stays red + blocked → full fill green + saves → Liniya card shows 140%/130% with editable overrides → lineDate defaulted to today → save + reload persists overrides.
- [ ] `git log --oneline` shows the 9 task commits (local only — the user pushes).

## Spec coverage self-check

- Task 3 (Liniya) 140%/130% card + override → **Tasks 2, 3, 8** (DTO/calc/persist/UI).
- Task 3 (Garov) empty start + strict validation → **Tasks 1, 5, 6, 7**.
- `active=-1` clamp + empty state → **Task 7**.
- Phantom-collateral-on-reload fix → **Task 5, Step 3**.
- Submit-gate/tab divergence → **Tasks 1, 5, 7** (single shared predicate).
- Backend zero-collateral doc guard + loan-amount fallback → **Task 4**.
- CollateralCard per-field errors → **Task 6**.
- `requiredInsuredAmount` calc drift (Summary/CaseView) → **Task 9**.
- lineDate today + lineMaturity derive → **Task 8**.
- `realtyKind` not gated → **Task 1** (excluded by design).
- Migration for the two nullable columns → **Task 3, Step 2**.
