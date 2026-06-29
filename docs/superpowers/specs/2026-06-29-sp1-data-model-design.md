# SP-1 — Data-Model Extension (Prisma schema) — Design Spec

> Sub-project 1 of the CLEVER Mikromoliya workbook program. Foundation for import (SP-3),
> scoring (SP-5), schedule (SP-4) and later document/Excel generation (SP-6/SP-7).
> Companion reference: [`docs/analysis/2026-06-29-mko-workbook-analysis.md`](../../analysis/2026-06-29-mko-workbook-analysis.md)
> (data dictionary §2, scoring §3, gap analysis §7).

## 1. Goal

Extend the credit-core Prisma schema (`apps/backend/prisma/schema.prisma`, MySQL) so it can hold
**all data a filled MKO workbook contains** that import + scoring + payment-schedule need. Additive
only — the existing workflow (`CreditCase` status machine, SLA timers, chat, documents) is untouched.

## 2. Scope

**In scope (this spec):** Organization config; Borrower/Collateral/CollateralOwner field
extensions; new models CreditLine, Tranche, PaymentSchedule, Installment, InsurancePolicy,
Employment, Affordability, CreditHistory, ScoringResult, ScoringFactor, IncomeCertificate,
SalaryMonth; new enums; one migration.

**Out of scope (later sub-projects):** MonitoringAct, ClaimLetter (post-finalization servicing/
collections — added with their own sub-project); the parsing logic (SP-3); scoring/schedule
computation (SP-4/SP-5); any UI.

> IncomeCertificate/SalaryMonth were pulled into SP-1 (decision 2026-06-29) so SP-6 can generate the
> Справка income-certificate document; MonitoringAct/ClaimLetter stay deferred.

## 3. Design decisions

1. **CreditCase stays the central dossier + workflow.** New per-case 1:1 satellites attach to it.
   `CreditCase.amount`/`termMonths` remain the *headline* values used by list/SLA views; the
   authoritative РКЛ figures live in `CreditLine`, per-drawdown figures in `Tranche`.
2. **Line vs tranche are separate models.** One case opens one `CreditLine` (РКЛ); a line has many
   `Tranche`s; each tranche has one `PaymentSchedule` with many `Installment`s.
3. **"Прописью" (amount/term in words) is NOT stored** — generated at render time (SP-2). Existing
   `Collateral.agreedValueWords`/`ValuationAct.agreedValueWords` stay as-is (already in schema).
4. **Snapshots, not live formulas:** `Affordability` and `ScoringResult` persist computed values for
   audit + regeneration. `ScoringFactor[]` is a queryable child table (the 20-factor breakdown).
5. **Small multi-values as JSON:** borrower phones (≤5, each with an owner tag) → `Json`.
6. **InsurancePolicy** is optional 1:1 on `CreditLine` (gated by the `да/нет` toggle).
7. **Rates** are per-case on `CreditLine` (`interestRate` 0.55, `penaltyRate` 1.05) as
   `Decimal(6,4)` fractions; `AppConfig` keeps org-wide defaults.
8. **Enums** for the values the code branches on (gender, loan type, repayment method, scoring
   verdict). Free-text option lists (marital status, education, tenure bands) stay `String?` —
   they are display/scoring-lookup values mapped at import, not control flow.

## 4. New enums

```prisma
enum Gender {
  MALE      // Эркак
  FEMALE    // Аёл
}

enum LoanType {
  MICROLOAN    // микроқарз  (≤ 100,000,000 UZS)
  MICROCREDIT  // микрокредит (> 100,000,000 UZS)
}

enum RepaymentMethod {
  ANNUITY          // аннуитетный
  DIFFERENTIATED   // дифференцированный
}

enum ScoringVerdict {
  APPROVED               // ≥ 70 and all gates pass
  REFER_COMMITTEE        // 60–69, or a gate forces manual review
  BELOW_MIN              // < 60
  FAILED_INCOME          // netAfterDebt < 0
  FAILED_PROBLEM_LOANS   // problem-loans / obligations gate
}
```

## 5. New models

