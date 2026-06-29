# Origination Capture Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an operator capture the full 4-tab workbook dataset (Д1/Д2/Д3 + b4) into the existing SP-1 models through a 5-step wizard, with live affordability auto-calc and the loan business rules enforced inline.

**Architecture:** Pure business logic + calc live in `@credit-core/shared` (one helper, unit-tested against the TADJIYEV fixture). The backend extends the existing `UpsertCaseDto` / `$transaction` upsert and case mapper to round-trip 6 new one-to-one relations; two `AppConfig` fields hold the lending-rate bounds; small PATCH endpoints handle per-step autosave and the moderator rate change. The UI adds an `OriginationWizard` (stepper + per-step panels + sticky summary) reusing the existing form primitives and `CollateralCard`.

**Tech Stack:** TypeScript, React 18 + Vite + Tailwind + TanStack Query (UI), NestJS + Prisma + class-validator (backend), Jest (tests), pnpm/npm workspaces.

## Global Constraints

- **No new DB models.** Only two new `AppConfig` columns (`minRate`, `maxRate`). All entities (`Employment`, `Affordability`, `CreditLine`, `Tranche`, `InsurancePolicy`, `CreditHistory`, extended `Borrower`) already exist in `apps/backend/prisma/schema.prisma`.
- **Rates are fractions** (e.g. `0.55` = 55%); UI shows whole-number %. `minRate` default `0.55`, `maxRate` default `0.60`. Distinct from `markupPercent`/`bankRate` (loan-economics calculator) — never conflate.
- **Loan type auto:** `amountTotal ≤ 100,000,000 → MICROLOAN (микроқарз)`, else `MICROCREDIT (микрокредит)`.
- **Term caps:** `ANNUITY ≤ 30 months`, `DIFFERENTIATED ≤ 48 months`.
- **Rate governance:** per-case `CreditLine.interestRate` starts at `minRate`; **moderator** may raise within `[minRate, maxRate]` during `MODERATION`; never below `minRate`. Server enforces.
- **Income is honest:** operator enters actual income; the 2.2× figure is a shown guide, never back-filled.
- **DRAFT-only edit + operator ownership** guards stay (existing pattern in `credit-cases.service.ts`).
- **Enums** use the const-object + union pattern (see `packages/shared/src/enums.ts`) so they stay assignable to Prisma enums.
- **Tests** run with `npm test -w @credit-core/backend` (Jest); they import shared logic from `@credit-core/shared` (see `apps/backend/src/common/loan.spec.ts`).
- **UI verification:** `tsc --noEmit` + `vite build` (preview screenshots are unreliable on this app — see `ui-verification` memory). Compiled-CSS/grep checks where relevant.
- Uzbek user-facing copy; match surrounding tone.

---

### Task 1: Shared business rules + affordability calc

**Files:**
- Modify: `packages/shared/src/enums.ts` (add `LoanType`, `RepaymentMethod`)
- Create: `packages/shared/src/origination.ts`
- Modify: `packages/shared/src/index.ts` (export `./origination`)
- Test: `apps/backend/src/common/origination.spec.ts`

**Interfaces:**
- Produces: `LoanType`, `RepaymentMethod` (const-enums); `MICRO_THRESHOLD`, `loanTypeFor(amount)`, `TERM_CAP`, `termCapFor(method)`, `isTermValid(method, term)`, `SECTOR_RISK` (`{label,code}[]`), `sectorRiskCode(label)`, `originationCalc(input): OriginationCalc`, and the `OriginationCalcInput`/`OriginationCalc` interfaces.

- [ ] **Step 1: Add enums** to `packages/shared/src/enums.ts` (append):

```ts
/** Product subtype by amount: ≤100M микроқарз, >100M микрокредит. */
export const LoanType = { MICROLOAN: 'MICROLOAN', MICROCREDIT: 'MICROCREDIT' } as const;
export type LoanType = (typeof LoanType)[keyof typeof LoanType];

/** Repayment method — drives the schedule and the term cap. */
export const RepaymentMethod = { ANNUITY: 'ANNUITY', DIFFERENTIATED: 'DIFFERENTIATED' } as const;
export type RepaymentMethod = (typeof RepaymentMethod)[keyof typeof RepaymentMethod];
```

- [ ] **Step 2: Write the failing test** `apps/backend/src/common/origination.spec.ts`:

```ts
import {
  loanTypeFor, LoanType, isTermValid, RepaymentMethod, originationCalc, sectorRiskCode,
} from '@credit-core/shared';

describe('origination business rules', () => {
  it('loan type splits at 100M', () => {
    expect(loanTypeFor(100_000_000)).toBe(LoanType.MICROLOAN);
    expect(loanTypeFor(100_000_001)).toBe(LoanType.MICROCREDIT);
    expect(loanTypeFor(130_000_000)).toBe(LoanType.MICROCREDIT);
  });

  it('term caps: annuity ≤30, differential ≤48', () => {
    expect(isTermValid(RepaymentMethod.ANNUITY, 30)).toBe(true);
    expect(isTermValid(RepaymentMethod.ANNUITY, 31)).toBe(false);
    expect(isTermValid(RepaymentMethod.DIFFERENTIATED, 48)).toBe(true);
    expect(isTermValid(RepaymentMethod.DIFFERENTIATED, 49)).toBe(false);
  });

  it('sector risk code lookup', () => {
    expect(sectorRiskCode('Бытовые услуги / Сервисные центры / Автосервис')).toBe(10);
  });
});

describe('originationCalc (TADJIYEV fixture)', () => {
  const calc = originationCalc({
    mainActivityIncome: 18_838_000,
    existingCreditBurden: 502_353,
    newLoanPayment: 8_060_000,
    utilitiesExpense: 190_000,
    familyExpense: 290_000,
    otherExpense: 100_000,
    loanUnderPolicy: 60_000_000,
    insuranceRate: 0.02,
    policyTermMonths: 24,
    amountTotal: 130_000_000,
    collateralTotal: 126_000_000,
  });

  it('income, expenses, DTI, surplus', () => {
    expect(calc.totalIncome).toBe(18_838_000);
    expect(calc.totalCreditPayments).toBe(8_562_353);
    expect(calc.totalExpenses).toBe(9_142_353);
    expect(Number(calc.dtiRatio.toFixed(4))).toBe(0.4545);
    expect(calc.surplus).toBe(9_695_647);
  });

  it('min required income (2.2× round up to 1000)', () => {
    expect(calc.minRequiredIncome).toBe(18_838_000);
  });

  it('insurance: insuredSum 1.3×, premium', () => {
    expect(calc.insuredSum).toBe(78_000_000);
    expect(calc.premium).toBe(3_120_000);
  });

  it('affordability ok when surplus≥0 and income≥required', () => {
    expect(calc.affordabilityOk).toBe(true);
  });
});
```

- [ ] **Step 3: Run it — expect FAIL** (`Cannot find module './origination'` / undefined exports):

Run: `npm test -w @credit-core/backend -- origination.spec`
Expected: FAIL.

- [ ] **Step 4: Create** `packages/shared/src/origination.ts`:

