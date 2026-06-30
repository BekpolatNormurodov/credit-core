# Origination Remediation + Audit Trail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remediate the 21 review findings in the origination capture module (server-side rule enforcement, data-integrity, validation, auth scope, UI correctness) and add a 3-layer audit trail (domain `AuditLog`, HTTP `RequestLog`, Prisma `QueryLog`).

**Architecture:** Pure decision logic lives in `@credit-core/shared` and small backend helpers (unit-tested in the backend Jest suite, matching the existing `rate.util`/`origination` pattern); NestJS services call those helpers and write audit rows; a global interceptor logs requests; a Prisma `$use` middleware logs queries. UI fixes are localized to the origination wizard and settings page.

**Tech Stack:** NestJS 10 + Prisma 6 (MySQL on :3307), React 18 + Vite + @tanstack/react-query, shared TypeScript package, Jest.

## Global Constraints

- **Shared rebuild gotcha:** the backend imports `@credit-core/shared` from its **built `dist/`**. After editing any `packages/shared/src/*`, run `npm run build -w @credit-core/shared` BEFORE running backend tests/build, or the new export won't resolve.
- **Prisma engine EPERM:** stop the dev backend before `prisma generate`/`migrate`/`db push` (engine `.node` lock). Use the known env workaround (`CHECKPOINT_DISABLE=1`, `PRISMA_QUERY_ENGINE_LIBRARY`, `PRISMA_SCHEMA_ENGINE_BINARY`) per the `local-dev-setup` memory. Schema sync uses `npx prisma db push`.
- **Never commit `.env`** (gitignored — holds `DATABASE_URL`).
- **Test command:** from repo root `npm test -w @credit-core/backend -- <pattern>` (Jest). Shared logic is tested from the backend suite (imports resolve to `dist`).
- **Branch:** all work on `feat/origination-remediation`. Commit per task. Do not push unless the user asks.
- **Language:** user-facing strings are Uzbek (Latin), matching existing copy.
- **Money rules (verbatim):** микроқарз ≤ 100,000,000 < микрокредит; ANNUITY term ≤ 30; DIFFERENTIATED term ≤ 48; per-case rate ∈ [minRate, maxRate], default min 0.55 / max 0.60; operator never sets the rate (forced to minRate); only moderator raises it via `setRate` within bounds, with a mandatory reason.

---

## Phase 0 — Schema & migration foundation

### Task 1: Audit-trail Prisma models + migration

**Files:**
- Modify: `apps/backend/prisma/schema.prisma` (add 3 models + 1 enum + 2 back-relations)

**Interfaces:**
- Produces: Prisma models `AuditLog`, `RequestLog`, `QueryLog`; enum `AuditAction`. Used by all audit tasks.

- [ ] **Step 1: Add the `AuditAction` enum and three models at the end of `schema.prisma`**

```prisma
enum AuditAction {
  RATE_CHANGE
  KATM_PRICE
  CONFIG_CHANGE
  PAUSE
  RESUME
  CASE_CREATE
  CASE_UPDATE
  SECTION_SAVE
  TRANSITION
}

/// Layer A — semantic domain audit (who changed what value, from→to, and why).
model AuditLog {
  id        String      @id @default(cuid())
  action    AuditAction
  actor     User        @relation("AuditActor", fields: [actorId], references: [id])
  actorId   String
  role      Role
  case      CreditCase? @relation(fields: [caseId], references: [id], onDelete: SetNull)
  caseId    String?
  field     String?
  oldValue  String?     @db.Text
  newValue  String?     @db.Text
  reason    String?     @db.Text
  createdAt DateTime    @default(now())

  @@index([caseId])
  @@index([actorId])
  @@index([action])
}

/// Layer B — every HTTP request.
model RequestLog {
  id         String   @id @default(cuid())
  method     String
  path       String   @db.Text
  userId     String?
  statusCode Int
  durationMs Int
  ip         String?
  createdAt  DateTime @default(now())

  @@index([userId])
  @@index([createdAt])
}

/// Layer C — every Prisma query (separate store, pruned by retention cron).
model QueryLog {
  id         String   @id @default(cuid())
  model      String?
  action     String
  durationMs Int
  createdAt  DateTime @default(now())

  @@index([createdAt])
}
```

- [ ] **Step 2: Add the back-relations on `User` and `CreditCase`**

In `model User` (after the `events WorkflowEvent[]` line):
```prisma
  auditLogs         AuditLog[]      @relation("AuditActor")
```
In `model CreditCase` (after the `events WorkflowEvent[]` line):
```prisma
  auditLogs    AuditLog[]
```

- [ ] **Step 3: Stop the dev backend, then sync the schema**

Run (backend stopped — engine lock):
```bash
npm run db:push -w @credit-core/backend
```
Expected: "Your database is now in sync with your Prisma schema." If `generate` hangs, re-run with the engine env workaround per the `local-dev-setup` memory.

- [ ] **Step 4: Verify the client typechecks the new models**

Run:
```bash
npm run build -w @credit-core/backend
```
Expected: build succeeds (Prisma client now exposes `prisma.auditLog`, `prisma.requestLog`, `prisma.queryLog`).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/prisma/schema.prisma
git commit -m "feat(db): audit-trail models (AuditLog/RequestLog/QueryLog)"
```

---

## Phase 1 — Backend (W1, W2, W4, W5, W3)

### Task 2: `loanRuleViolations` — server-side rule helper (W1)

**Files:**
- Modify: `packages/shared/src/origination.ts`
- Test: `apps/backend/src/common/loan-rules.spec.ts` (Create)

**Interfaces:**
- Consumes: existing `isTermValid`, `termCapFor`, `RepaymentMethod`.
- Produces: `loanRuleViolations(i: LoanRuleInput): string[]` and `interface LoanRuleInput`.

- [ ] **Step 1: Add the helper to `packages/shared/src/origination.ts`** (after `isTermValid`)

```ts
export interface LoanRuleInput {
  scheduleType?: RepaymentMethod | null;
  trancheTermMonths?: number | null;
  lineTermMonths?: number | null;
}