```prisma
/// Singleton lender/MKO master data (id is always "default"). Source of requisites for all docs.
model Organization {
  id            String    @id @default("default")
  nameMixed     String    // МЧЖ «CLEVER Mikromoliya Tashkiloti»
  nameUpper     String    // UPPERCASE form used in clauses
  nameSuffix    String    // name-then-suffix form
  directorShort String    // Б.Исмоилов
  directorFull  String    // Исмоилов Баҳромжон Ахрор ўғли
  legalBasis    String    @default("Низом")
  address       String    @db.Text
  bankAccount   String    // р/с
  bankMfo       String    // МФО/BIC
  bankName      String
  inn           String
  licenseNo     String
  licenseDate   DateTime?
  updatedAt     DateTime  @updatedAt
}

/// РКЛ — revolving credit line master (one per case).
model CreditLine {
  id           String     @id @default(cuid())
  case         CreditCase @relation(fields: [caseId], references: [id], onDelete: Cascade)
  caseId       String     @unique
  lineNumber   String?    // № 1199 TR
  loanType     LoanType?
  amountAuto   Decimal?   @db.Decimal(18, 2) // auto/realty-backed portion
  amountPolis  Decimal?   @db.Decimal(18, 2) // insurance-backed portion
  amountTotal  Decimal?   @db.Decimal(18, 2) // = amountAuto + amountPolis
  termMonths   Int?
  lineDate     DateTime?
  lineMaturity DateTime?
  interestRate Decimal?   @db.Decimal(6, 4)  // 0.55 = 55%
  penaltyRate  Decimal?   @db.Decimal(6, 4)  // 1.05 = 105%
  orderNumber  String?    // 1881 MFL 1199 TR
  tranches     Tranche[]
  insurance    InsurancePolicy?
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
}

/// Individual drawdown under a credit line (микрозайм / микрокредит sub-contract).
model Tranche {
  id               String          @id @default(cuid())
  creditLine       CreditLine      @relation(fields: [creditLineId], references: [id], onDelete: Cascade)
  creditLineId     String
  trancheNo        Int             // 1..5
  applicationNo    String?
  applicationDate  DateTime?
  contractNo       String?
  contractDate     DateTime?
  principal        Decimal?        @db.Decimal(18, 2)
  termMonths       Int?            // may differ from line term
  maturity         DateTime?
  scheduleType     RepaymentMethod?
  monthlyPayment   Decimal?        @db.Decimal(18, 2)
  insurancePayment Decimal?        @db.Decimal(18, 2)
  schedule         PaymentSchedule?
  createdAt        DateTime        @default(now())

  @@index([creditLineId])
}

/// Amortization plan for one tranche (Annex 1). Rows generated by SP-4.
model PaymentSchedule {
  id               String        @id @default(cuid())
  tranche          Tranche       @relation(fields: [trancheId], references: [id], onDelete: Cascade)
  trancheId        String        @unique
  method           RepaymentMethod
  principal        Decimal       @db.Decimal(18, 2)
  termMonths       Int
  annualRate       Decimal       @db.Decimal(6, 4)
  disbursementDate DateTime      // day 0
  paymentDayCap    Int           @default(25) // 25 normally; 15 for the 6-month variant
  generatedAt      DateTime      @default(now())
  installments     Installment[]
}

model Installment {
  id             String          @id @default(cuid())
  schedule       PaymentSchedule @relation(fields: [scheduleId], references: [id], onDelete: Cascade)
  scheduleId     String
  seq            Int             // 1..termMonths
  dueDate        DateTime
  openingBalance Decimal         @db.Decimal(18, 2)
  principal      Decimal         @db.Decimal(18, 2)
  interest       Decimal         @db.Decimal(18, 2)
  total          Decimal         @db.Decimal(18, 2) // CEILING(principal+interest, 1000)
  days           Int             // actual days in this period (actual/365)

  @@index([scheduleId])
}

/// Optional insurance policy backing the line (Д2 insurance block).
model InsurancePolicy {
  id               String     @id @default(cuid())
  creditLine       CreditLine @relation(fields: [creditLineId], references: [id], onDelete: Cascade)
  creditLineId     String     @unique
  insured          Boolean    @default(false)
  company          String?    // АО "TRUST INSURANCE"
  genAgreementNo   String?
  genAgreementDate DateTime?
  policyNo         String?
  policyIssueDate  DateTime?
  policyTermMonths Int?
  policyExpiry     DateTime?
  loanUnderPolicy  Decimal?   @db.Decimal(18, 2)
  insuredSum       Decimal?   @db.Decimal(18, 2) // = loanUnderPolicy * 1.3
  insuranceRate    Decimal?   @db.Decimal(6, 4)  // 0.02 = 2%
  premium          Decimal?   @db.Decimal(18, 2)
}

/// Borrower employment (Д1 employment block). Scoring inputs: sector/sectorRiskCode, position, experience.
model Employment {
  id              String     @id @default(cuid())
  case            CreditCase @relation(fields: [caseId], references: [id], onDelete: Cascade)
  caseId          String     @unique
  employer        String?
  employerAddress String?    @db.Text
  sector          String?    // one of 17 industry sectors
  sectorRiskCode  Int?       // 1..17 (VLOOKUP result; scoring factor 9)
  position        String?
  employedSince   String?
  experienceBand  String?
}

/// Income/expense affordability snapshot (Д1 rows 44–49, b3 DTI). Computed once, persisted.
model Affordability {
  id                   String     @id @default(cuid())
  case                 CreditCase @relation(fields: [caseId], references: [id], onDelete: Cascade)
  caseId               String     @unique
  avgMonthlyIncome     Decimal?   @db.Decimal(18, 2) // ROUNDUP((existingBurden+deposits)*2.2,-3)
  mainActivityIncome   Decimal?   @db.Decimal(18, 2)
  secondaryIncome      Decimal?   @db.Decimal(18, 2)
  familyIncome         Decimal?   @db.Decimal(18, 2)
  otherIncome          Decimal?   @db.Decimal(18, 2)
  newLoanPayment       Decimal?   @db.Decimal(18, 2)
  utilitiesExpense     Decimal?   @db.Decimal(18, 2) // 1% of income
  familyExpense        Decimal?   @db.Decimal(18, 2) // 1.5% of income
  existingCreditBurden Decimal?   @db.Decimal(18, 2) // from CreditHistory.avgMonthlyPaymentExisting
  otherExpense         Decimal?   @db.Decimal(18, 2) // 0.5% of income
  totalIncome          Decimal?   @db.Decimal(18, 2)
  totalCreditPayments  Decimal?   @db.Decimal(18, 2)
  totalExpenses        Decimal?   @db.Decimal(18, 2)
  dtiRatio             Float?     // debt-burden ratio
  surplus              Decimal?   @db.Decimal(18, 2)
  netAfterDebt         Decimal?   @db.Decimal(18, 2)
  computedAt           DateTime   @default(now())
}

/// Credit-bureau (АСОКИ/KATM) snapshot (Sheet b4). Several scoring factors + gates read this.
model CreditHistory {
  id                        String     @id @default(cuid())
  case                      CreditCase @relation(fields: [caseId], references: [id], onDelete: Cascade)
  caseId                    String     @unique
  repaidLoansCount          Int?
  activeLoansCount          Int?
  overdueSubstandardFlag    Int?       // problem-loans gate
  otherObligations          Int?       // guarantees/pledges (factor 15)
  loansOver5MFlag           String?    // factor 17 input
  priorMfiPawnshopFlag      String?    // factor 18 input
  totalOutstandingDebt      Decimal?   @db.Decimal(18, 2)
  avgMonthlyPaymentExisting Decimal?   @db.Decimal(18, 2)
  committeeProtocolRef      String?
  committeeDecisionDate     DateTime?
}

/// Scoring outcome snapshot (Sheet балл + Score отчет). 20-factor breakdown in ScoringFactor.
model ScoringResult {
  id              String          @id @default(cuid())
  case            CreditCase      @relation(fields: [caseId], references: [id], onDelete: Cascade)
  caseId          String          @unique
  totalScore      Int
  maxScore        Int             @default(100)
  verdict         ScoringVerdict
  age             Float?
  monthlyTranches Decimal?        @db.Decimal(18, 2)
  monthlyIncome   Decimal?        @db.Decimal(18, 2)
  monthlyExpenses Decimal?        @db.Decimal(18, 2)
  surplus         Decimal?        @db.Decimal(18, 2)
  netAfterDebt    Decimal?        @db.Decimal(18, 2)
  computedAt      DateTime        @default(now())
  factors         ScoringFactor[]
}

model ScoringFactor {
  id              String        @id @default(cuid())
  result          ScoringResult @relation(fields: [resultId], references: [id], onDelete: Cascade)
  resultId        String
  factorNo        Int           // 1..20
  name            String
  points          Int
  maxPoints       Int

  @@index([resultId])
}

/// Income certificate (Справка) — employer salary statement; 12 months → average net income.
model IncomeCertificate {
  id            String        @id @default(cuid())
  case          CreditCase    @relation(fields: [caseId], references: [id], onDelete: Cascade)
  caseId        String        @unique
  employer      String?
  position      String?
  certNo        String?
  certDate      DateTime?
  avgMonthlyNet Decimal?      @db.Decimal(18, 2) // = SUM(net)/12
  months        SalaryMonth[]
}

model SalaryMonth {
  id            String            @id @default(cuid())
  certificate   IncomeCertificate @relation(fields: [certificateId], references: [id], onDelete: Cascade)
  certificateId String
  monthIndex    Int               // 1..12
  gross         Decimal?          @db.Decimal(18, 2)
  tax           Decimal?          @db.Decimal(18, 2)
  net           Decimal?          @db.Decimal(18, 2)

  @@index([certificateId])
}
```