```ts
import { LoanType, RepaymentMethod } from './enums';

/** ≤ threshold → микроқарз, > → микрокредит. */
export const MICRO_THRESHOLD = 100_000_000;
export function loanTypeFor(amount: number | null | undefined): LoanType {
  return (amount ?? 0) > MICRO_THRESHOLD ? LoanType.MICROCREDIT : LoanType.MICROLOAN;
}

/** Max term (months) per repayment method. */
export const TERM_CAP: Record<RepaymentMethod, number> = {
  [RepaymentMethod.ANNUITY]: 30,
  [RepaymentMethod.DIFFERENTIATED]: 48,
};
export function termCapFor(method: RepaymentMethod): number {
  return TERM_CAP[method] ?? TERM_CAP.ANNUITY;
}
export function isTermValid(method: RepaymentMethod, term: number | null | undefined): boolean {
  return !!term && term > 0 && term <= termCapFor(method);
}

/** b3!M:N — activity sphere → industry-risk code (1–17). Lower code = lower risk. */
export const SECTOR_RISK: { label: string; code: number }[] = [
  { label: 'Безопасность / Военная служба / Служба спасения / Органы внутренних дел', code: 1 },
  { label: 'Недвижимость / Эксплуатация / ЖКХ', code: 2 },
  { label: 'Проектирование / Строительство', code: 3 },
  { label: 'Промышленность / Производство', code: 4 },
  { label: 'Сельское хозяйство', code: 5 },
  { label: 'Транспорт, Перевозка и хранение', code: 6 },
  { label: 'Фармацевтика / Медицина / Ветеринария', code: 7 },
  { label: 'Фитнес / Физкультура / Спорт', code: 8 },
  { label: 'Бухгалтерия / Банки / Страхование / Финансы / Инвестиции', code: 9 },
  { label: 'Бытовые услуги / Сервисные центры / Автосервис', code: 10 },
  { label: 'Телекоммуникации / Связь / Информационные технологии', code: 11 },
  { label: 'Юриспруденция', code: 12 },
  { label: 'Торговля / Продажи', code: 13 },
  { label: 'Государственная служба', code: 14 },
  { label: 'Маркетинг / Реклама / PR / GR', code: 15 },
  { label: 'Наука / Культура / Искусство', code: 16 },
  { label: 'Образование / Бизнес-образование / Консалтинг', code: 17 },
];
export function sectorRiskCode(label: string | null | undefined): number | null {
  return SECTOR_RISK.find((s) => s.label === label)?.code ?? null;
}

export interface OriginationCalcInput {
  mainActivityIncome?: number | null;
  secondaryIncome?: number | null;
  familyIncome?: number | null;
  otherIncome?: number | null;
  utilitiesExpense?: number | null;
  familyExpense?: number | null;
  otherExpense?: number | null;
  existingCreditBurden?: number | null; // b4 avg monthly payment on existing loans
  newLoanPayment?: number | null;       // tranche monthly payment
  loanUnderPolicy?: number | null;
  insuranceRate?: number | null;        // fraction, e.g. 0.02
  policyTermMonths?: number | null;
  amountTotal?: number | null;
  collateralTotal?: number | null;
}

export interface OriginationCalc {
  totalIncome: number;
  totalCreditPayments: number; // existing + new
  totalExpenses: number;       // utilities + family + other + existing + new payment
  dtiRatio: number;            // totalCreditPayments / totalIncome (0 when no income)
  surplus: number;             // totalIncome − totalExpenses
  minRequiredIncome: number;   // ROUNDUP((existing + new) × 2.2, −3)
  insuredSum: number;          // loanUnderPolicy × 1.3
  premium: number;             // insuredSum × rate ÷ 12 × policyTermMonths
  coverageRatio: number;       // collateralTotal / amountTotal (0 when no amount)
  affordabilityOk: boolean;    // surplus ≥ 0 && totalIncome ≥ minRequiredIncome
}

const n = (v: number | null | undefined): number => v ?? 0;
const roundUpTo = (x: number, unit: number): number => Math.ceil(x / unit) * unit;

export function originationCalc(i: OriginationCalcInput): OriginationCalc {
  const totalIncome = n(i.mainActivityIncome) + n(i.secondaryIncome) + n(i.familyIncome) + n(i.otherIncome);
  const totalCreditPayments = n(i.existingCreditBurden) + n(i.newLoanPayment);
  const totalExpenses = n(i.utilitiesExpense) + n(i.familyExpense) + n(i.otherExpense) + totalCreditPayments;
  const dtiRatio = totalIncome > 0 ? totalCreditPayments / totalIncome : 0;
  const surplus = totalIncome - totalExpenses;
  const minRequiredIncome = roundUpTo((n(i.existingCreditBurden) + n(i.newLoanPayment)) * 2.2, 1000);
  const insuredSum = roundUpTo(n(i.loanUnderPolicy) * 1.3, 1); // exact ×1.3
  const premium = i.policyTermMonths ? (insuredSum * n(i.insuranceRate)) / 12 * n(i.policyTermMonths) : 0;
  const coverageRatio = i.amountTotal ? n(i.collateralTotal) / n(i.amountTotal) : 0;
  const affordabilityOk = surplus >= 0 && totalIncome >= minRequiredIncome;
  return { totalIncome, totalCreditPayments, totalExpenses, dtiRatio, surplus, minRequiredIncome, insuredSum, premium, coverageRatio, affordabilityOk };
}
```

> Note: `insuredSum = loanUnderPolicy × 1.3` is exact (60,000,000 → 78,000,000); `roundUpTo(x,1)` is a no-op kept for symmetry. `premium = 78,000,000 × 0.02 ÷ 12 × 24 = 3,120,000`.

- [ ] **Step 5: Export** — add to `packages/shared/src/index.ts`:

```ts
export * from './origination';
```

- [ ] **Step 6: Run tests — expect PASS:**

Run: `npm test -w @credit-core/backend -- origination.spec`
Expected: PASS (all assertions).

- [ ] **Step 7: Commit:**

```bash
git add packages/shared/src/enums.ts packages/shared/src/origination.ts packages/shared/src/index.ts apps/backend/src/common/origination.spec.ts
git commit -m "feat(shared): origination business rules + affordability calc"
```

---

### Task 2: Shared DTOs (read + write) + AppConfig rate fields

**Files:**
- Modify: `packages/shared/src/dto.ts`

**Interfaces:**
- Produces: extended `BorrowerDto`; `EmploymentDto`, `AffordabilityDto`, `InsurancePolicyDto`, `CreditLineDto`, `TrancheDto`, `CreditHistoryDto`; extended `UpsertCasePayload`, `CreditCaseDto`, `AppConfigDto`; `CaseSectionKey`, `CaseSectionPayload`, `SetRatePayload`.

- [ ] **Step 1: Extend `BorrowerDto`** — add after `phone`:

```ts
  gender?: 'MALE' | 'FEMALE' | null;
  citizenship?: string | null;
  placeOfBirth?: string | null;
  previousName?: string | null;
  inn?: string | null;
  passportIssuer?: string | null;
  passportIssueDate?: string | null;
  passportExpiry?: string | null;
  regAddress?: string | null;
  regLandmark?: string | null;
  regTenure?: string | null;
  regMatchesActual?: boolean | null;
  actualAddress?: string | null;
  actualLandmark?: string | null;
  actualTenure?: string | null;
  phones?: string[] | null;
  maritalStatus?: string | null;
  familySize?: number | null;
  childrenCount?: number | null;
  education?: string | null;
  residenceDuration?: string | null;
  ownsHome?: string | null;
  depositsBand?: string | null;
```

- [ ] **Step 2: Add the new DTOs** (after `GuarantorDto`):

```ts
export interface EmploymentDto {
  employer: string | null;
  employerAddress: string | null;
  sector: string | null;
  sectorRiskCode: number | null;
  position: string | null;
  employedSince: string | null;
  experienceBand: string | null;
}

export interface AffordabilityDto {
  mainActivityIncome: number | null;
  secondaryIncome: number | null;
  familyIncome: number | null;
  otherIncome: number | null;
  utilitiesExpense: number | null;
  familyExpense: number | null;
  otherExpense: number | null;
  existingCreditBurden: number | null;
  newLoanPayment: number | null;
}

export interface InsurancePolicyDto {
  insured: boolean;
  company: string | null;
  genAgreementNo: string | null;
  genAgreementDate: string | null;
  policyNo: string | null;
  policyIssueDate: string | null;
  policyTermMonths: number | null;
  policyExpiry: string | null;
  loanUnderPolicy: number | null;
  insuredSum: number | null;
  insuranceRate: number | null;
  premium: number | null;
}

export interface TrancheDto {
  trancheNo: number | null;
  applicationNo: string | null;
  applicationDate: string | null;
  contractNo: string | null;
  contractDate: string | null;
  principal: number | null;
  termMonths: number | null;
  maturity: string | null;
  scheduleType: 'ANNUITY' | 'DIFFERENTIATED' | null;
  monthlyPayment: number | null;
  insurancePayment: number | null;
}

export interface CreditLineDto {
  lineNumber: string | null;
  loanType: 'MICROLOAN' | 'MICROCREDIT' | null;
  amountAuto: number | null;
  amountPolis: number | null;
  amountTotal: number | null;
  termMonths: number | null;
  lineDate: string | null;
  lineMaturity: string | null;
  interestRate: number | null; // fraction
  penaltyRate: number | null;  // fraction
  orderNumber: string | null;
  insurance: InsurancePolicyDto | null;
  tranche: TrancheDto | null;
}

export interface CreditHistoryDto {
  repaidLoansCount: number | null;
  activeLoansCount: number | null;
  overdueSubstandardFlag: number | null;
  otherObligations: number | null;
  loansOver5MFlag: string | null;
  priorMfiPawnshopFlag: string | null;
  totalOutstandingDebt: number | null;
  avgMonthlyPaymentExisting: number | null;
  committeeProtocolRef: string | null;
  committeeDecisionDate: string | null;
}
```