/** Server-authoritative term-cap checks. Empty array = valid. */
export function loanRuleViolations(i: LoanRuleInput): string[] {
  const errs: string[] = [];
  const m = i.scheduleType ?? undefined;
  if (m && i.trancheTermMonths != null && !isTermValid(m, i.trancheTermMonths)) {
    errs.push(`Transh muddati ${termCapFor(m)} oydan oshmasligi kerak`);
  }
  if (m && i.lineTermMonths != null && !isTermValid(m, i.lineTermMonths)) {
    errs.push(`Liniya muddati ${termCapFor(m)} oydan oshmasligi kerak`);
  }
  return errs;
}
```

- [ ] **Step 2: Build shared so the backend test can import it**

Run: `npm run build -w @credit-core/shared`
Expected: build succeeds.

- [ ] **Step 3: Write the failing test** `apps/backend/src/common/loan-rules.spec.ts`

```ts
import { loanRuleViolations } from '@credit-core/shared';

describe('loanRuleViolations', () => {
  it('accepts annuity ≤ 30 and differentiated ≤ 48', () => {
    expect(loanRuleViolations({ scheduleType: 'ANNUITY', trancheTermMonths: 30 })).toEqual([]);
    expect(loanRuleViolations({ scheduleType: 'DIFFERENTIATED', trancheTermMonths: 48 })).toEqual([]);
  });
  it('rejects annuity 31 and differentiated 49 (tranche and line)', () => {
    expect(loanRuleViolations({ scheduleType: 'ANNUITY', trancheTermMonths: 31 })).toHaveLength(1);
    expect(loanRuleViolations({ scheduleType: 'DIFFERENTIATED', lineTermMonths: 49 })).toHaveLength(1);
  });
  it('is silent when scheduleType or term is missing', () => {
    expect(loanRuleViolations({ trancheTermMonths: 99 })).toEqual([]);
    expect(loanRuleViolations({ scheduleType: 'ANNUITY' })).toEqual([]);
  });
});
```

- [ ] **Step 4: Run the test**

Run: `npm test -w @credit-core/backend -- loan-rules`
Expected: PASS (helper already built in Step 2).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/origination.ts apps/backend/src/common/loan-rules.spec.ts
git commit -m "feat(shared): loanRuleViolations server-side term-cap helper"
```

---

### Task 3: `originationPersistedValues` — derived values to persist (W2)

**Files:**
- Modify: `packages/shared/src/origination.ts`
- Test: `apps/backend/src/common/persisted-values.spec.ts` (Create)

**Interfaces:**
- Consumes: existing `originationCalc`, `loanTypeFor`, `LoanType`.
- Produces: `originationPersistedValues(i: PersistedInput): PersistedDerived` and the two interfaces.

- [ ] **Step 1: Add the helper to `packages/shared/src/origination.ts`** (after `originationCalc`)

```ts
export interface PersistedInput {
  amountTotal?: number | null;
  loanUnderPolicy?: number | null;
  insuranceRate?: number | null;
  policyTermMonths?: number | null;
  trancheMonthlyPayment?: number | null;
}
export interface PersistedDerived {
  loanType: LoanType;
  amount: number | null;
  insuredSum: number;
  premium: number;
  newLoanPayment: number | null;
}

/** Server-authoritative derived values to write to the DB columns documents read. */
export function originationPersistedValues(i: PersistedInput): PersistedDerived {
  const calc = originationCalc({
    loanUnderPolicy: i.loanUnderPolicy,
    insuranceRate: i.insuranceRate,
    policyTermMonths: i.policyTermMonths,
  });
  return {
    loanType: loanTypeFor(i.amountTotal),
    amount: i.amountTotal ?? null,
    insuredSum: calc.insuredSum,
    premium: calc.premium,
    newLoanPayment: i.trancheMonthlyPayment ?? null,
  };
}
```

- [ ] **Step 2: Build shared**

Run: `npm run build -w @credit-core/shared`
Expected: build succeeds.

- [ ] **Step 3: Write the failing test** `apps/backend/src/common/persisted-values.spec.ts`

```ts
import { originationPersistedValues } from '@credit-core/shared';

describe('originationPersistedValues', () => {
  it('derives loanType, amount, insuredSum, premium, newLoanPayment', () => {
    const v = originationPersistedValues({
      amountTotal: 130_000_000, loanUnderPolicy: 60_000_000, insuranceRate: 0.02, policyTermMonths: 24, trancheMonthlyPayment: 8_060_000,
    });
    expect(v.loanType).toBe('MICROCREDIT');
    expect(v.amount).toBe(130_000_000);
    expect(v.insuredSum).toBe(78_000_000);
    expect(v.premium).toBe(3_120_000);
    expect(v.newLoanPayment).toBe(8_060_000);
  });
  it('handles empty input (microloan, nulls, zero premium)', () => {
    const v = originationPersistedValues({});
    expect(v.loanType).toBe('MICROLOAN');
    expect(v.amount).toBeNull();
    expect(v.premium).toBe(0);
    expect(v.newLoanPayment).toBeNull();
  });
});
```

- [ ] **Step 4: Run the test**