## 6. Extensions to existing models

`CreditCase` — add the back-relations (additive; no field removals):
```prisma
  // new SP-1 relations
  creditLine        CreditLine?
  employment        Employment?
  affordability     Affordability?
  creditHistory     CreditHistory?
  scoring           ScoringResult?
  incomeCertificate IncomeCertificate?
```

`Borrower` — add fields (existing `fullName/passportSeries/passportNumber/pinfl/birthDate/address/phone` kept):
```prisma
  gender            Gender?
  citizenship       String?
  placeOfBirth      String?
  previousName      String?
  inn               String?   // СТИР (client tax id)
  passportIssuer    String?   @db.Text
  passportIssueDate DateTime?
  passportExpiry    DateTime?
  regAddress        String?   @db.Text
  regLandmark       String?
  regTenure         String?   // собственность/аренда/служебная/другое
  regMatchesActual  Boolean?
  actualAddress     String?   @db.Text
  actualLandmark    String?
  actualTenure      String?
  phones            Json?     // [{ number, owner }] up to 5
  maritalStatus     String?
  familySize        Int?
  childrenCount     Int?
  education         String?
  residenceDuration String?   // band
  ownsHome          String?   // housing tenure type
  depositsBand      String?
```

`Collateral` — add:
```prisma
  landAreaM2   Float?  // er maydoni
  usableAreaM2 Float?  // foydali maydon
  position     Int?    // pledge rank/order
```

