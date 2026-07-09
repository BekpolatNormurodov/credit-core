# Feature A — Auto Contract Number + Qayta MFL lash — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-generate a company-wide contract number (`{GLOBAL} MFL {YEARLY} {BRANCH}`, e.g. `2012 MFL 1320 PS`) when an application is submitted to the moderator, and add a "Qayta MFL" (repeat-client) flow that reuses a client's yearly+branch identifier.

**Architecture:** Two atomic company-wide counters live in a new `ContractCounter` table (a `"global"` row + one row per year). The number is assigned inside the existing `DRAFT → MODERATION` transaction in `CreditCasesService.transition`. Repeat clients are found via a search endpoint and create a new draft linked to a chosen source contract; at submit the yearly+branch are copied from the source instead of consuming a new yearly number.

**Tech Stack:** NestJS + Prisma (MySQL), React + react-router, shared TS package, Jest.

## Global Constraints

- Contract number format: `` `${global} MFL ${yearly} ${branch}` `` — exact, single spaces, e.g. `2012 MFL 1320 PS`.
- Counters are company-wide (single sequence), NOT per-branch. Branch symbol is only a tag.
- Number is assigned ONLY at `DRAFT → MODERATION` (submit). Never in DRAFT. Never re-assigned once set.
- `GLOBAL` never resets. `YEARLY` resets each calendar year (a new `ContractCounter` row per year, starting at 1).
- Qayta MFL: consume a new GLOBAL, but reuse the source contract's `contractYearlyNo` + `contractBranchSym` (yearly NOT incremented).
- Existing `CreditCase.number` (`BR-2026-0001` = ariza id) is untouched — the contract number is separate.
- Prisma schema changes are applied by `prisma db push` on backend container start (no migration files). Regenerate client with `npm run db:generate -w @credit-core/backend`.
- Run backend unit tests with: `cd apps/backend && node ../../node_modules/jest/bin/jest.js --rootDir src <pattern>`.
- Build shared before typechecking consumers: `npm run build -w @credit-core/shared`.
- Typecheck: `npx tsc -p apps/backend/tsconfig.json --noEmit` and `npx tsc -p apps/web-operator/tsconfig.json --noEmit`.

---

## File structure

- Create `packages/shared/src/contract-number.ts` — pure `formatContractNumber()` helper + types.
- Modify `packages/shared/src/index.ts` — export the new module.
- Modify `packages/shared/src/dto.ts` — contract fields on `CreditCaseDto`; `ReMflMatchDto` / `ReMflContractDto` search-result types; `ReMflCreatePayload`.
- Modify `apps/backend/prisma/schema.prisma` — `ContractCounter` model + `CreditCase` fields.
- Create `apps/backend/src/credit-cases/contract-counter.ts` — `nextGlobal(tx)`, `nextYearly(tx, year)` atomic helpers.
- Modify `apps/backend/src/credit-cases/credit-cases.service.ts` — assign number on submit; `searchReMfl()`; `createReMfl()`.
- Modify `apps/backend/src/credit-cases/credit-cases.controller.ts` — `GET /cases/re-mfl/search`, `POST /cases/re-mfl`.
- Modify `apps/backend/src/credit-cases/dto.ts` — `ReMflSearchDto`, `ReMflCreateDto`.
- Modify `apps/backend/src/credit-cases/case.mapper.ts` — map contract fields.
- Modify `packages/api-client/src/index.ts` — `searchReMfl()`, `createReMfl()`.
- Create `packages/ui/src/pages/ReMflPage.tsx` — search UI + results + create.
- Modify `packages/ui/src/RoleApp.tsx` — `/cases/re-mfl` route (operator + admin).
- Modify `packages/ui/src/components/AppShell.tsx` — nav item (operator + admin).
- Modify `packages/ui/src/pages/origination/steps.tsx` — Step 3 contract-number fields read-only/auto.

---

### Task 1: Shared `formatContractNumber` helper (TDD)

**Files:**
- Create: `packages/shared/src/contract-number.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/contract-number.spec.ts`

**Interfaces:**
- Produces: `formatContractNumber(global: number, yearly: number, branch: string): string`

- [ ] **Step 1: Write the failing test**