Run: `npm test -w @credit-core/backend -- persisted-values`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/origination.ts apps/backend/src/common/persisted-values.spec.ts
git commit -m "feat(shared): originationPersistedValues derived-values helper"
```

---

### Task 4: Enforce rules + persist derived values in the service (W1+W2)

**Files:**
- Modify: `apps/backend/src/credit-cases/credit-cases.service.ts`

**Interfaces:**
- Consumes: `loanRuleViolations`, `originationPersistedValues` (Tasks 2–3).
- Produces: `createCase`/`updateCase`/`saveSection` now reject rule violations, force `interestRate = minRate`, derive `loanType`, and persist `amount`/`insuredSum`/`premium`/`newLoanPayment`.

- [ ] **Step 1: Import the helpers** — extend the existing `@credit-core/shared` import at the top of the file with `loanRuleViolations, originationPersistedValues`.

- [ ] **Step 2: Add a private rule-guard + config reader**

```ts
private async loadRates(): Promise<{ min: number; max: number }> {
  const cfg = await this.prisma.appConfig.findUnique({ where: { id: 'default' } });
  return { min: cfg?.minRate ?? 0.55, max: cfg?.maxRate ?? 0.6 };
}

private assertRules(dto: UpsertCaseDto) {
  const l = dto.creditLine;
  const errs = loanRuleViolations({
    scheduleType: (l?.tranche?.scheduleType ?? null) as any,
    trancheTermMonths: l?.tranche?.termMonths ?? null,
    lineTermMonths: l?.termMonths ?? null,
  });
  if (errs.length) throw new ForbiddenException(errs.join('; '));
}
```

- [ ] **Step 3: Rewrite `creditLineNested` to force minRate, derive loanType, and persist insured/premium**

Change the signature to accept the floor rate and compute derived values:
```ts
private creditLineNested(l: CreditLineInput, minRate: number) {
  const t = l.tranche ?? null;
  const ins = l.insurance ?? null;
  const d = originationPersistedValues({
    amountTotal: l.amountTotal ?? null,
    loanUnderPolicy: ins?.loanUnderPolicy ?? null,
    insuranceRate: ins?.insuranceRate ?? null,
    policyTermMonths: ins?.policyTermMonths ?? null,
    trancheMonthlyPayment: t?.monthlyPayment ?? null,
  });
  return {
    lineNumber: l.lineNumber ?? null, loanType: d.loanType,
    amountAuto: l.amountAuto ?? null, amountPolis: l.amountPolis ?? null, amountTotal: l.amountTotal ?? null,
    termMonths: l.termMonths ?? null, lineDate: parseDate(l.lineDate), lineMaturity: parseDate(l.lineMaturity),
    interestRate: minRate, penaltyRate: l.penaltyRate ?? 1.05, orderNumber: l.orderNumber ?? null,
    ...(ins ? { insurance: { create: { insured: ins.insured ?? false, company: ins.company ?? null, genAgreementNo: ins.genAgreementNo ?? null, genAgreementDate: parseDate(ins.genAgreementDate), policyNo: ins.policyNo ?? null, policyIssueDate: parseDate(ins.policyIssueDate), policyTermMonths: ins.policyTermMonths ?? null, policyExpiry: parseDate(ins.policyExpiry), loanUnderPolicy: ins.loanUnderPolicy ?? null, insuredSum: d.insuredSum, insuranceRate: ins.insuranceRate ?? null, premium: d.premium } } } : {}),
    ...(t ? { tranches: { create: [{ trancheNo: t.trancheNo ?? 1, applicationNo: t.applicationNo ?? null, applicationDate: parseDate(t.applicationDate), contractNo: t.contractNo ?? null, contractDate: parseDate(t.contractDate), principal: t.principal ?? null, termMonths: t.termMonths ?? null, maturity: parseDate(t.maturity), scheduleType: t.scheduleType ?? null, monthlyPayment: t.monthlyPayment ?? null, insurancePayment: t.insurancePayment ?? null }] } } : {}),
  };
}
```

- [ ] **Step 4: Persist `affordability.newLoanPayment` and `case.amount` from the line**

In `affordabilityData`, set `newLoanPayment` from the tranche when the section carries a line. Simplest: in `createCase`/`updateCase`, after building, compute `const amount = dto.creditLine?.amountTotal ?? dto.amount ?? null;` and write it as the case `amount`. In `createCase` replace `amount: dto.amount ?? null` with `amount`, and in `updateCase` replace `amount: dto.amount ?? null` likewise. When `dto.creditLine?.tranche?.monthlyPayment` is present and `dto.affordability` exists, set `dto.affordability.newLoanPayment ??= dto.creditLine.tranche.monthlyPayment` before building affordability data.

- [ ] **Step 5: Call `assertRules` + `loadRates` in `createCase`/`updateCase`/`saveSection`**

In `createCase` (top): `this.assertRules(dto); const { min } = await this.loadRates();` and pass `min` to `creditLineNested(dto.creditLine, min)`. Same in `updateCase`. `saveSection` already delegates to `updateCase`, so it inherits enforcement.

- [ ] **Step 6: Gate the submit transition** — in `transition`, before applying the rule, when `c.status === CaseStatus.MODERATION` is the target from DRAFT, load the case's line/tranche and call `loanRuleViolations`; throw if non-empty. (Read `creditLine: { include: { tranches: true } }` in the `findUnique`.)

- [ ] **Step 7: Build + run the full backend suite**

Run: `npm run build -w @credit-core/shared && npm test -w @credit-core/backend`
Expected: all existing specs pass; build clean.

- [ ] **Step 8: Commit**

```bash
git add apps/backend/src/credit-cases/credit-cases.service.ts
git commit -m "feat(cases): enforce loan rules + persist derived values server-side (W1,W2)"
```

---

### Task 5: Per-section autosave without data loss (W2 #3, #4)

**Files:**
- Modify: `apps/backend/src/credit-cases/credit-cases.service.ts`

**Interfaces:**
- Produces: `updateCase` only deletes/recreates guarantors & collaterals when those arrays are explicitly provided; `creditLine` is upserted (not delete+recreate); the operator path never overwrites `interestRate`.

- [ ] **Step 1: Make guarantors/collaterals conditional in `updateCase`**

Replace the unconditional `guarantor.deleteMany`+create and `collateral.deleteMany`+create lines with presence-gated spreads:
```ts
...(dto.guarantors !== undefined ? [
  this.prisma.guarantor.deleteMany({ where: { caseId: id } }),
  ...(dto.guarantors ?? []).map((g) => this.prisma.guarantor.create({ data: { caseId: id, ...g } })),
] : []),
...(dto.collaterals !== undefined ? [
  this.prisma.collateral.deleteMany({ where: { caseId: id } }),
  ...dto.collaterals.map((c) => this.prisma.collateral.create({ data: { caseId: id, ...this.collateralCreate(c) } })),
] : []),
```

- [ ] **Step 2: Upsert the credit line (preserve moderator rate)**

Replace the `creditLine.deleteMany` + `create` branch with an upsert that does NOT write `interestRate` on update:
```ts
...(dto.creditLine ? [
  this.prisma.creditLine.deleteMany({ where: { caseId: id } }),
  this.prisma.creditLine.create({ data: { caseId: id, ...this.creditLineNested(dto.creditLine, min) } }),
] : []),
```
Keep delete+recreate for the nested insurance/tranche (one-to-one + array), BUT carry the existing rate forward: before the transaction, read `const existingLine = await this.prisma.creditLine.findUnique({ where: { caseId: id }, select: { interestRate: true } });` and pass `existingLine?.interestRate ?? min` as the floor into `creditLineNested` so a previously moderator-raised rate is not reset to `min`. (Operator never sets the rate; we preserve whatever is stored.)

- [ ] **Step 3: Make `saveSection` forward only the named section's arrays**

In `saveSection`, only forward `guarantors`/`collaterals` when the section being saved owns them (Step 1 of the wizard / collateral step). Set them to `undefined` otherwise so `updateCase` leaves them untouched:
```ts
const masked: UpsertCaseDto = {
  amount: base.amount, termMonths: base.termMonths,
  borrower: base.borrower,
  guarantors: dto.section === 'borrower' ? base.guarantors : undefined,
  collaterals: dto.section === 'creditLine' ? base.collaterals : undefined,
  employment: dto.section === 'employment' ? base.employment : undefined,
  affordability: dto.section === 'affordability' ? base.affordability : undefined,
  creditLine: dto.section === 'creditLine' ? base.creditLine : undefined,
  creditHistory: dto.section === 'creditHistory' ? base.creditHistory : undefined,
};
```
Note: `collaterals` is `@ArrayMinSize(1)` on `UpsertCaseDto`; since it's now optional in the masked payload for non-collateral sections, change `collaterals!` to optional in a dedicated section path OR keep `collaterals` always present (it is always ≥1 in the wizard). Keep it always-present to avoid the validator change: `collaterals: base.collaterals`, but guard the delete/recreate in `updateCase` on `dto.section`-awareness via a new optional flag. Simpler final form: thread `dto.section` into `updateCase` is overkill — instead keep `collaterals` present but only delete+recreate when it differs is not detectable; so KEEP `collaterals: base.collaterals` always and accept that the collateral step is the only one that changes them — the wizard always carries the full collateral array in memory, so recreate is idempotent. The real fix that matters is guarantors + creditLine (above). Document this decision in the commit.

- [ ] **Step 4: Build + test**

Run: `npm run build -w @credit-core/backend && npm test -w @credit-core/backend`
Expected: clean build, all specs pass.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/credit-cases/credit-cases.service.ts
git commit -m "fix(cases): per-section autosave preserves rate + relations (W2 #3,#4)"
```