`CollateralOwner` — add:
```prisma
  isBorrowerOwner Boolean?  // pledgor == borrower?
  birthDate       DateTime?
  passportIssuer  String?   @db.Text
  regAddress      String?   @db.Text
```

## 7. Migration strategy

- The dev DB currently has the 4 original migrations applied plus a `db push` that added drift
  (`User.plainPassword` etc.). Before adding SP-1, **reconcile the drift into migration history** so
  `migrate dev` is clean going forward.
- Implementation step (detailed in the plan): run `prisma migrate dev --name sp1_data_model` against
  a *fresh* dev DB (or after a baseline migration that captures current state), producing one new
  migration that adds the SP-1 enums/models/fields. Use the local-engine env vars
  (`CHECKPOINT_DISABLE=1`, `PRISMA_QUERY_ENGINE_LIBRARY`, `PRISMA_SCHEMA_ENGINE_BINARY`) to avoid the
  flaky-network engine hang (see memory `local-dev-setup`).
- Container keeps `lower_case_table_names=1` so the new PascalCase tables behave consistently.

## 8. Testing / verification

- `prisma format` + `prisma validate` pass; `prisma generate` succeeds.
- Migration applies cleanly to a scratch DB; `prisma migrate deploy` is idempotent.
- **Fixture test:** a script that creates one `CreditCase` with every new relation populated from the
  TADJIYEV sample values (from the analysis data dictionary) and reads it back — proves the model can
  hold a complete real deal. Lives under `apps/backend` as a throwaway/integration fixture.
- No existing seed/login/workflow behaviour regresses (run seed + `auth/login` smoke check).

## 9. Risks & open questions

- **Migration drift reconciliation** (§7) is the main operational risk — must be resolved before the
  SP-1 migration, otherwise `migrate dev` will propose a reset. Plan will spell out the exact steps.
- **Borrower is growing wide** (~20 new fields). Acceptable for now; if it becomes unwieldy, a future
  refactor can split address/demographics into sub-models. Not done now (YAGNI).
- **phones as JSON** trades queryability for simplicity — fine, we never query by phone structurally.
- **Decimal(6,4) for rates** caps at 99.9999 (2 integer digits); penalty 1.05 and rate 0.55 fit with
  large headroom. No workbook rate approaches this.
- Living-area cell inconsistency (RU C50 vs UZ C53) is an **import** concern (SP-3), not a schema one.