Create `packages/shared/src/contract-number.spec.ts`:
```ts
import { formatContractNumber } from './contract-number';

describe('formatContractNumber', () => {
  it('joins global MFL yearly branch with single spaces', () => {
    expect(formatContractNumber(2012, 1320, 'PS')).toBe('2012 MFL 1320 PS');
  });
  it('handles small numbers', () => {
    expect(formatContractNumber(1, 1, 'BR')).toBe('1 MFL 1 BR');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && node ../../node_modules/jest/bin/jest.js contract-number`
Expected: FAIL — cannot find module './contract-number'.

> If `jest` is not wired in `packages/shared`, run from repo root instead:
> `node node_modules/jest/bin/jest.js packages/shared/src/contract-number`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/shared/src/contract-number.ts`:
```ts
/** Full contract number: "{GLOBAL} MFL {YEARLY} {BRANCH}" e.g. "2012 MFL 1320 PS".
 *  GLOBAL is the company-wide ever-increasing counter, YEARLY resets each year,
 *  BRANCH is the filial symbol (Branch.symbol). */
export function formatContractNumber(global: number, yearly: number, branch: string): string {
  return `${global} MFL ${yearly} ${branch}`;
}
```

- [ ] **Step 4: Add the export**

In `packages/shared/src/index.ts` add after the other exports:
```ts
export * from './contract-number';
```

- [ ] **Step 5: Run test to verify it passes + build shared**

Run: `node node_modules/jest/bin/jest.js packages/shared/src/contract-number` → PASS
Run: `npm run build -w @credit-core/shared` → no errors

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/contract-number.ts packages/shared/src/contract-number.spec.ts packages/shared/src/index.ts
git commit -m "feat(shared): formatContractNumber helper"
```

---