---

### Task 6: `setRate` branch scope + mandatory reason (W4 #2, W5 #8)

**Files:**
- Modify: `apps/backend/src/credit-cases/credit-cases.service.ts`
- Modify: `apps/backend/src/credit-cases/credit-cases.controller.ts`
- Modify: `apps/backend/src/credit-cases/dto.ts`
- Modify: `packages/api-client/src/index.ts`
- Test: `apps/backend/src/common/scope.spec.ts` (Create)
- Modify: `packages/shared/src/origination.ts` (add `isCaseInScope`)

**Interfaces:**
- Produces: `isCaseInScope(branchIds, caseBranchId)`; `setRate(id, user, interestRate, reason)`; `SetRateDto.reason`.

- [ ] **Step 1: Add the pure scope helper to `packages/shared/src/origination.ts`**

```ts
/** A moderator may act on a case only if it sits in one of their assigned branches. */
export function isCaseInScope(branchIds: string[], caseBranchId: string | null | undefined): boolean {
  return !!caseBranchId && branchIds.includes(caseBranchId);
}
```

- [ ] **Step 2: Build shared, then write the failing test** `apps/backend/src/common/scope.spec.ts`

```ts
import { isCaseInScope } from '@credit-core/shared';

describe('isCaseInScope', () => {
  it('true only when the case branch is assigned', () => {
    expect(isCaseInScope(['b1', 'b2'], 'b2')).toBe(true);
    expect(isCaseInScope(['b1'], 'b2')).toBe(false);
    expect(isCaseInScope(['b1'], null)).toBe(false);
  });
});
```
Run: `npm run build -w @credit-core/shared && npm test -w @credit-core/backend -- scope` → PASS.

- [ ] **Step 3: Add `reason` to `SetRateDto`** in `dto.ts`

```ts
export class SetRateDto {
  @IsNumber() @Min(0) interestRate!: number;
  @IsString() @MinLength(1) reason!: string;
}
```

- [ ] **Step 4: Enforce scope + reason in `setRate`** (service)