- [ ] **Step 3: Extend `UpsertCasePayload`** — add optional sections:

```ts
export interface UpsertCasePayload {
  amount: number | null;
  termMonths: number | null;
  borrower: BorrowerDto;
  guarantors: GuarantorDto[];
  collaterals: CollateralDto[];
  employment?: EmploymentDto | null;
  affordability?: AffordabilityDto | null;
  creditLine?: CreditLineDto | null;
  creditHistory?: CreditHistoryDto | null;
}
```

> The tranche + insurance ride inside `creditLine` (`creditLine.tranche`, `creditLine.insurance`).

- [ ] **Step 4: Extend `CreditCaseDto`** (read side) — add after `collaterals`:

```ts
  employment: EmploymentDto | null;
  affordability: AffordabilityDto | null;
  creditLine: CreditLineDto | null;
  creditHistory: CreditHistoryDto | null;
```

- [ ] **Step 5: Extend `AppConfigDto`**:

```ts
export interface AppConfigDto {
  maxPauseDays: number;
  markupPercent: number;
  bankRate: number;
  taxRate: number;
  nplRate: number;
  minRate: number; // lending rate floor (fraction, default 0.55)
  maxRate: number; // lending rate ceiling (fraction, default 0.60)
}
```

- [ ] **Step 6: Add section + rate payloads** (end of file):

```ts
export type CaseSectionKey = 'borrower' | 'employment' | 'affordability' | 'creditLine' | 'creditHistory';

export interface CaseSectionPayload {
  section: CaseSectionKey;
  data: Partial<UpsertCasePayload>;
}

export interface SetRatePayload {
  interestRate: number; // fraction, within [minRate, maxRate]
}
```

- [ ] **Step 7: Typecheck + commit:**

Run: `npx tsc --noEmit -p packages/shared/tsconfig.json` (Expected: no errors)

```bash
git add packages/shared/src/dto.ts
git commit -m "feat(shared): DTOs for employment/affordability/credit-line/tranche/insurance/history + rate config"
```

---

### Task 3: AppConfig `minRate`/`maxRate` (schema + seed + config service)

**Files:**
- Modify: `apps/backend/prisma/schema.prisma:172-180` (AppConfig model)
- Modify: config service + DTO that serves `getConfig`/`updateConfig` (find with grep below)

- [ ] **Step 1: Add fields** to `model AppConfig` after `nplRate`:

```prisma
  minRate       Float    @default(0.55) // klient kredit yillik foizi — pastki chegara
  maxRate       Float    @default(0.60) // yuqori chegara (moderator shu gacha ko'taradi)
```

- [ ] **Step 2: Push schema** (local dev uses db push — see `local-dev-setup` memory):

Run: `npm run -w @credit-core/backend prisma:push` (or `npx prisma db push --schema apps/backend/prisma/schema.prisma`)
Expected: "Your database is now in sync".

- [ ] **Step 3: Locate the config service:**

Run: `grep -rl "markupPercent" apps/backend/src` → expect a config module (e.g. `apps/backend/src/config/config.service.ts` + its dto).

- [ ] **Step 4: Extend the config DTO** (the class behind `updateConfig`) — add:

```ts
  @IsOptional() @IsNumber() @Min(0) @Max(5) minRate?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(5) maxRate?: number;
```

- [ ] **Step 5: Extend the config service** `getConfig`/`updateConfig` to read/write `minRate`, `maxRate` and include them in the returned object (mirror `markupPercent`). Ensure the singleton upsert defaults them.

- [ ] **Step 6: Typecheck + commit:**

Run: `npx tsc --noEmit -p apps/backend/tsconfig.json`

```bash
git add apps/backend/prisma/schema.prisma apps/backend/src/config
git commit -m "feat(backend): AppConfig min/max lending rate + config service"
```

---

### Task 4: Backend input DTOs (class-validator)

**Files:**
- Modify: `apps/backend/src/credit-cases/dto.ts`

**Interfaces:**
- Produces: `EmploymentInput`, `AffordabilityInput`, `InsuranceInput`, `TrancheInput`, `CreditLineInput`, `CreditHistoryInput`; extended `BorrowerInput`, `UpsertCaseDto`; `SetRateDto`, `CaseSectionDto`.

- [ ] **Step 1: Extend `BorrowerInput`** — add the demographic fields, all `@IsOptional()`:

```ts
  @IsOptional() @IsEnum(Gender) gender?: 'MALE' | 'FEMALE' | null;
  @IsOptional() @IsString() citizenship?: string | null;
  @IsOptional() @IsString() placeOfBirth?: string | null;
  @IsOptional() @IsString() previousName?: string | null;
  @IsOptional() @IsString() inn?: string | null;
  @IsOptional() @IsString() passportIssuer?: string | null;
  @IsOptional() @IsString() passportIssueDate?: string | null;
  @IsOptional() @IsString() passportExpiry?: string | null;
  @IsOptional() @IsString() regAddress?: string | null;
  @IsOptional() @IsString() regLandmark?: string | null;
  @IsOptional() @IsString() regTenure?: string | null;
  @IsOptional() @IsBoolean() regMatchesActual?: boolean | null;
  @IsOptional() @IsString() actualAddress?: string | null;
  @IsOptional() @IsString() actualLandmark?: string | null;
  @IsOptional() @IsString() actualTenure?: string | null;
  @IsOptional() @IsArray() @IsString({ each: true }) phones?: string[] | null;
  @IsOptional() @IsString() maritalStatus?: string | null;
  @IsOptional() @IsInt() familySize?: number | null;
  @IsOptional() @IsInt() childrenCount?: number | null;
  @IsOptional() @IsString() education?: string | null;
  @IsOptional() @IsString() residenceDuration?: string | null;
  @IsOptional() @IsString() ownsHome?: string | null;
  @IsOptional() @IsString() depositsBand?: string | null;
```

Add to the imports at the top: `IsBoolean`, `IsEnum` (already imported), and a local `Gender` enum const (`{ MALE:'MALE', FEMALE:'FEMALE' }`) or import from `@credit-core/shared` if added there. Simplest: `@IsIn(['MALE','FEMALE'])` instead of `@IsEnum(Gender)` to avoid a new import.

- [ ] **Step 2: Add the section input classes** (after `CollateralInput`):