### Task 2: Prisma — `ContractCounter` + `CreditCase` contract fields

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`

**Interfaces:**
- Produces: Prisma models `ContractCounter { id, value }`; `CreditCase.contractGlobalNo/contractYearlyNo/contractBranchSym/contractNumber/isReMfl/reMflSourceId`.

- [ ] **Step 1: Add the counter model**

In `apps/backend/prisma/schema.prisma`, add near the other small models:
```prisma
/// Company-wide contract-number counters. id = "global" (never resets) or a year like "2026".
model ContractCounter {
  id    String @id
  value Int    @default(0)
}
```

- [ ] **Step 2: Add fields to `CreditCase`**

Find `model CreditCase {` and add these fields (near the existing `number` field):
```prisma
  contractGlobalNo  Int?
  contractYearlyNo  Int?
  contractBranchSym String?
  contractNumber    String?  @unique
  isReMfl           Boolean  @default(false)
  reMflSourceId     String?
```

- [ ] **Step 3: Regenerate the Prisma client**

Run: `npm run db:generate -w @credit-core/backend`
Expected: "Generated Prisma Client".

- [ ] **Step 4: Typecheck backend (fields resolve)**

Run: `npx tsc -p apps/backend/tsconfig.json --noEmit`
Expected: no errors (new fields optional, nothing references them yet).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/prisma/schema.prisma
git commit -m "feat(db): ContractCounter + CreditCase contract-number fields"
```

---

### Task 3: Atomic counter helpers (TDD, integration)

**Files:**
- Create: `apps/backend/src/credit-cases/contract-counter.ts`
- Test: `apps/backend/src/credit-cases/contract-counter.spec.ts`

**Interfaces:**
- Consumes: a Prisma transaction client with `.contractCounter.upsert`.
- Produces:
  - `nextCounter(tx: CounterTx, id: string): Promise<number>` — atomically increments row `id`, returns the NEW value (creates the row at 1 if missing).
  - `type CounterTx = { contractCounter: { upsert: Function } }`

- [ ] **Step 1: Write the failing test**

Create `apps/backend/src/credit-cases/contract-counter.spec.ts`:
```ts
import { nextCounter } from './contract-counter';

function fakeTx() {
  const rows = new Map<string, number>();
  return {
    rows,
    contractCounter: {
      upsert: async ({ where, create, update }: any) => {
        const cur = rows.get(where.id);
        const val = cur == null ? create.value : cur + update.value.increment;
        rows.set(where.id, val);
        return { id: where.id, value: val };
      },
    },
  };
}

describe('nextCounter', () => {
  it('starts at 1 and increments', async () => {
    const tx = fakeTx();
    expect(await nextCounter(tx as any, 'global')).toBe(1);
    expect(await nextCounter(tx as any, 'global')).toBe(2);
    expect(await nextCounter(tx as any, 'global')).toBe(3);
  });
  it('tracks separate ids independently', async () => {
    const tx = fakeTx();
    expect(await nextCounter(tx as any, 'global')).toBe(1);
    expect(await nextCounter(tx as any, '2026')).toBe(1);
    expect(await nextCounter(tx as any, 'global')).toBe(2);
    expect(await nextCounter(tx as any, '2026')).toBe(2);
  });
}
);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && node ../../node_modules/jest/bin/jest.js --rootDir src contract-counter`
Expected: FAIL — cannot find './contract-counter'.

- [ ] **Step 3: Write minimal implementation**

Create `apps/backend/src/credit-cases/contract-counter.ts`:
```ts
/** Minimal transaction-client shape this helper needs (real Prisma tx satisfies it). */
export interface CounterTx {
  contractCounter: {
    upsert(args: {
      where: { id: string };
      create: { id: string; value: number };
      update: { value: { increment: number } };
    }): Promise<{ id: string; value: number }>;
  };
}

/**
 * Atomically bump the counter row `id` by 1 and return the NEW value. Creates the
 * row at 1 when missing (so a new year's row auto-starts at 1). The upsert runs under
 * the row lock inside the caller's transaction, so concurrent submits never collide.
 */
export async function nextCounter(tx: CounterTx, id: string): Promise<number> {
  const row = await tx.contractCounter.upsert({
    where: { id },
    create: { id, value: 1 },
    update: { value: { increment: 1 } },
  });
  return row.value;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/backend && node ../../node_modules/jest/bin/jest.js --rootDir src contract-counter`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/credit-cases/contract-counter.ts apps/backend/src/credit-cases/contract-counter.spec.ts
git commit -m "feat(cases): atomic contract-counter helper"
```

---

### Task 4: Assign the contract number on submit (DRAFT → MODERATION)

**Files:**
- Modify: `apps/backend/src/credit-cases/credit-cases.service.ts` (import; the submit block ~line 410; the transaction ~line 427)

**Interfaces:**
- Consumes: `nextCounter` (Task 3), `formatContractNumber` (Task 1), `ContractCounter`/`CreditCase` fields (Task 2).
- Produces: on submit, sets `contractGlobalNo/contractYearlyNo/contractBranchSym/contractNumber` on the case.

- [ ] **Step 1: Add imports**

At the top of `credit-cases.service.ts`, extend the shared import to include `formatContractNumber`:
```ts
import { addBusinessDays, CaseStatus, DocumentType, formatContractNumber, hasDeadline, INSURANCE_ANNUAL_RATE, INSURANCE_MAX_MONTHS, isCaseInScope, loanRuleViolations, originationPersistedValues, paymentDayFor, ProductType, Role } from '@credit-core/shared';
```
And add near the other local imports:
```ts
import { nextCounter } from './contract-counter';
```

- [ ] **Step 2: Load the fields needed to assign the number**

In `transition()`, extend the initial `findUnique` include/select (~line 395) so we have the branch symbol, existing contract number, re-MFL link, and the source's retained parts. Replace the `findUnique` call with:
```ts
    const c = await this.prisma.creditCase.findUnique({
      where: { id },
      include: {
        documents: true,
        collaterals: { select: { id: true } },
        creditLine: { include: { tranches: true } },
        branch: { select: { symbol: true } },
        reMflSource: { select: { contractYearlyNo: true, contractBranchSym: true } },
      },
    });
```

> `reMflSource` requires a self-relation on `CreditCase`. Add it in this task: in `schema.prisma`, inside `model CreditCase`, change the raw `reMflSourceId String?` (from Task 2) to a relation:
> ```prisma
>   reMflSource   CreditCase?  @relation("ReMfl", fields: [reMflSourceId], references: [id], onDelete: SetNull)
>   reMflSourceId String?
>   reMflChildren CreditCase[] @relation("ReMfl")
> ```
> Then re-run `npm run db:generate -w @credit-core/backend`.

- [ ] **Step 3: Assign the number inside the submit block**

In the `if (c.status === CaseStatus.DRAFT && rule.to === CaseStatus.MODERATION) {` block, AFTER the existing validation (after the `loanRuleViolations` check, before the block closes at ~line 423), compute the number only when not already set:
```ts
      // Assign the company-wide contract number exactly once, at submit.
      if (!c.contractNumber) {
        await this.prisma.$transaction(async (tx) => {
          const global = await nextCounter(tx, 'global');
          let yearly: number;
          let branchSym: string;
          if (c.isReMfl && c.reMflSource?.contractYearlyNo != null) {
            yearly = c.reMflSource.contractYearlyNo;
            branchSym = c.reMflSource.contractBranchSym ?? c.branch?.symbol ?? 'GEN';
          } else {
            yearly = await nextCounter(tx, String(new Date().getFullYear()));
            branchSym = c.branch?.symbol ?? 'GEN';
          }
          await tx.creditCase.update({
            where: { id },
            data: {
              contractGlobalNo: global,
              contractYearlyNo: yearly,
              contractBranchSym: branchSym,
              contractNumber: formatContractNumber(global, yearly, branchSym),
            },
          });
        });
      }
```

- [ ] **Step 4: Typecheck backend**

Run: `npx tsc -p apps/backend/tsconfig.json --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/prisma/schema.prisma apps/backend/src/credit-cases/credit-cases.service.ts
git commit -m "feat(cases): assign contract number on submit; ReMfl self-relation"
```

---

### Task 5: Expose contract fields in the case DTO + mapper

**Files:**
- Modify: `packages/shared/src/dto.ts` (add to `CreditCaseDto`)
- Modify: `apps/backend/src/credit-cases/case.mapper.ts` (map them in `toCaseDto`)

**Interfaces:**
- Produces: `CreditCaseDto.contractNumber/contractGlobalNo/contractYearlyNo/contractBranchSym/isReMfl` (all optional/nullable).

- [ ] **Step 1: Add fields to `CreditCaseDto`**

In `packages/shared/src/dto.ts`, find `interface CreditCaseDto` (the full case detail type — the one already holding `productType`, `amount`, `guarantors`, `documents`). Add:
```ts
  contractNumber: string | null;
  contractGlobalNo: number | null;
  contractYearlyNo: number | null;
  contractBranchSym: string | null;
  isReMfl: boolean;
```

- [ ] **Step 2: Map them in `case.mapper.ts`**

In `toCaseDto` (the function returning the full `CreditCaseDto`), add alongside the existing top-level fields (near `number: c.number,`):
```ts
    contractNumber: c.contractNumber ?? null,
    contractGlobalNo: c.contractGlobalNo ?? null,
    contractYearlyNo: c.contractYearlyNo ?? null,
    contractBranchSym: c.contractBranchSym ?? null,
    isReMfl: c.isReMfl,
```

- [ ] **Step 3: Build shared + typecheck backend**

Run: `npm run build -w @credit-core/shared`
Run: `npx tsc -p apps/backend/tsconfig.json --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/dto.ts apps/backend/src/credit-cases/case.mapper.ts
git commit -m "feat(cases): expose contract number in case DTO"
```

---

### Task 6: Qayta MFL search — service + endpoint (TDD for the query shape)

**Files:**
- Modify: `packages/shared/src/dto.ts` (`ReMflContractDto`)
- Modify: `apps/backend/src/credit-cases/dto.ts` (`ReMflSearchDto`)
- Modify: `apps/backend/src/credit-cases/credit-cases.service.ts` (`searchReMfl`)
- Modify: `apps/backend/src/credit-cases/credit-cases.controller.ts` (`GET /cases/re-mfl/search`)

**Interfaces:**
- Produces:
  - `ReMflContractDto = { caseId: string; contractNumber: string | null; status: CaseStatus; date: string; amount: number | null; fullName: string; contractYearlyNo: number | null; contractBranchSym: string | null }`
  - `CreditCasesService.searchReMfl(term: string): Promise<ReMflContractDto[]>`

- [ ] **Step 1: Add the shared result type**

In `packages/shared/src/dto.ts` add:
```ts
export interface ReMflContractDto {
  caseId: string;
  contractNumber: string | null;
  contractYearlyNo: number | null;
  contractBranchSym: string | null;
  status: CaseStatus;
  date: string;          // case createdAt ISO
  amount: number | null;
  fullName: string;
}
```

- [ ] **Step 2: Add the request DTO**

In `apps/backend/src/credit-cases/dto.ts` add:
```ts
export class ReMflSearchDto {
  @IsString() @MinLength(2) term!: string;
}
```

- [ ] **Step 3: Implement `searchReMfl` in the service**

Add to `CreditCasesService`:
```ts
  /** Find existing clients (for Qayta MFL) by name / passport series+number / PINFL / phone.
   *  Returns their contracts (only ones that already have a contract number) with status/date/amount. */
  async searchReMfl(term: string): Promise<ReMflContractDto[]> {
    const t = term.trim();
    const cases = await this.prisma.creditCase.findMany({
      where: {
        contractNumber: { not: null },
        borrower: {
          OR: [
            { fullName: { contains: t } },
            { pinfl: { contains: t } },
            { phone: { contains: t } },
            { passportNumber: { contains: t } },
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { borrower: { select: { fullName: true } } },
    });
    return cases.map((c) => ({
      caseId: c.id,
      contractNumber: c.contractNumber ?? null,
      contractYearlyNo: c.contractYearlyNo ?? null,
      contractBranchSym: c.contractBranchSym ?? null,
      status: c.status as CaseStatus,
      date: c.createdAt.toISOString(),
      amount: c.amount != null ? Number(c.amount) : null,
      fullName: c.borrower?.fullName ?? '—',
    }));
  }
```
Add `ReMflContractDto` to the `@credit-core/shared` import at the top of the service file, and `ReMflSearchDto` to the `./dto` import.

- [ ] **Step 4: Add the endpoint**

In `credit-cases.controller.ts`, add (guarded to operator + admin):
```ts
  @UseGuards(RolesGuard)
  @Roles(Role.OPERATOR, Role.ADMIN)
  @Get('re-mfl/search')
  searchReMfl(@Query() dto: ReMflSearchDto) {
    return this.service.searchReMfl(dto.term);
  }
```
Ensure `Get`, `Query` are imported from `@nestjs/common` and `ReMflSearchDto` from `./dto`. Place this route BEFORE any `@Get(':id')` route so `re-mfl` is not captured as an id.

- [ ] **Step 5: Build shared + typecheck backend**

Run: `npm run build -w @credit-core/shared`
Run: `npx tsc -p apps/backend/tsconfig.json --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/dto.ts apps/backend/src/credit-cases/dto.ts apps/backend/src/credit-cases/credit-cases.service.ts apps/backend/src/credit-cases/credit-cases.controller.ts
git commit -m "feat(cases): Qayta MFL search endpoint"
```

---

### Task 7: Qayta MFL create — new draft linked to a source contract

**Files:**
- Modify: `packages/shared/src/dto.ts` (`ReMflCreatePayload`)
- Modify: `apps/backend/src/credit-cases/dto.ts` (`ReMflCreateDto`)
- Modify: `apps/backend/src/credit-cases/credit-cases.service.ts` (`createReMfl`)
- Modify: `apps/backend/src/credit-cases/credit-cases.controller.ts` (`POST /cases/re-mfl`)

**Interfaces:**
- Consumes: `borrowerData()` (existing private method), `nextNumber()` (existing).
- Produces: `CreditCasesService.createReMfl(user, sourceCaseId): Promise<CreditCaseDto>` — a new DRAFT copying the source borrower identity, `isReMfl=true`, `reMflSourceId=sourceCaseId`.

- [ ] **Step 1: Add the request DTO**

In `apps/backend/src/credit-cases/dto.ts`:
```ts
export class ReMflCreateDto {
  @IsString() @MinLength(1) sourceCaseId!: string;
}
```

- [ ] **Step 2: Implement `createReMfl`**

Add to `CreditCasesService` (mirrors the identity-only carry-over from the spec — copies borrower personal fields, leaves financials empty):
```ts
  /** Qayta MFL: create a new DRAFT for a repeat client, copying only their identity from the
   *  chosen source contract. Financials are entered fresh. Yearly+branch are reused at submit. */
  async createReMfl(user: RequestUser, sourceCaseId: string) {
    const src = await this.prisma.creditCase.findUnique({
      where: { id: sourceCaseId },
      include: { borrower: true },
    });
    if (!src || !src.borrower) throw new NotFoundException('Manba shartnoma topilmadi');
    const b = src.borrower;
    const number = await this.nextNumber(user.branchId ? (await this.prisma.branch.findUnique({ where: { id: user.branchId }, select: { symbol: true } }))?.symbol ?? null : null);
    const created = await this.prisma.creditCase.create({
      data: {
        number,
        productType: src.productType,
        status: CaseStatus.DRAFT,
        branchId: user.branchId,
        createdById: user.id,
        isReMfl: true,
        reMflSourceId: src.id,
        borrower: {
          create: {
            fullName: b.fullName, passportSeries: b.passportSeries, passportNumber: b.passportNumber,
            pinfl: b.pinfl, birthDate: b.birthDate, address: b.address, phone: b.phone,
            gender: b.gender, citizenship: b.citizenship, placeOfBirth: b.placeOfBirth,
            previousName: b.previousName, inn: b.inn, passportIssuer: b.passportIssuer,
            passportIssueDate: b.passportIssueDate, passportExpiry: b.passportExpiry,
            regAddress: b.regAddress, regLandmark: b.regLandmark, actualAddress: b.actualAddress,
            actualLandmark: b.actualLandmark, phones: b.phones ?? undefined,
            closeContacts: (b.closeContacts ?? undefined) as object | undefined,
          },
        },
      },
      include: caseInclude,
    });
    await this.audit.caseCreate(user, created.id);
    return toCaseDto(created);
  }
```
Ensure `caseInclude` and `toCaseDto` are already imported at the top (they are — used by `createCase`).

- [ ] **Step 3: Add the endpoint**

In `credit-cases.controller.ts`:
```ts
  @UseGuards(RolesGuard)
  @Roles(Role.OPERATOR, Role.ADMIN)
  @Post('re-mfl')
  createReMfl(@CurrentUser() user: RequestUser, @Body() dto: ReMflCreateDto) {
    return this.service.createReMfl(user, dto.sourceCaseId);
  }
```
Import `ReMflCreateDto` from `./dto`.

- [ ] **Step 4: Typecheck backend**

Run: `npx tsc -p apps/backend/tsconfig.json --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/dto.ts apps/backend/src/credit-cases/dto.ts apps/backend/src/credit-cases/credit-cases.service.ts apps/backend/src/credit-cases/credit-cases.controller.ts
git commit -m "feat(cases): Qayta MFL create linked draft"
```

---

### Task 8: api-client methods

**Files:**
- Modify: `packages/api-client/src/index.ts`

**Interfaces:**
- Produces: `api.searchReMfl(term): Promise<ReMflContractDto[]>`, `api.createReMfl(sourceCaseId): Promise<CreditCaseDto>`.

- [ ] **Step 1: Add the methods**

Near the other case methods in `packages/api-client/src/index.ts`:
```ts
  async searchReMfl(term: string): Promise<ReMflContractDto[]> {
    const { data } = await http.get<ReMflContractDto[]>('/cases/re-mfl/search', { params: { term } });
    return data;
  },
  async createReMfl(sourceCaseId: string): Promise<CreditCaseDto> {
    const { data } = await http.post<CreditCaseDto>('/cases/re-mfl', { sourceCaseId });
    return data;
  },
```
Add `ReMflContractDto` to the `@credit-core/shared` type import at the top of the file (where `CreditCaseDto` is already imported).

- [ ] **Step 2: Typecheck operator app (consumes api-client + shared)**

Run: `npm run build -w @credit-core/shared && npx tsc -p apps/web-operator/tsconfig.json --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/api-client/src/index.ts
git commit -m "feat(api-client): Qayta MFL search + create"
```

---

### Task 9: Qayta MFL page (UI)

**Files:**
- Create: `packages/ui/src/pages/ReMflPage.tsx`
- Modify: `packages/ui/src/RoleApp.tsx` (route)
- Modify: `packages/ui/src/components/AppShell.tsx` (nav item)

**Interfaces:**
- Consumes: `api.searchReMfl`, `api.createReMfl`, `CASE_STATUS_LABEL`/`formatMoney` if present.

- [ ] **Step 1: Create the page**

Create `packages/ui/src/pages/ReMflPage.tsx`:
```tsx
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@credit-core/api-client';
import type { ReMflContractDto } from '@credit-core/shared';
import { Button, Card, Input } from '../components/primitives';
import { useToast } from '../components/Toast';
import { formatMoney } from '../lib/cn';

export function ReMflPage() {
  const nav = useNavigate();
  const toast = useToast();
  const [term, setTerm] = useState('');
  const [rows, setRows] = useState<ReMflContractDto[]>([]);
  const search = useMutation({
    mutationFn: () => api.searchReMfl(term.trim()),
    onSuccess: (r) => { setRows(r); if (!r.length) toast.info('Topilmadi', 'Mos mijoz yo‘q'); },
    onError: () => toast.error('Xatolik', 'Qidiruv bajarilmadi'),
  });
  const create = useMutation({
    mutationFn: (sourceCaseId: string) => api.createReMfl(sourceCaseId),
    onSuccess: (c) => { toast.success('Yaratildi', 'Qayta MFL arizasi'); nav(`/cases/${c.id}/origination`); },
    onError: () => toast.error('Xatolik', 'Ariza yaratilmadi'),
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Qayta MFL</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Takroriy mijozni qidiring — F.I.O, PINFL, telefon yoki pasport raqami</p>
      </div>
      <Card className="space-y-3">
        <div className="flex gap-2">
          <Input value={term} onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && term.trim().length >= 2 && search.mutate()} placeholder="Qidiruv…" />
          <Button loading={search.isPending} disabled={term.trim().length < 2} onClick={() => search.mutate()}>Qidirish</Button>
        </div>
      </Card>
      {rows.length > 0 && (
        <Card className="space-y-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">Shartnomani tanlang — MFL raqami (yillik+filial) shundan olinadi</p>
          <div className="divide-y divide-gray-100 dark:divide-white/10">
            {rows.map((r) => (
              <div key={r.caseId} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <div className="truncate font-medium text-gray-800 dark:text-white">{r.fullName} · <span className="nums">{r.contractNumber ?? '—'}</span></div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{new Date(r.date).toLocaleDateString()} · {r.status} · {r.amount != null ? formatMoney(r.amount) : '—'}</div>
                </div>
                <Button variant="secondary" loading={create.isPending} onClick={() => create.mutate(r.caseId)}>Tanlash</Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
```

> If `useToast` has no `.info`, use `toast.error('Topilmadi', ...)` instead in the `onSuccess` empty branch, or drop that line.

- [ ] **Step 2: Add the route**

In `packages/ui/src/RoleApp.tsx`, import and add the route next to the other operator/admin routes:
```tsx
import { ReMflPage } from './pages/ReMflPage';
// ...
{(role === Role.OPERATOR || role === Role.ADMIN) && <Route path="/cases/re-mfl" element={<ReMflPage />} />}
```

- [ ] **Step 3: Add the nav item**

In `packages/ui/src/components/AppShell.tsx`, find the nav-item list and add a "Qayta MFL" entry visible to operator + admin, linking to `/cases/re-mfl`. Match the existing nav-item pattern (icon + label + `to`). Use an existing icon (e.g. `RotateCcw` from `../lib/icons`).

- [ ] **Step 4: Typecheck operator app**

Run: `npx tsc -p apps/web-operator/tsconfig.json --noEmit`
Expected: no errors. (If `iconsax-react` bundle errors appear at `vite build`, ignore — pre-existing local dep issue; tsc is the gate.)

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/pages/ReMflPage.tsx packages/ui/src/RoleApp.tsx packages/ui/src/components/AppShell.tsx
git commit -m "feat(ui): Qayta MFL search page + nav + route"
```

---

### Task 10: Step 3 — contract number fields become read-only/auto

**Files:**
- Modify: `packages/ui/src/pages/origination/steps.tsx` (Step 3 РКЛ card)
- Modify: `packages/ui/src/pages/origination/Summary.tsx` (optional: show contract number)

**Interfaces:**
- Consumes: `f.form` — but the contract number lives on the loaded case, not the wizard form. Read it from the case query if available; otherwise show "—".

- [ ] **Step 1: Replace manual number inputs with read-only auto fields**

In `steps.tsx` Step 3, replace the current editable "Liniya № (РКЛ)" and "Prikaz № / bosh kelishuv" fields with read-only displays. Since the number is assigned on submit (not present in DRAFT), show the placeholder until assigned. The wizard's loaded case (via `useOriginationForm`) should expose `contractNumber` / `contractYearlyNo`; if the hook does not yet return the loaded case, add `contractNumber` to what the query stores and return it from the hook. Field markup:
```tsx
<Field label="Liniya № (РКЛ)" hint="submit'da avto beriladi"><Input readOnly value={f.contractYearlyNo != null ? String(f.contractYearlyNo) : '—'} className="nums bg-gray-50 dark:bg-white/5" /></Field>
<Field label="Shartnoma raqami" hint="avto — moderatorga yuborilganda"><Input readOnly value={f.contractNumber ?? '—'} className="nums bg-gray-50 dark:bg-white/5" /></Field>
```
Remove the old `setLine({ lineNumber })` / `setLine({ orderNumber })` editable inputs. Expose `contractNumber` and `contractYearlyNo` from `useOriginationForm` by storing them from the `api.case(id)` query result (`c.contractNumber`, `c.contractYearlyNo`) in state and returning them.

- [ ] **Step 2: Typecheck operator app**

Run: `npm run build -w @credit-core/shared && npx tsc -p apps/web-operator/tsconfig.json --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/pages/origination/steps.tsx packages/ui/src/pages/origination/useOriginationForm.ts packages/ui/src/pages/origination/Summary.tsx
git commit -m "feat(ui): contract number read-only/auto in Step 3"
```

---

### Task 11: Manual end-to-end verification (no deploy)

**Files:** none (verification only).

- [ ] **Step 1: Full backend typecheck + unit tests**

Run: `npx tsc -p apps/backend/tsconfig.json --noEmit`
Run: `cd apps/backend && node ../../node_modules/jest/bin/jest.js --rootDir src contract`
Expected: contract-number + contract-counter specs PASS; no type errors.

- [ ] **Step 2: Full operator typecheck**

Run: `npm run build -w @credit-core/shared && npx tsc -p apps/web-operator/tsconfig.json --noEmit`
Expected: no errors.

- [ ] **Step 3: Sanity checklist (manual, on a running instance)**

Confirm against the spec:
- New application → submit to moderator → case gets `contractNumber` like `1 MFL 1 <BRANCH>`; a second submit → `2 MFL 2 <BRANCH>`.
- Draft (not submitted) has `contractNumber = null`.
- Re-submit after RETURN does not change the number.
- Qayta MFL page → search by name/PINFL/phone → pick a source → new draft opens with identity copied → submit → `contractNumber = "{next_global} MFL {source_yearly} {source_branch}"` (yearly NOT incremented).

- [ ] **Step 4: Commit (docs/notes only, if any)**

```bash
git add -A
git commit -m "chore: Feature A verification notes" --allow-empty
```

---

## Self-review notes

- **Spec coverage:** §2 numbering → Tasks 1,2,4; §3 model → Task 2; §4 assignment → Task 4; §5 Qayta MFL → Tasks 6,7,9; §6 UI → Tasks 9,10; §7 edge cases (re-submit keeps number, yearly reuse) → Task 4 guard `!c.contractNumber` + reMflSource branch. Verified in Task 11.
- **Number ≠ ariza id:** existing `number` untouched; new fields are separate (Task 2/5).
- **Atomicity:** counters via `upsert increment` inside a `$transaction` (Tasks 3,4).
- **Out of scope (later features):** insurance brackets (B), document generation (C), KATM-required, payment-date holidays (D) — not in this plan.