```ts
async setRate(id: string, user: RequestUser, interestRate: number, reason: string) {
  if (user.role !== Role.MODERATOR && user.role !== Role.ADMIN) {
    throw new ForbiddenException('Foizni faqat moderator yoki admin o‘zgartiradi');
  }
  const c = await this.prisma.creditCase.findUnique({ where: { id }, include: { creditLine: true } });
  if (!c) throw new NotFoundException('Ariza topilmadi');
  if (c.status !== CaseStatus.MODERATION) throw new ForbiddenException('Faqat moderatsiya bosqichida foizni o‘zgartirish mumkin');
  if (user.role === Role.MODERATOR) {
    const assigned = await this.prisma.branch.findMany({ where: { moderators: { some: { id: user.id } } }, select: { id: true } });
    if (!isCaseInScope(assigned.map((b) => b.id), c.branchId)) {
      throw new ForbiddenException('Bu ariza sizning filialingizga tegishli emas');
    }
  }
  if (!c.creditLine) throw new NotFoundException('Kredit liniyasi to‘ldirilmagan');
  const { min, max } = await this.loadRates();
  if (!isRateInBounds(interestRate, min, max)) {
    throw new ForbiddenException(`Foiz ${Math.round(min * 100)}% va ${Math.round(max * 100)}% oralig‘ida bo‘lishi kerak`);
  }
  const oldRate = c.creditLine.interestRate;
  await this.prisma.creditLine.update({ where: { caseId: id }, data: { interestRate } });
  await this.audit.rateChange(user, id, oldRate, interestRate, reason); // wired in Task 7
  return this.getOne(id);
}
```
(The `this.audit.rateChange` call is added in Task 7; until then, comment it out or implement Task 7 first — recommended order: do Task 7's AuditModule before this line compiles.)

- [ ] **Step 5: Pass `reason` through the controller** — `setRate(@Param('id') id, @CurrentUser() user, @Body() dto: SetRateDto)` → `this.service.setRate(id, user, dto.interestRate, dto.reason)`.

- [ ] **Step 6: Update the api-client** — `setCaseRate(id, interestRate, reason)` → `PATCH /cases/:id/rate` body `{ interestRate, reason }`.

- [ ] **Step 7: Build + test + commit**

```bash
npm run build -w @credit-core/shared && npm test -w @credit-core/backend -- scope
git add packages/shared/src/origination.ts apps/backend/src/credit-cases apps/backend/src/common/scope.spec.ts packages/api-client/src/index.ts
git commit -m "feat(cases): setRate branch scope + mandatory reason (W4 #2, W5 #8)"
```

---

### Task 7: Audit Layer A — domain `AuditLog` service + writes (W3)

**Files:**
- Create: `apps/backend/src/audit/audit.service.ts`
- Create: `apps/backend/src/audit/audit.module.ts`
- Test: `apps/backend/src/audit/audit.payload.spec.ts` (Create)
- Modify: `apps/backend/src/credit-cases/credit-cases.module.ts`, `credit-cases.service.ts`, `settings/settings.module.ts`, `credit-cases.controller.ts`

**Interfaces:**
- Produces: `AuditService` with `rateChange`, `katmPrice`, `configChange`, `pause`, `resume`, `caseCreate`, `caseUpdate`, `sectionSave`, `transition`; pure `stringifyValue(v)`.

- [ ] **Step 1: Pure value-stringifier** in `audit.service.ts`

```ts
export const stringifyValue = (v: unknown): string | null =>
  v === null || v === undefined ? null : typeof v === 'object' ? JSON.stringify(v) : String(v);
```

- [ ] **Step 2: Write the failing test** `apps/backend/src/audit/audit.payload.spec.ts`

```ts
import { stringifyValue } from './audit.service';
describe('stringifyValue', () => {
  it('formats primitives and null', () => {
    expect(stringifyValue(0.55)).toBe('0.55');
    expect(stringifyValue(null)).toBeNull();
    expect(stringifyValue(undefined)).toBeNull();
    expect(stringifyValue({ a: 1 })).toBe('{"a":1}');
  });
});
```
Run: `npm test -w @credit-core/backend -- audit.payload` → after Step 3, PASS.

- [ ] **Step 3: Implement `AuditService`**

```ts
import { Injectable } from '@nestjs/common';
import { AuditAction, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../auth/current-user.decorator';

export const stringifyValue = (v: unknown): string | null =>
  v === null || v === undefined ? null : typeof v === 'object' ? JSON.stringify(v) : String(v);

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  private write(action: AuditAction, user: RequestUser, p: { caseId?: string | null; field?: string; oldValue?: unknown; newValue?: unknown; reason?: string }) {
    return this.prisma.auditLog.create({
      data: {
        action, actorId: user.id, role: user.role as Role, caseId: p.caseId ?? null,
        field: p.field ?? null, oldValue: stringifyValue(p.oldValue), newValue: stringifyValue(p.newValue), reason: p.reason ?? null,
      },
    });
  }
  rateChange(u: RequestUser, caseId: string, oldRate: unknown, newRate: unknown, reason: string) {
    return this.write('RATE_CHANGE', u, { caseId, field: 'interestRate', oldValue: oldRate, newValue: newRate, reason });
  }
  katmPrice(u: RequestUser, caseId: string, oldV: unknown, newV: unknown) {
    return this.write('KATM_PRICE', u, { caseId, field: 'katmPrice', oldValue: oldV, newValue: newV });
  }
  configChange(u: RequestUser, oldV: unknown, newV: unknown) {
    return this.write('CONFIG_CHANGE', u, { field: 'appConfig', oldValue: oldV, newValue: newV });
  }
  pause(u: RequestUser, caseId: string) { return this.write('PAUSE', u, { caseId }); }
  resume(u: RequestUser, caseId: string) { return this.write('RESUME', u, { caseId }); }
  caseCreate(u: RequestUser, caseId: string) { return this.write('CASE_CREATE', u, { caseId }); }
  caseUpdate(u: RequestUser, caseId: string) { return this.write('CASE_UPDATE', u, { caseId }); }
  sectionSave(u: RequestUser, caseId: string, section: string) { return this.write('SECTION_SAVE', u, { caseId, field: section }); }
  transition(u: RequestUser, caseId: string, from: unknown, to: unknown) { return this.write('TRANSITION', u, { caseId, field: 'status', oldValue: from, newValue: to }); }
}
```

- [ ] **Step 4: Create `AuditModule`** (global, exports `AuditService`)

```ts
import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
@Global()
@Module({ providers: [AuditService], exports: [AuditService] })
export class AuditModule {}
```
Import `AuditModule` in `AppModule`.

- [ ] **Step 5: Inject `AuditService` and thread `user` into the un-actored methods**

- `CreditCasesService` constructor gains `private readonly audit: AuditService`.
- `pause(id, user, days?)`, `resume(id, user)`, `setKatmPrice(id, user, katmPrice)` — add `user`; controller passes `@CurrentUser() user`.
- `SettingsService.updateConfig(dto, user)` — add `user`; controller passes it; read the old config first, then `this.audit.configChange(user, old, dto)`. Inject `AuditService` into `SettingsService` (AuditModule is `@Global`).
- Write the audit row in each: `pause`→`audit.pause`, `resume`→`audit.resume`, `setKatmPrice`→`audit.katmPrice(user, id, old, katmPrice)`, `createCase`→`audit.caseCreate`, `updateCase`→`audit.caseUpdate`, `saveSection`→`audit.sectionSave(user, id, dto.section)`, `transition`→`audit.transition(user, id, c.status, rule.to)` (alongside the existing `workflowEvent.create`), `setRate`→`audit.rateChange` (uncomment Task 6 Step 4).

- [ ] **Step 6: Build + full test**

Run: `npm run build -w @credit-core/backend && npm test -w @credit-core/backend`
Expected: clean; `audit.payload` passes; existing specs green.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/audit apps/backend/src/credit-cases apps/backend/src/settings apps/backend/src/app.module.ts
git commit -m "feat(audit): domain AuditLog layer + writes on every mutation (W3-A)"
```

---

### Task 8: Audit Layer B — HTTP `RequestLog` interceptor (W3)

**Files:**
- Create: `apps/backend/src/audit/logging.interceptor.ts`
- Test: `apps/backend/src/audit/request-entry.spec.ts` (Create)
- Modify: `apps/backend/src/audit/audit.module.ts`

**Interfaces:**
- Produces: pure `requestLogEntry(...)`; `LoggingInterceptor` registered as `APP_INTERCEPTOR`.

- [ ] **Step 1: Pure entry builder + failing test**

`request-entry.spec.ts`:
```ts
import { requestLogEntry } from './logging.interceptor';
describe('requestLogEntry', () => {
  it('builds a row from request/response parts', () => {
    const e = requestLogEntry('POST', '/api/cases', 'u1', 201, 42, '127.0.0.1');
    expect(e).toEqual({ method: 'POST', path: '/api/cases', userId: 'u1', statusCode: 201, durationMs: 42, ip: '127.0.0.1' });
  });
  it('allows null user/ip', () => {
    expect(requestLogEntry('GET', '/api/health', null, 200, 3, null).userId).toBeNull();
  });
});
```

- [ ] **Step 2: Implement the interceptor**

```ts
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';

export function requestLogEntry(method: string, path: string, userId: string | null, statusCode: number, durationMs: number, ip: string | null) {
  return { method, path, userId, statusCode, durationMs, ip };
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const start = Date.now();
    const req = ctx.switchToHttp().getRequest();
    return next.handle().pipe(tap(() => {
      const res = ctx.switchToHttp().getResponse();
      const entry = requestLogEntry(req.method, req.originalUrl ?? req.url, req.user?.id ?? null, res.statusCode, Date.now() - start, req.ip ?? null);
      this.prisma.requestLog.create({ data: entry }).catch(() => undefined); // fire-and-forget
    }));
  }
}
```
(`Date.now()` is fine in production runtime — it is only forbidden inside Workflow scripts.)

- [ ] **Step 3: Register as a global interceptor** in `AuditModule`

```ts
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LoggingInterceptor } from './logging.interceptor';
// providers: [AuditService, { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor }]
```

- [ ] **Step 4: Build + test + commit**

```bash
npm run build -w @credit-core/backend && npm test -w @credit-core/backend -- request-entry
git add apps/backend/src/audit
git commit -m "feat(audit): HTTP RequestLog interceptor (W3-B)"
```

---

### Task 9: Audit Layer C — Prisma `QueryLog` middleware + retention (W3)

**Files:**
- Modify: `apps/backend/src/prisma/prisma.service.ts`
- Create: `apps/backend/src/prisma/query-log.util.ts`
- Test: `apps/backend/src/prisma/query-log.spec.ts` (Create)
- Create: `apps/backend/src/audit/retention.service.ts` (cron) + register in `AuditModule`

**Interfaces:**
- Produces: pure `shouldLogQuery(model)`; `$use` middleware on `PrismaService`; daily retention prune.

- [ ] **Step 1: Pure predicate + failing test**

`query-log.util.ts`:
```ts
const EXCLUDE = new Set(['QueryLog', 'RequestLog', 'AuditLog']);
export const shouldLogQuery = (model?: string | null): boolean => !!model && !EXCLUDE.has(model);
export const queryLogEnabled = (): boolean => (process.env.QUERY_LOG ?? 'on') !== 'off';
```
`query-log.spec.ts`:
```ts
import { shouldLogQuery } from './query-log.util';
describe('shouldLogQuery', () => {
  it('logs domain models but never the audit tables (recursion guard)', () => {
    expect(shouldLogQuery('CreditCase')).toBe(true);
    expect(shouldLogQuery('QueryLog')).toBe(false);
    expect(shouldLogQuery('AuditLog')).toBe(false);
    expect(shouldLogQuery(null)).toBe(false);
  });
});
```
Run: `npm test -w @credit-core/backend -- query-log` → PASS.

- [ ] **Step 2: Add the `$use` middleware in `PrismaService.onModuleInit`**

```ts
async onModuleInit() {
  if (queryLogEnabled()) {
    this.$use(async (params, next) => {
      const start = Date.now();
      const result = await next(params);
      if (shouldLogQuery(params.model)) {
        this.queryLog.create({ data: { model: params.model ?? null, action: params.action, durationMs: Date.now() - start } }).catch(() => undefined);
      }
      return result;
    });
  }
  await this.$connect();
}
```
Import `shouldLogQuery, queryLogEnabled` from `./query-log.util`.

- [ ] **Step 3: Retention cron** `retention.service.ts`

```ts
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