```ts
export class EmploymentInput {
  @IsOptional() @IsString() employer?: string | null;
  @IsOptional() @IsString() employerAddress?: string | null;
  @IsOptional() @IsString() sector?: string | null;
  @IsOptional() @IsInt() sectorRiskCode?: number | null;
  @IsOptional() @IsString() position?: string | null;
  @IsOptional() @IsString() employedSince?: string | null;
  @IsOptional() @IsString() experienceBand?: string | null;
}

export class AffordabilityInput {
  @IsOptional() @IsNumber() mainActivityIncome?: number | null;
  @IsOptional() @IsNumber() secondaryIncome?: number | null;
  @IsOptional() @IsNumber() familyIncome?: number | null;
  @IsOptional() @IsNumber() otherIncome?: number | null;
  @IsOptional() @IsNumber() utilitiesExpense?: number | null;
  @IsOptional() @IsNumber() familyExpense?: number | null;
  @IsOptional() @IsNumber() otherExpense?: number | null;
  @IsOptional() @IsNumber() existingCreditBurden?: number | null;
  @IsOptional() @IsNumber() newLoanPayment?: number | null;
}

export class InsuranceInput {
  @IsOptional() @IsBoolean() insured?: boolean;
  @IsOptional() @IsString() company?: string | null;
  @IsOptional() @IsString() genAgreementNo?: string | null;
  @IsOptional() @IsString() genAgreementDate?: string | null;
  @IsOptional() @IsString() policyNo?: string | null;
  @IsOptional() @IsString() policyIssueDate?: string | null;
  @IsOptional() @IsInt() policyTermMonths?: number | null;
  @IsOptional() @IsString() policyExpiry?: string | null;
  @IsOptional() @IsNumber() loanUnderPolicy?: number | null;
  @IsOptional() @IsNumber() insuredSum?: number | null;
  @IsOptional() @IsNumber() insuranceRate?: number | null;
  @IsOptional() @IsNumber() premium?: number | null;
}

export class TrancheInput {
  @IsOptional() @IsInt() trancheNo?: number | null;
  @IsOptional() @IsString() applicationNo?: string | null;
  @IsOptional() @IsString() applicationDate?: string | null;
  @IsOptional() @IsString() contractNo?: string | null;
  @IsOptional() @IsString() contractDate?: string | null;
  @IsOptional() @IsNumber() principal?: number | null;
  @IsOptional() @IsInt() termMonths?: number | null;
  @IsOptional() @IsString() maturity?: string | null;
  @IsOptional() @IsIn(['ANNUITY', 'DIFFERENTIATED']) scheduleType?: 'ANNUITY' | 'DIFFERENTIATED' | null;
  @IsOptional() @IsNumber() monthlyPayment?: number | null;
  @IsOptional() @IsNumber() insurancePayment?: number | null;
}

export class CreditLineInput {
  @IsOptional() @IsString() lineNumber?: string | null;
  @IsOptional() @IsIn(['MICROLOAN', 'MICROCREDIT']) loanType?: 'MICROLOAN' | 'MICROCREDIT' | null;
  @IsOptional() @IsNumber() amountAuto?: number | null;
  @IsOptional() @IsNumber() amountPolis?: number | null;
  @IsOptional() @IsNumber() amountTotal?: number | null;
  @IsOptional() @IsInt() termMonths?: number | null;
  @IsOptional() @IsString() lineDate?: string | null;
  @IsOptional() @IsString() lineMaturity?: string | null;
  @IsOptional() @IsNumber() interestRate?: number | null;
  @IsOptional() @IsNumber() penaltyRate?: number | null;
  @IsOptional() @IsString() orderNumber?: string | null;
  @IsOptional() @ValidateNested() @Type(() => InsuranceInput) insurance?: InsuranceInput | null;
  @IsOptional() @ValidateNested() @Type(() => TrancheInput) tranche?: TrancheInput | null;
}

export class CreditHistoryInput {
  @IsOptional() @IsInt() repaidLoansCount?: number | null;
  @IsOptional() @IsInt() activeLoansCount?: number | null;
  @IsOptional() @IsInt() overdueSubstandardFlag?: number | null;
  @IsOptional() @IsInt() otherObligations?: number | null;
  @IsOptional() @IsString() loansOver5MFlag?: string | null;
  @IsOptional() @IsString() priorMfiPawnshopFlag?: string | null;
  @IsOptional() @IsNumber() totalOutstandingDebt?: number | null;
  @IsOptional() @IsNumber() avgMonthlyPaymentExisting?: number | null;
  @IsOptional() @IsString() committeeProtocolRef?: string | null;
  @IsOptional() @IsString() committeeDecisionDate?: string | null;
}
```

- [ ] **Step 3: Extend `UpsertCaseDto`** — add optional nested sections:

```ts
  @IsOptional() @ValidateNested() @Type(() => EmploymentInput) employment?: EmploymentInput | null;
  @IsOptional() @ValidateNested() @Type(() => AffordabilityInput) affordability?: AffordabilityInput | null;
  @IsOptional() @ValidateNested() @Type(() => CreditLineInput) creditLine?: CreditLineInput | null;
  @IsOptional() @ValidateNested() @Type(() => CreditHistoryInput) creditHistory?: CreditHistoryInput | null;
```

- [ ] **Step 4: Add `SetRateDto` + `CaseSectionDto`** (end of file):

```ts
export class SetRateDto {
  @IsNumber() @Min(0) interestRate!: number;
}

export class CaseSectionDto {
  @IsIn(['borrower', 'employment', 'affordability', 'creditLine', 'creditHistory'])
  section!: 'borrower' | 'employment' | 'affordability' | 'creditLine' | 'creditHistory';

  @ValidateNested() @Type(() => UpsertCaseDto) data!: UpsertCaseDto;
}
```

> For the section endpoint reuse `UpsertCaseDto` partially: the wizard always sends the full current payload, so `CaseSectionDto.data` is a full `UpsertCaseDto`; the service writes only the named section. (Simpler + safe.)

Add `IsIn`, `IsBoolean` to the class-validator import line.

- [ ] **Step 5: Typecheck + commit:**

Run: `npx tsc --noEmit -p apps/backend/tsconfig.json`

```bash
git add apps/backend/src/credit-cases/dto.ts
git commit -m "feat(backend): input DTOs for the 4-tab capture sections + rate"
```

---

### Task 5: Backend case mapper (read the new relations)

**Files:**
- Modify: `apps/backend/src/credit-cases/case.mapper.ts`

- [ ] **Step 1: Extend `caseInclude`** — add:

```ts
  employment: true,
  affordability: true,
  creditHistory: true,
  creditLine: { include: { insurance: true, tranches: { orderBy: { trancheNo: 'asc' } } } },
```

- [ ] **Step 2: Add mapper helpers + wire into `toCaseDto`.** Add before `toCaseDto`:

```ts
const toEmployment = (e: CaseWithRelations['employment']) =>
  e ? { employer: e.employer, employerAddress: e.employerAddress, sector: e.sector, sectorRiskCode: e.sectorRiskCode, position: e.position, employedSince: e.employedSince, experienceBand: e.experienceBand } : null;

const toAffordability = (a: CaseWithRelations['affordability']) =>
  a ? { mainActivityIncome: num(a.mainActivityIncome), secondaryIncome: num(a.secondaryIncome), familyIncome: num(a.familyIncome), otherIncome: num(a.otherIncome), utilitiesExpense: num(a.utilitiesExpense), familyExpense: num(a.familyExpense), otherExpense: num(a.otherExpense), existingCreditBurden: num(a.existingCreditBurden), newLoanPayment: num(a.newLoanPayment) } : null;

const toCreditHistory = (h: CaseWithRelations['creditHistory']) =>
  h ? { repaidLoansCount: h.repaidLoansCount, activeLoansCount: h.activeLoansCount, overdueSubstandardFlag: h.overdueSubstandardFlag, otherObligations: h.otherObligations, loansOver5MFlag: h.loansOver5MFlag, priorMfiPawnshopFlag: h.priorMfiPawnshopFlag, totalOutstandingDebt: num(h.totalOutstandingDebt), avgMonthlyPaymentExisting: num(h.avgMonthlyPaymentExisting), committeeProtocolRef: h.committeeProtocolRef, committeeDecisionDate: iso(h.committeeDecisionDate) } : null;

function toCreditLine(l: CaseWithRelations['creditLine']) {
  if (!l) return null;
  const t = l.tranches[0] ?? null;
  return {
    lineNumber: l.lineNumber, loanType: l.loanType, amountAuto: num(l.amountAuto), amountPolis: num(l.amountPolis),
    amountTotal: num(l.amountTotal), termMonths: l.termMonths, lineDate: iso(l.lineDate), lineMaturity: iso(l.lineMaturity),
    interestRate: num(l.interestRate), penaltyRate: num(l.penaltyRate), orderNumber: l.orderNumber,
    insurance: l.insurance ? { insured: l.insurance.insured, company: l.insurance.company, genAgreementNo: l.insurance.genAgreementNo, genAgreementDate: iso(l.insurance.genAgreementDate), policyNo: l.insurance.policyNo, policyIssueDate: iso(l.insurance.policyIssueDate), policyTermMonths: l.insurance.policyTermMonths, policyExpiry: iso(l.insurance.policyExpiry), loanUnderPolicy: num(l.insurance.loanUnderPolicy), insuredSum: num(l.insurance.insuredSum), insuranceRate: num(l.insurance.insuranceRate), premium: num(l.insurance.premium) } : null,
    tranche: t ? { trancheNo: t.trancheNo, applicationNo: t.applicationNo, applicationDate: iso(t.applicationDate), contractNo: t.contractNo, contractDate: iso(t.contractDate), principal: num(t.principal), termMonths: t.termMonths, maturity: iso(t.maturity), scheduleType: t.scheduleType, monthlyPayment: num(t.monthlyPayment), insurancePayment: num(t.insurancePayment) } : null,
  };
}
```

Then in `toCaseDto` return object add:

```ts
    employment: toEmployment(c.employment),
    affordability: toAffordability(c.affordability),
    creditLine: toCreditLine(c.creditLine),
    creditHistory: toCreditHistory(c.creditHistory),
```

- [ ] **Step 3: Typecheck + commit:**

Run: `npx tsc --noEmit -p apps/backend/tsconfig.json`

```bash
git add apps/backend/src/credit-cases/case.mapper.ts
git commit -m "feat(backend): map employment/affordability/credit-line/history into CaseDto"
```

---

### Task 6: Backend service — persist the new sections (create/update)

**Files:**
- Modify: `apps/backend/src/credit-cases/credit-cases.service.ts`

**Interfaces:**
- Consumes: `EmploymentInput`, `AffordabilityInput`, `CreditLineInput`, `CreditHistoryInput`, `UpsertCaseDto` (Task 4).
- Produces: private builders `employmentData`, `affordabilityData`, `creditHistoryData`, `creditLineNested`; section-aware writes inside `createCase`/`updateCase`.

- [ ] **Step 1: Add private builders** (after `collateralCreate`):

```ts
  private creditLineNested(l: CreditLineInput) {
    const t = l.tranche ?? null;
    const ins = l.insurance ?? null;
    return {
      lineNumber: l.lineNumber ?? null, loanType: l.loanType ?? null,
      amountAuto: l.amountAuto ?? null, amountPolis: l.amountPolis ?? null, amountTotal: l.amountTotal ?? null,
      termMonths: l.termMonths ?? null, lineDate: parseDate(l.lineDate), lineMaturity: parseDate(l.lineMaturity),
      interestRate: l.interestRate ?? null, penaltyRate: l.penaltyRate ?? null, orderNumber: l.orderNumber ?? null,
      ...(ins ? { insurance: { create: { insured: ins.insured ?? false, company: ins.company ?? null, genAgreementNo: ins.genAgreementNo ?? null, genAgreementDate: parseDate(ins.genAgreementDate), policyNo: ins.policyNo ?? null, policyIssueDate: parseDate(ins.policyIssueDate), policyTermMonths: ins.policyTermMonths ?? null, policyExpiry: parseDate(ins.policyExpiry), loanUnderPolicy: ins.loanUnderPolicy ?? null, insuredSum: ins.insuredSum ?? null, insuranceRate: ins.insuranceRate ?? null, premium: ins.premium ?? null } } } : {}),
      ...(t ? { tranches: { create: [{ trancheNo: t.trancheNo ?? 1, applicationNo: t.applicationNo ?? null, applicationDate: parseDate(t.applicationDate), contractNo: t.contractNo ?? null, contractDate: parseDate(t.contractDate), principal: t.principal ?? null, termMonths: t.termMonths ?? null, maturity: parseDate(t.maturity), scheduleType: t.scheduleType ?? null, monthlyPayment: t.monthlyPayment ?? null, insurancePayment: t.insurancePayment ?? null }] } } : {}),
    };
  }
  private employmentData(e: EmploymentInput) {
    return { employer: e.employer ?? null, employerAddress: e.employerAddress ?? null, sector: e.sector ?? null, sectorRiskCode: e.sectorRiskCode ?? null, position: e.position ?? null, employedSince: e.employedSince ?? null, experienceBand: e.experienceBand ?? null };
  }
  private affordabilityData(a: AffordabilityInput) {
    return { mainActivityIncome: a.mainActivityIncome ?? null, secondaryIncome: a.secondaryIncome ?? null, familyIncome: a.familyIncome ?? null, otherIncome: a.otherIncome ?? null, utilitiesExpense: a.utilitiesExpense ?? null, familyExpense: a.familyExpense ?? null, otherExpense: a.otherExpense ?? null, existingCreditBurden: a.existingCreditBurden ?? null, newLoanPayment: a.newLoanPayment ?? null };
  }
  private creditHistoryData(h: CreditHistoryInput) {
    return { repaidLoansCount: h.repaidLoansCount ?? null, activeLoansCount: h.activeLoansCount ?? null, overdueSubstandardFlag: h.overdueSubstandardFlag ?? null, otherObligations: h.otherObligations ?? null, loansOver5MFlag: h.loansOver5MFlag ?? null, priorMfiPawnshopFlag: h.priorMfiPawnshopFlag ?? null, totalOutstandingDebt: h.totalOutstandingDebt ?? null, avgMonthlyPaymentExisting: h.avgMonthlyPaymentExisting ?? null, committeeProtocolRef: h.committeeProtocolRef ?? null, committeeDecisionDate: parseDate(h.committeeDecisionDate) };
  }
```

Import the new input types at the top: `import { ..., EmploymentInput, AffordabilityInput, CreditLineInput, CreditHistoryInput } from './dto';`

- [ ] **Step 2: Extend `createCase`** — add to the `data` object (after `collaterals`):

```ts
        ...(dto.employment ? { employment: { create: this.employmentData(dto.employment) } } : {}),
        ...(dto.affordability ? { affordability: { create: this.affordabilityData(dto.affordability) } } : {}),
        ...(dto.creditHistory ? { creditHistory: { create: this.creditHistoryData(dto.creditHistory) } } : {}),
        ...(dto.creditLine ? { creditLine: { create: this.creditLineNested(dto.creditLine) } } : {}),
```

- [ ] **Step 3: Extend `updateCase`** — add these to the `$transaction([...])` array (delete-and-recreate for the line so nested tranche/insurance reset cleanly; upsert for the one-to-ones):

```ts
      ...(dto.employment ? [this.prisma.employment.upsert({ where: { caseId: id }, create: { caseId: id, ...this.employmentData(dto.employment) }, update: this.employmentData(dto.employment) })] : []),
      ...(dto.affordability ? [this.prisma.affordability.upsert({ where: { caseId: id }, create: { caseId: id, ...this.affordabilityData(dto.affordability) }, update: this.affordabilityData(dto.affordability) })] : []),
      ...(dto.creditHistory ? [this.prisma.creditHistory.upsert({ where: { caseId: id }, create: { caseId: id, ...this.creditHistoryData(dto.creditHistory) }, update: this.creditHistoryData(dto.creditHistory) })] : []),
      ...(dto.creditLine ? [this.prisma.creditLine.deleteMany({ where: { caseId: id } }), this.prisma.creditLine.create({ data: { caseId: id, ...this.creditLineNested(dto.creditLine) } })] : []),
```

> `creditLine.deleteMany` then `create` cascades to its `insurance` + `tranches` (FK `onDelete: Cascade`), keeping the nested write simple and idempotent.

- [ ] **Step 4: Typecheck + commit:**

Run: `npx tsc --noEmit -p apps/backend/tsconfig.json`

```bash
git add apps/backend/src/credit-cases/credit-cases.service.ts
git commit -m "feat(backend): persist employment/affordability/credit-line/history on create+update"
```

---

### Task 7: Backend section-autosave + moderator rate endpoints

**Files:**
- Modify: `apps/backend/src/credit-cases/credit-cases.service.ts`
- Modify: `apps/backend/src/credit-cases/credit-cases.controller.ts`

**Interfaces:**
- Produces: `saveSection(id, user, dto: CaseSectionDto)`, `setRate(id, user, interestRate)`; routes `PATCH /cases/:id/section`, `PATCH /cases/:id/rate`.

- [ ] **Step 1: Add `saveSection` to the service.** It reuses `updateCase` but writes only the named section by zeroing the others:

```ts
  async saveSection(id: string, user: RequestUser, dto: CaseSectionDto) {
    // Reuse the DRAFT-only + ownership guards by delegating to updateCase with a
    // payload masked to the single section (other sections undefined → untouched).
    const base = dto.data;
    const masked: UpsertCaseDto = {
      amount: base.amount, termMonths: base.termMonths,
      borrower: base.borrower, guarantors: base.guarantors, collaterals: base.collaterals,
      employment: dto.section === 'employment' ? base.employment : undefined,
      affordability: dto.section === 'affordability' ? base.affordability : undefined,
      creditLine: dto.section === 'creditLine' ? base.creditLine : undefined,
      creditHistory: dto.section === 'creditHistory' ? base.creditHistory : undefined,
    };
    return this.updateCase(id, user, masked);
  }
```

> `borrower`/`collaterals` are always present in the payload (required by `updateCase`), so the 'borrower' section saves through the same path; the section flag only gates the optional relations.

- [ ] **Step 2: Add `setRate` to the service** (bound-checked, moderator/admin, MODERATION):

```ts
  async setRate(id: string, user: RequestUser, interestRate: number) {
    if (user.role !== Role.MODERATOR && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Foizni faqat moderator yoki admin o‘zgartiradi');
    }
    const c = await this.prisma.creditCase.findUnique({ where: { id }, include: { creditLine: true } });
    if (!c) throw new NotFoundException('Ariza topilmadi');
    if (c.status !== CaseStatus.MODERATION) throw new ForbiddenException('Faqat moderatsiya bosqichida foizni o‘zgartirish mumkin');
    const cfg = await this.prisma.appConfig.findUnique({ where: { id: 'default' } });
    const min = cfg?.minRate ?? 0.55;
    const max = cfg?.maxRate ?? 0.6;
    if (interestRate < min || interestRate > max) {
      throw new ForbiddenException(`Foiz ${Math.round(min * 100)}% va ${Math.round(max * 100)}% oralig‘ida bo‘lishi kerak`);
    }
    if (!c.creditLine) throw new NotFoundException('Kredit liniyasi to‘ldirilmagan');
    await this.prisma.creditLine.update({ where: { caseId: id }, data: { interestRate } });
    return this.getOne(id);
  }
```

- [ ] **Step 3: Add controller routes** in `credit-cases.controller.ts` (mirror the existing `@Put(':id/katm-price')`):

```ts
  @Patch(':id/section')
  saveSection(@Param('id') id: string, @CurrentUser() user: RequestUser, @Body() dto: CaseSectionDto) {
    return this.service.saveSection(id, user, dto);
  }

  @Patch(':id/rate')
  setRate(@Param('id') id: string, @CurrentUser() user: RequestUser, @Body() dto: SetRateDto) {
    return this.service.setRate(id, user, dto.interestRate);
  }
```

Add `Patch` to the `@nestjs/common` import and `CaseSectionDto, SetRateDto` to the dto import.

- [ ] **Step 4: Add a backend test** `apps/backend/src/credit-cases/rate.spec.ts` (pure bound logic — no DB; extract the bound check or test via a thin pure function). Minimal pure guard test:

```ts
import { isRateInBounds } from './rate.util';
describe('rate bounds', () => {
  it('accepts within [min,max]', () => { expect(isRateInBounds(0.55, 0.55, 0.6)).toBe(true); expect(isRateInBounds(0.6, 0.55, 0.6)).toBe(true); });
  it('rejects below/above', () => { expect(isRateInBounds(0.54, 0.55, 0.6)).toBe(false); expect(isRateInBounds(0.61, 0.55, 0.6)).toBe(false); });
});
```

Create `apps/backend/src/credit-cases/rate.util.ts`:

```ts
export const isRateInBounds = (rate: number, min: number, max: number): boolean => rate >= min && rate <= max;
```

Then use `isRateInBounds(interestRate, min, max)` inside `setRate` instead of the inline comparison.

- [ ] **Step 5: Run tests + typecheck:**

Run: `npm test -w @credit-core/backend -- rate.spec` (Expected: PASS)
Run: `npx tsc --noEmit -p apps/backend/tsconfig.json`

- [ ] **Step 6: Commit:**

```bash
git add apps/backend/src/credit-cases
git commit -m "feat(backend): per-section autosave + moderator rate-raise endpoints"
```

---

### Task 8: api-client methods

**Files:**
- Modify: `packages/api-client/src/index.ts`

**Interfaces:**
- Consumes: `CaseSectionPayload`, `SetRatePayload`, extended `UpsertCasePayload`, `AppConfigDto`.
- Produces: `api.saveCaseSection(id, payload)`, `api.setCaseRate(id, interestRate)`.

- [ ] **Step 1: Add methods** after `updateCase`:

```ts
  async saveCaseSection(id: string, payload: CaseSectionPayload): Promise<CreditCaseDto> {
    const { data } = await http.patch<CreditCaseDto>(`/cases/${id}/section`, payload);
    return data;
  },
  async setCaseRate(id: string, interestRate: number): Promise<CreditCaseDto> {
    const { data } = await http.patch<CreditCaseDto>(`/cases/${id}/rate`, { interestRate });
    return data;
  },
```

Add `CaseSectionPayload` to the `@credit-core/shared` import. (`createCase`/`updateCase` need no signature change — the extended `UpsertCasePayload` flows through.)

- [ ] **Step 2: Typecheck + commit:**

Run: `npx tsc --noEmit -p packages/api-client/tsconfig.json`

```bash
git add packages/api-client/src/index.ts
git commit -m "feat(api-client): saveCaseSection + setCaseRate"
```

---

### Task 9: UI — origination form hook + live summary calc

**Files:**
- Create: `packages/ui/src/pages/origination/useOriginationForm.ts`
- Create: `packages/ui/src/pages/origination/Summary.tsx`

**Interfaces:**
- Produces: `useOriginationForm(id?)` → `{ form, setSection, save, saving, valid, errors, step, setStep, ... }`; `<Summary form={...} />`.

- [ ] **Step 1: Create `useOriginationForm.ts`.** Model it on `useCaseForm` (same load/save shape) but holding the full extended `UpsertCasePayload`. Key pieces:

```ts
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@credit-core/api-client';
import { ProductType, RepaymentMethod, loanTypeFor, isTermValid, type UpsertCasePayload, type CaseSectionKey } from '@credit-core/shared';

const emptyBorrower = { fullName: '', passportSeries: null, passportNumber: null, pinfl: null, birthDate: null, address: null, phone: null };
const emptyForm: UpsertCasePayload = {
  amount: null, termMonths: null, borrower: { ...emptyBorrower }, guarantors: [],
  collaterals: [{ type: ProductType.REAL_ESTATE, agreedValue: null, agreedValueWords: null, owners: [] }],
  employment: null, affordability: null, creditLine: null, creditHistory: null,
};

export function useOriginationForm(id?: string) {
  const qc = useQueryClient();
  const [form, setForm] = useState<UpsertCasePayload>(emptyForm);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [attempted, setAttempted] = useState(false);

  useQuery({ queryKey: ['case', id], enabled: !!id, queryFn: async () => {
    const c = await api.case(id!);
    setForm({ amount: c.amount, termMonths: c.termMonths, borrower: c.borrower ?? { ...emptyBorrower }, guarantors: c.guarantors, collaterals: c.collaterals.length ? c.collaterals : emptyForm.collaterals, employment: c.employment, affordability: c.affordability, creditLine: c.creditLine, creditHistory: c.creditHistory });
    return c;
  } });

  const patch = (p: Partial<UpsertCasePayload>) => setForm((f) => ({ ...f, ...p }));
  const setBorrower = (b: Partial<UpsertCasePayload['borrower']>) => setForm((f) => ({ ...f, borrower: { ...f.borrower, ...b } }));

  const termCapOk = () => {
    const m = form.creditLine?.tranche?.scheduleType as RepaymentMethod | undefined;
    const t = form.creditLine?.tranche?.termMonths;
    return !m || !t || isTermValid(m, t);
  };
  const errors = {
    fullName: form.borrower.fullName.trim() ? undefined : 'F.I.O majburiy',
    termCap: termCapOk() ? undefined : 'Bu jadval turi uchun muddat oshib ketgan',
  };
  const valid = !errors.fullName && !!form.collaterals.length && !errors.termCap;

  // Persist one section (autosave). Creates the case first if it doesn't exist yet.
  const saveSection = async (section: CaseSectionKey) => {
    setSaving(true);
    try {
      let cid = id;
      if (!cid) { const created = await api.createCase(form); cid = created.id; }
      const saved = await api.saveCaseSection(cid!, { section, data: form });
      qc.invalidateQueries({ queryKey: ['case', cid] });
      qc.invalidateQueries({ queryKey: ['cases'] });
      return saved;
    } finally { setSaving(false); }
  };

  const save = async () => {
    if (!valid) { setAttempted(true); return undefined; }
    setSaving(true);
    try {
      const saved = id ? await api.updateCase(id, form) : await api.createCase(form);
      qc.invalidateQueries({ queryKey: ['cases'] });
      qc.invalidateQueries({ queryKey: ['case', saved.id] });
      return saved;
    } finally { setSaving(false); }
  };

  return { form, setForm, patch, setBorrower, step, setStep, saving, attempted, errors, valid, saveSection, save, loanType: loanTypeFor(form.creditLine?.amountTotal ?? form.amount) };
}
```