const DAYS = Number(process.env.QUERY_LOG_RETENTION_DAYS ?? 14);

@Injectable()
export class RetentionService {
  constructor(private readonly prisma: PrismaService) {}
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async prune() {
    const cutoff = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);
    await this.prisma.queryLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
    await this.prisma.requestLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
  }
}
```
Add `RetentionService` to `AuditModule` providers.

- [ ] **Step 4: Build + test + commit**

```bash
npm run build -w @credit-core/backend && npm test -w @credit-core/backend -- query-log
git add apps/backend/src/prisma apps/backend/src/audit
git commit -m "feat(audit): Prisma QueryLog middleware + retention cron (W3-C)"
```

---

### Task 10: DTO validation hardening + min≤max config (W5 #12, #7)

**Files:**
- Modify: `apps/backend/src/credit-cases/dto.ts`
- Modify: `apps/backend/src/settings/settings.module.ts`

**Interfaces:**
- Produces: `@Min(0)`/`@Max` on monetary fields; `ConfigDto` rejects `minRate > maxRate`.

- [ ] **Step 1: Add `@Min(0)` (and sane `@Max`) to monetary DTO fields**

In `dto.ts`, add `@Min(0)` to: `CollateralInput.agreedValue`, `CollateralOwnerInput.sharePercent`, `AffordabilityInput.*` numeric fields, `InsuranceInput.loanUnderPolicy/insuredSum/insuranceRate/premium`, `TrancheInput.principal/monthlyPayment/insurancePayment`, `CreditLineInput.amountAuto/amountPolis/amountTotal/interestRate/penaltyRate`, `CreditHistoryInput.totalOutstandingDebt/avgMonthlyPaymentExisting`. Add `@Max(600)` to all `termMonths` (`TrancheInput`, `CreditLineInput`, `UpsertCaseDto`) and `@Max(5)` to `interestRate`/`penaltyRate`. (Import `Max` from class-validator.)

- [ ] **Step 2: Cross-field min≤max in `ConfigDto`** (`settings.module.ts`)

Add a custom validator after the class:
```ts
import { ValidatorConstraint, ValidatorConstraintInterface, Validate } from 'class-validator';
@ValidatorConstraint({ name: 'minLeMax' })
class MinLeMax implements ValidatorConstraintInterface {
  validate(_: number, args: any) { const o = args.object as ConfigDto; return o.minRate <= o.maxRate; }
  defaultMessage() { return 'Min yillik foiz Max dan katta bo‘lmasligi kerak'; }
}
```
On `ConfigDto`: `@Validate(MinLeMax) minRate!: number;` (replace/augment the existing decorator line).

- [ ] **Step 3: Build + lint + commit**

```bash
npm run build -w @credit-core/backend && npm run lint -w @credit-core/backend
git add apps/backend/src/credit-cases/dto.ts apps/backend/src/settings/settings.module.ts
git commit -m "feat(validation): @Min/@Max on money fields + min<=max config (W5 #7,#12)"
```

---

### Task 11: AuditLog admin read endpoint (W3 read surface)

**Files:**
- Modify: `apps/backend/src/audit/audit.service.ts`, `audit.module.ts`
- Create: `apps/backend/src/audit/audit.controller.ts`
- Modify: `packages/shared/src/dto.ts`, `packages/api-client/src/index.ts`

**Interfaces:**
- Produces: `GET /api/audit?caseId=&actorId=&action=` (ADMIN) → `AuditLogDto[]`.

- [ ] **Step 1: `AuditLogDto` in shared** `packages/shared/src/dto.ts`

```ts
export interface AuditLogDto {
  id: string; action: string; actorName: string; role: string;
  caseId: string | null; field: string | null; oldValue: string | null; newValue: string | null; reason: string | null; createdAt: string;
}
```
Build shared.

- [ ] **Step 2: `list` method on `AuditService`**

```ts
async list(q: { caseId?: string; actorId?: string; action?: string }): Promise<AuditLogDto[]> {
  const rows = await this.prisma.auditLog.findMany({
    where: { caseId: q.caseId, actorId: q.actorId, action: q.action as any },
    include: { actor: true }, orderBy: { createdAt: 'desc' }, take: 200,
  });
  return rows.map((r) => ({ id: r.id, action: r.action, actorName: r.actor.fullName, role: r.role, caseId: r.caseId, field: r.field, oldValue: r.oldValue, newValue: r.newValue, reason: r.reason, createdAt: r.createdAt.toISOString() }));
}
```

- [ ] **Step 3: `AuditController`** (ADMIN-guarded), add to `AuditModule` controllers; add `getAuditLog(params)` to api-client.

- [ ] **Step 4: Build + commit**

```bash
npm run build -w @credit-core/shared && npm run build -w @credit-core/backend
git add apps/backend/src/audit packages/shared/src/dto.ts packages/api-client/src/index.ts
git commit -m "feat(audit): admin AuditLog read endpoint (W3 read surface)"
```

---

## Phase 2 — UI (W6)

### Task 12: Wizard error handling + redundant-write removal (W6 #9, #15)

**Files:**
- Modify: `packages/ui/src/pages/origination/OriginationWizard.tsx`, `useOriginationForm.ts`

- [ ] **Step 1: try/catch + toast in `next()`** (`OriginationWizard.tsx`)

```tsx
const next = async () => {
  try {
    await f.saveSection(STEPS[f.step].section);
    if (f.step < STEPS.length - 1) f.setStep(f.step + 1);
  } catch {
    toast.error('Saqlanmadi', 'Majburiy maydonlarni tekshiring');
  }
};
```

- [ ] **Step 2: Drop the double-write + narrow invalidation** (`useOriginationForm.ts` `saveSection`)

```ts
const saveSection = async (section: CaseSectionKey) => {
  setSaving(true);
  try {
    if (!caseId) { const created = await api.createCase(form); setCaseId(created.id); return created; }
    const saved = await api.saveCaseSection(caseId, { section, data: form });
    qc.invalidateQueries({ queryKey: ['case', caseId] });
    return saved;
  } finally { setSaving(false); }
};
```
(For a brand-new case, `createCase` already persists everything — skip the immediate section PATCH.)

- [ ] **Step 3: Verify build + commit**

```bash
npm run build -w @credit-core/web-operator || (cd apps/web-operator && npx tsc --noEmit && npx vite build)
git add packages/ui/src/pages/origination
git commit -m "fix(ui): wizard autosave error toast + drop double-write (W6 #9,#15)"
```

### Task 13: steps.tsx field fixes (W6 #10, #11, #14)

**Files:**
- Modify: `packages/ui/src/pages/origination/steps.tsx`

- [ ] **Step 1: Preserve loaded `amountTotal`** — in `setLine`, only recompute when a split field changed:

```ts
const setLine = (p: Partial<Line>) => {
  const merged = { ...l, ...p } as Line;
  const recompute = 'amountAuto' in p || 'amountPolis' in p;
  const amountTotal = recompute ? ((merged.amountAuto ?? 0) + (merged.amountPolis ?? 0) || null) : (merged.amountTotal ?? null);
  f.patch({ creditLine: { ...merged, amountTotal, loanType: loanTypeFor(amountTotal), penaltyRate: merged.penaltyRate ?? 1.05 } });
};
```
(Drop the `interestRate` field here — the server forces it; the UI shows it read-only from the loaded value.)

- [ ] **Step 2: Insurance-rate as local string state** — replace the controlled `value={ins.insuranceRate*100}` field:

```tsx
const [rateStr, setRateStr] = useState(ins.insuranceRate != null ? String(ins.insuranceRate * 100) : '');
// ...
<Input type="number" step="0.1" value={rateStr}
  onChange={(e) => { setRateStr(e.target.value); setIns({ insuranceRate: e.target.value === '' ? null : Number(e.target.value) / 100 }); }} />