- [ ] **Step 2: Create `Summary.tsx`** — the sticky live panel:

```tsx
import { originationCalc, loanTypeFor, type UpsertCasePayload } from '@credit-core/shared';
import { Card } from '../../components/primitives';
import { formatMoney } from '../../lib/cn';

export function Summary({ form }: { form: UpsertCasePayload }) {
  const a = form.affordability ?? {};
  const ins = form.creditLine?.insurance ?? {};
  const collateralTotal = form.collaterals.reduce((s, c) => s + (c.agreedValue ?? 0), 0);
  const calc = originationCalc({
    ...a,
    newLoanPayment: form.creditLine?.tranche?.monthlyPayment,
    loanUnderPolicy: ins.loanUnderPolicy, insuranceRate: ins.insuranceRate, policyTermMonths: ins.policyTermMonths,
    amountTotal: form.creditLine?.amountTotal ?? form.amount, collateralTotal,
  });
  const loanType = loanTypeFor(form.creditLine?.amountTotal ?? form.amount);
  const row = (label: string, value: string, danger = false) => (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className={`nums font-semibold ${danger ? 'text-error-600 dark:text-error-500' : 'text-gray-800 dark:text-white'}`}>{value}</span>
    </div>
  );
  return (
    <Card className="sticky top-4 space-y-1">
      <h3 className="font-semibold text-gray-800 dark:text-white">Xulosa</h3>
      {row('Kredit turi', loanType === 'MICROCREDIT' ? 'Mikrokredit' : 'Mikroqarz')}
      {row('Jami daromad', formatMoney(calc.totalIncome))}
      {row('Jami xarajat', formatMoney(calc.totalExpenses))}
      {row('DTI', `${(calc.dtiRatio * 100).toFixed(1)}%`)}
      {row('Surplus', formatMoney(calc.surplus), calc.surplus < 0)}
      {row('Min kerakli daromad (2.2×)', formatMoney(calc.minRequiredIncome))}
      {row('Sug‘urta puli', formatMoney(calc.premium))}
      {row('Garov qoplami', form.creditLine?.amountTotal || form.amount ? `${(calc.coverageRatio * 100).toFixed(0)}%` : '—')}
      {!calc.affordabilityOk && (
        <p className="mt-2 rounded-lg bg-error-50 px-3 py-2 text-xs font-medium text-error-700 dark:bg-error-600/10 dark:text-error-400">
          Daromad yetarli emas (surplus manfiy yoki 2.2× dan past) — ko‘rib chiqing.
        </p>
      )}
    </Card>
  );
}
```

- [ ] **Step 3: Typecheck + commit:**

Run: `npx tsc --noEmit -p packages/ui/tsconfig.json`

```bash
git add packages/ui/src/pages/origination/
git commit -m "feat(ui): origination form hook + live affordability summary"
```

---

### Task 10: UI — wizard shell + step panels

**Files:**
- Create: `packages/ui/src/pages/origination/OriginationWizard.tsx`
- Create: `packages/ui/src/pages/origination/steps.tsx`

The wizard renders a 5-dot stepper (reuse the Settings step-rail visual language), the active step panel, the `<Summary>` aside, and Back/Next/Save controls. Step 3 reuses the existing `CollateralCard` (imported from `../CaseForm`). Each step's "Next" calls `saveSection(...)` for autosave.

- [ ] **Step 1: Field inventory per step** (each `<Field>` binds to `form` via `setBorrower`/`patch`; use existing primitives `Input`, `MoneyInput`, `DatePicker`, `Select`, `PhoneInput`):

**Step 1 — Qarz oluvchi** (binds `form.borrower`): fullName*, pinfl, passportSeries, passportNumber, gender(Select MALE/FEMALE), citizenship, placeOfBirth, birthDate(DatePicker), previousName, inn, passportIssuer, passportIssueDate(DatePicker), passportExpiry(DatePicker), phone, regAddress, regLandmark, regTenure(Select собственность/аренда/служебная/другое), regMatchesActual(toggle), actualAddress, actualLandmark, maritalStatus(Select турмуш курган/ажрашган/бўйдоқ/бева), familySize(number), childrenCount(number), education(Select олий/урта махсус/урта), residenceDuration(Select), ownsHome(Select), depositsBand(Select).

**Step 2 — Ish & daromad** (binds `form.employment` + `form.affordability`): employer, employerAddress, sector(Select from `SECTOR_RISK` labels → on change also set `sectorRiskCode = sectorRiskCode(label)`), position, employedSince, experienceBand(Select до 3 лет/3-5/5-9/10+) · income: mainActivityIncome(MoneyInput), secondaryIncome, familyIncome, otherIncome · expense: utilitiesExpense, familyExpense, otherExpense, existingCreditBurden(MoneyInput, hint "KATM o‘rtacha to‘lov").

**Step 3 — Liniya & garov & sug‘urta** (binds `form.creditLine` + collaterals + `form.creditLine.insurance`): line: lineNumber, amountAuto(MoneyInput), amountPolis(MoneyInput), amountTotal(MoneyInput, auto = auto+polis), termMonths(number), lineDate(DatePicker), interestRate(read-only %, = config.minRate), penaltyRate(read-only 105%), orderNumber · **collateral**: render the existing `CollateralCard` list (reuse add/remove/owners/docs handlers — lift from `useCaseForm` or re-implement minimal add/remove on `form.collaterals`) · insurance: insured(toggle); when on → company, policyNo, policyIssueDate, policyTermMonths(number), loanUnderPolicy(MoneyInput), insuranceRate(% number) with insuredSum + premium shown read-only from `originationCalc`.

**Step 4 — Transh** (binds `form.creditLine.tranche`): trancheNo(number, default 1), applicationNo, applicationDate(DatePicker), principal(MoneyInput), scheduleType(Select Annuitet/Differensial), termMonths(number, validated by cap — show `errors.termCap`), monthlyPayment(MoneyInput), insurancePayment(MoneyInput).

**Step 5 — KATM** (binds `form.creditHistory`): repaidLoansCount(number), activeLoansCount(number), overdueSubstandardFlag(number 0/1), otherObligations(number), loansOver5MFlag(Select Мавжуд/Мавжуд эмас), priorMfiPawnshopFlag(Select), totalOutstandingDebt(MoneyInput), avgMonthlyPaymentExisting(MoneyInput), committeeProtocolRef, committeeDecisionDate(DatePicker).

- [ ] **Step 2: Implement `steps.tsx`** exporting `Step1..Step5` components, each `({ f }: { f: ReturnType<typeof useOriginationForm> }) => JSX`. Use the `<Card><h2>…</h2><div className="grid gap-4 sm:grid-cols-2">…</div></Card>` pattern from `CaseFormFields`. For each section, write a small setter, e.g.:

```tsx
const setEmp = (p: Partial<NonNullable<UpsertCasePayload['employment']>>) =>
  f.patch({ employment: { ...(f.form.employment ?? {} as any), ...p } });
const setAff = (p: Partial<NonNullable<UpsertCasePayload['affordability']>>) =>
  f.patch({ affordability: { ...(f.form.affordability ?? {} as any), ...p } });
const setLine = (p: Partial<NonNullable<UpsertCasePayload['creditLine']>>) =>
  f.patch({ creditLine: { ...(f.form.creditLine ?? {} as any), ...p } });
const setTranche = (p: any) => setLine({ tranche: { ...(f.form.creditLine?.tranche ?? {}), ...p } });
const setIns = (p: any) => setLine({ insurance: { ...(f.form.creditLine?.insurance ?? {}), ...p } });
const setHist = (p: Partial<NonNullable<UpsertCasePayload['creditHistory']>>) =>
  f.patch({ creditHistory: { ...(f.form.creditHistory ?? {} as any), ...p } });
```