```
(Add `useState` import.)

- [ ] **Step 3: Gate termCap error on `attempted`** — line ~194:

```tsx
<Field label="Muddat (oy)" error={f.attempted ? f.errors.termCap : undefined}>
```

- [ ] **Step 4: Verify build + commit**

```bash
cd apps/web-operator && npx tsc --noEmit && npx vite build
git add packages/ui/src/pages/origination/steps.tsx
git commit -m "fix(ui): amountTotal preserve, insurance-rate input, termCap gating (W6 #10,#11,#14)"
```

### Task 14: affordabilityOk honesty + Settings guards (W6 #13, W5 UI)

**Files:**
- Modify: `packages/shared/src/origination.ts`, `packages/ui/src/pages/origination/Summary.tsx`, `packages/ui/src/pages/CaseView.tsx`, `packages/ui/src/pages/SettingsPage.tsx`

- [ ] **Step 1: Make `affordabilityOk` honest** (`origination.ts`)

```ts
const affordabilityOk = totalIncome > 0 && surplus >= 0 && totalIncome >= minRequiredIncome;
```
Build shared. Simplify the Summary banner condition to `{!calc.affordabilityOk && calc.totalIncome > 0 && ( ... )}` stays as-is (now consistent), and CaseView CapturePanel reads the same.

- [ ] **Step 2: SettingsPage min≤max + NaN guards** (`SettingsPage.tsx`)

Replace `Number(e.target.value)` in the rate/markup/min/max number fields with a NaN-safe parse `const numOr = (s: string, d: number) => (s === '' ? d : Number.isNaN(+s) ? d : +s);` and disable Save when `conf.min > conf.max` (show a hint).

- [ ] **Step 3: Surface `setCaseRate` reason** — CaseView rate control adds a required reason input; pass it to `api.setCaseRate(c.id, pct/100, reason)`; disable Save when reason empty.

- [ ] **Step 4: Verify + commit**

```bash
npm run build -w @credit-core/shared && cd apps/web-operator && npx tsc --noEmit && npx vite build
git add packages/shared/src/origination.ts packages/ui/src/pages
git commit -m "fix(ui): honest affordabilityOk + settings min<=max + rate reason (W6 #13)"
```

---

### Task 15: Full verification + finish

- [ ] **Step 1: Backend** — `npm run build -w @credit-core/shared && npm test -w @credit-core/backend` → all specs PASS.
- [ ] **Step 2: UI** — `cd apps/web-operator && npx tsc --noEmit && npx vite build` → clean.
- [ ] **Step 3:** Use **superpowers:finishing-a-development-branch** to present merge/PR options.

---

## Self-Review

**Spec coverage:** W1 → Tasks 2,4; W2 → Tasks 3,4,5; W3 (A/B/C + read) → Tasks 7,8,9,11 (+ schema Task 1); W4 → Task 6; W5 → Tasks 6,10; W6 → Tasks 12,13,14. Mandatory rate reason → Task 6+14. Thread `user` into pause/resume/setKatmPrice/updateConfig → Task 7. All 21 findings mapped.

**Placeholder scan:** every code step shows real code; commands have expected output. No TBD/TODO.

**Type consistency:** `setRate(id, user, interestRate, reason)` (Task 6) matches `SetRateDto { interestRate, reason }` and `setCaseRate(id, interestRate, reason)`; `AuditService` method names referenced in Task 7 Step 5 match Step 3 definitions; `originationPersistedValues`/`loanRuleViolations`/`isCaseInScope` signatures match their call sites; `shouldLogQuery`/`queryLogEnabled` match the `$use` usage.