Sector select onChange: `setEmp({ sector: v, sectorRiskCode: sectorRiskCode(v) })`.

- [ ] **Step 3: Implement `OriginationWizard.tsx`:**

```tsx
import { useOriginationForm } from './useOriginationForm';
import { Step1, Step2, Step3, Step4, Step5 } from './steps';
import { Summary } from './Summary';
import { Button } from '../../components/primitives';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '../../components/Toast';
import type { CaseSectionKey } from '@credit-core/shared';

const STEPS: { title: string; section: CaseSectionKey; Comp: any }[] = [
  { title: 'Qarz oluvchi', section: 'borrower', Comp: Step1 },
  { title: 'Ish & daromad', section: 'employment', Comp: Step2 },
  { title: 'Liniya & garov', section: 'creditLine', Comp: Step3 },
  { title: 'Transh', section: 'creditLine', Comp: Step4 },
  { title: 'KATM', section: 'creditHistory', Comp: Step5 },
];

export function OriginationWizard() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const f = useOriginationForm(id);
  const { Comp } = STEPS[f.step];

  const next = async () => { await f.saveSection(STEPS[f.step].section); if (f.step < STEPS.length - 1) f.setStep(f.step + 1); };
  const finish = async () => { const s = await f.save(); if (!s) { toast.error('Tekshiring', 'Majburiy maydonlar'); return; } toast.success('Saqlandi', s.number); nav(`/cases/${s.id}`); };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <ol className="flex flex-wrap gap-2">
          {STEPS.map((s, i) => (
            <li key={i}>
              <button onClick={() => f.setStep(i)} className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium ${i === f.step ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-400' : 'border-gray-200 text-gray-600 dark:border-gray-800 dark:text-gray-300'}`}>
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${i === f.step ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>{i + 1}</span>{s.title}
              </button>
            </li>
          ))}
        </ol>
        <Comp f={f} />
        <div className="flex items-center justify-between">
          <Button variant="secondary" disabled={f.step === 0} onClick={() => f.setStep(f.step - 1)}>Orqaga</Button>
          {f.step < STEPS.length - 1
            ? <Button onClick={next} loading={f.saving}>Saqlash va davom</Button>
            : <Button onClick={finish} loading={f.saving}>Yakunlash</Button>}
        </div>
      </div>
      <aside><Summary form={f.form} /></aside>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck + commit:**

Run: `npx tsc --noEmit -p packages/ui/tsconfig.json`

```bash
git add packages/ui/src/pages/origination/
git commit -m "feat(ui): 5-step origination wizard (shell + steps)"
```

---

### Task 11: Routing + entry points + CaseView integration

**Files:**
- Modify: the router (find with `grep -rl "cases/:id/edit" packages/ui/src`)
- Modify: `packages/ui/src/pages/CaseView.tsx` (replace `KatmInputs`, surface captured data read-only)
- Modify: `packages/ui/src/pages/Dashboard.tsx` (point "Yangi ariza" to the wizard) — optional if NewCaseModal kept

- [ ] **Step 1: Add a route** for the wizard, e.g. `/<cases>/new` and `/cases/:id/origination`:

```tsx
<Route path="cases/new" element={<OriginationWizard />} />
<Route path="cases/:id/origination" element={<OriginationWizard />} />
```

Import `OriginationWizard` from `./pages/origination/OriginationWizard`.

- [ ] **Step 2: Point case creation at the wizard.** In `Dashboard.tsx`, change `openNew` to `nav('/cases/new')` (keep `NewCaseModal` for now or remove its usage). Minimal: replace the modal trigger with navigation.

- [ ] **Step 3: Replace `KatmInputs`** in `CaseView.tsx:313` with a read-only render of `case.creditHistory` (+ an "Tahrirlash" link to `/cases/:id/origination` step 5 for operator/DRAFT). Surface `case.employment`, `case.affordability`, `case.creditLine` as read-only cards for moderator/director/admin (small labeled `dl` lists). Add a **moderator rate control** when `case.status === MODERATION` and `role === MODERATOR`: a number input (whole %) calling `api.setCaseRate(id, pct/100)` within `[minRate*100, maxRate*100]`.

- [ ] **Step 4: Typecheck + build:**

Run: `npx tsc --noEmit -p packages/ui/tsconfig.json`
Run: `npm run build -w @credit-core/web-operator`
Expected: build succeeds.

- [ ] **Step 5: Commit:**

```bash
git add packages/ui/src
git commit -m "feat(ui): wizard routing + CaseView capture data + moderator rate control"
```

---

### Task 12: Settings — min/max lending rate inputs

**Files:**
- Modify: `packages/ui/src/pages/SettingsPage.tsx`

- [ ] **Step 1: Extend the config state** `conf` with `minRate`, `maxRate` (whole-number %): in the `setConf` init add `minRate: Math.round(appCfg.minRate*100)`, `maxRate: Math.round(appCfg.maxRate*100)`; in `saveConfig` send `minRate: conf.minRate/100, maxRate: conf.maxRate/100`.

- [ ] **Step 2: Add two `<Field>` inputs** to the financial-config grid:

```tsx
<Field label="Min yillik foiz (%)" hint="standart 55"><Input type="number" min={0} max={500} value={conf.minRate} onChange={(e) => setConf({ ...conf, minRate: Number(e.target.value) })} className="nums" /></Field>
<Field label="Max yillik foiz (%)" hint="moderator shu gacha ko‘taradi"><Input type="number" min={0} max={500} value={conf.maxRate} onChange={(e) => setConf({ ...conf, maxRate: Number(e.target.value) })} className="nums" /></Field>
```

- [ ] **Step 3: Typecheck + build + commit:**

Run: `npx tsc --noEmit -p packages/ui/tsconfig.json && npm run build -w @credit-core/web-operator`

```bash
git add packages/ui/src/pages/SettingsPage.tsx
git commit -m "feat(ui): admin min/max lending-rate settings"
```

---

### Task 13: Full verification + push

- [ ] **Step 1: Run the backend test suite:**

Run: `npm test -w @credit-core/backend`
Expected: all green (existing + new `origination.spec`, `rate.spec`).

- [ ] **Step 2: Typecheck every package:**

Run: `npx tsc --noEmit -p packages/shared/tsconfig.json && npx tsc --noEmit -p packages/api-client/tsconfig.json && npx tsc --noEmit -p apps/backend/tsconfig.json && npx tsc --noEmit -p packages/ui/tsconfig.json`

- [ ] **Step 3: Build the web app:**

Run: `npm run build -w @credit-core/web-operator`
Expected: success.

- [ ] **Step 4: Push** the feature branch + fast-forward master (per the repo's clean-FF workflow):

```bash
git push origin feat/ux-messaging-improvements
git checkout master && git merge --ff-only feat/ux-messaging-improvements && git push origin master && git checkout feat/ux-messaging-improvements
```

---

## Self-Review

- **Spec coverage:** wizard 5 steps (Task 10) ✓; step→model mapping (Tasks 5/6) ✓; business rules type/term/rate (Tasks 1/3/6/7/11/12) ✓; auto-calc summary (Tasks 1/9) ✓; DTO/backend/api-client/mapper (Tasks 2/4/5/6/8) ✓; validation/roles (Tasks 6/7/10/11) ✓; Settings (Task 12) ✓; testing (Tasks 1/7/13) ✓. Phase 2 (docs + 4 notary) intentionally out of this plan.
- **Placeholder scan:** none — every step has concrete code/field lists.
- **Type consistency:** `originationCalc`/`OriginationCalcInput` (Task 1) match the `Summary` call (Task 9); DTO names (Task 2) match backend inputs (Task 4) and mapper output (Task 5); `saveCaseSection`/`setCaseRate` (Task 8) match endpoints (Task 7) and hook usage (Tasks 9/11).

> Phase 2 follow-on (separate spec+plan once the 4 notary docs are named): finish the general SP-6 documents and add the 4 notary documents.
