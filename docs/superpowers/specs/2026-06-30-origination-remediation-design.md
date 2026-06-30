# Origination Remediation + Audit Trail — Design Spec

> Remediation of the 21 findings from the two reviews of the Origination Capture Workspace
> (15 code-review + 6 audit-logging), plus a new 3-layer audit subsystem.
> Depends on: the origination capture module (already built, commit `0b1e427`).
> Companion: [`2026-06-29-origination-capture-workspace-design.md`](2026-06-29-origination-capture-workspace-design.md).

## 1. Goal

The origination capture wizard ships and captures the full 4-tab dataset, but two reviews found
**21 defects** clustered in six areas: the loan business rules are enforced only client-side (bypassable
via the API), per-step autosave destroys data, several captured/derived values are never persisted, the
moderator rate change has no branch scope and no audit trail, monetary inputs lack validation, and a
handful of UI correctness bugs. On top of that, **only status transitions are audited** today — no record
exists for rate changes, settings changes, KATM price, pause/resume, or edits.

This module hardens the origination path end-to-end and adds a **3-layer audit subsystem** so every
action is logged. No product behaviour changes for the operator; the rules simply become real
(server-enforced) and observable (audited).

## 2. Scope

**In scope** — all 21 findings, grouped into six workstreams, plus the audit subsystem:

- **W1 — Server-side rule enforcement:** loan-type derivation, term caps, rate bounds.
- **W2 — Persistence / data-integrity:** autosave `deleteMany`, `amount` not saved, computed values not
  persisted, moderator-rate revert.
- **W3 — Audit subsystem (3 layers):** domain `AuditLog`, HTTP `RequestLog`, Prisma `QueryLog`.
- **W4 — Auth scoping:** `setRate` branch scope.
- **W5 — Validation hardening:** DTO `@Min`/`@Max`, `minRate ≤ maxRate`, setRate clear errors.
- **W6 — UI correctness:** autosave error feedback, `amountTotal` coercion, insurance-rate input,
  `affordabilityOk`, `termCap` gating, redundant writes.

**Out of scope (separate sub-projects):**
- **Passport OCR** — auto-fill borrower demographics from an uploaded passport/ID image, robust to low
  quality (MRZ + OCR). Its own brainstorming → spec → plan. Tracked in §8.
- Scoring computation (SP-5), payment-schedule generation (SP-4), document generation + 4 notary docs
  (Phase 2) — unchanged, still deferred.

## 3. W1 — Server-side rule enforcement

A new pure helper `assertLoanRules(input, cfg)` in `@credit-core/shared` (or a backend service util that
reuses the shared `loanTypeFor` / `isTermValid` / `isRateInBounds`), called by `createCase`,
`updateCase`, `saveSection`, **and** the submit transition (DRAFT → MODERATION) so a case cannot advance
with invalid data.

- **loanType** — always derived server-side via `loanTypeFor(amountTotal)`; the client value is ignored
  and overwritten on write.
- **term cap** — `isTermValid(scheduleType, termMonths)` is checked for the tranche (and the line term);
  if over the cap the request is **rejected (400/Forbidden)**, never silently clamped.
- **interest rate** — on the origination path the operator never sets a rate: `interestRate` is **forced
  to `cfg.minRate`** on create/update. Only `setRate` (moderator, MODERATION) changes it within
  `[minRate, maxRate]`. The origination create/update/section paths never write an arbitrary rate.

## 4. W2 — Persistence / data-integrity

- **Autosave (#3):** `saveSection` writes **only the named section**. `updateCase` deletes-and-recreates
  guarantors/collaterals **only when that section is actually being saved**, not on every step. The
  unconditional `guarantor.deleteMany` / `collateral.deleteMany` is gated on presence of the relevant
  section in the payload.
- **CreditLine becomes an upsert (#4):** `creditLine` is upserted (not `deleteMany` + recreate), and the
  operator path **never writes `interestRate`** — so a moderator-raised rate survives a later DRAFT
  re-save. Nested `insurance`/`tranche` are upserted within it.
- **`amount` (#5):** the server sets `case.amount = creditLine.amountTotal` on create/update, so
  `stats`, `branches` aggregation, and Excel export stop undercounting wizard-created cases.
- **Computed values persisted (#6):** `insuredSum`, `premium`, and `affordability.newLoanPayment`
  (= `tranche.monthlyPayment`) are computed server-side via the shared `originationCalc` and written to
  their columns, so SP-6 documents/scoring read real values instead of null.

## 5. W3 — Audit subsystem (3 layers)

Three independent layers answering three questions, each at its natural altitude. All three are built
(approved: A + B + C).

### 5.1 Layer A — `AuditLog` (domain events) — service layer
"Who did what, which value changed from → to, and why." New Prisma model:

| Field | Notes |
|---|---|
| `id, createdAt` | |
| `actorId, role` | who |
| `action` | enum: `RATE_CHANGE, KATM_PRICE, CONFIG_CHANGE, PAUSE, RESUME, CASE_CREATE, CASE_UPDATE, SECTION_SAVE, TRANSITION` |
| `caseId?` | null for settings |
| `field?, oldValue?, newValue?` | e.g. `interestRate: "0.55" → "0.60"` |
| `reason?` | **mandatory for `RATE_CHANGE`**, optional elsewhere |

Written explicitly in service methods. To make this possible, thread `user` into the methods that
currently don't receive it: `pause(id, user, days?)`, `resume(id, user)`, `setKatmPrice(id, user, …)`,
and the settings update. The existing `WorkflowEvent` write in `transition` is **kept** (not removed);
an `AuditLog` row is added alongside it.

`setRate` gains a mandatory `reason` (validated, non-empty) recorded on the audit row.

### 5.2 Layer B — `RequestLog` (HTTP) — global interceptor
A global `LoggingInterceptor` records every API call: `method, path, userId, statusCode, durationMs,
ip, createdAt`. No per-endpoint code.

### 5.3 Layer C — `QueryLog` (every Prisma query) — Prisma `$extends`, **separate**
Every DB query: `model, action, durationMs, createdAt`, into its **own** table (kept separate from
`AuditLog`). Three required safeguards:
1. **Recursion guard** — the `QueryLog` insert itself is excluded from logging (no infinite loop).
2. **Volume / retention** — a daily cron prunes rows older than a configurable window (default 14 days).
3. **Toggle + async** — gated by an env flag (`QUERY_LOG=on/off`); writes are fire-and-forget so they
   don't slow the originating query.

### 5.4 Read surface
A minimal admin-only read endpoint/list for `AuditLog` (filter by case/actor/action). `RequestLog` /
`QueryLog` are operational stores (no UI required in this phase; queried directly).

## 6. W4 — Auth scoping & W5 — Validation hardening

- **#2 `setRate` branch scope:** apply the same branch filter as `scopeWhere` — a moderator may set the
  rate only on cases in branches assigned to them.
- **#12:** `@Min(0)` on every monetary DTO field (`agreedValue`, `amountAuto/Polis/Total`, `principal`,
  `interestRate`, `monthlyPayment`, …) and sane `@Max` where meaningful (`termMonths ≤ 600`, rate `≤ 5`).
- **#7:** cross-field `minRate ≤ maxRate` in `ConfigDto` + a matching guard in `SettingsPage`.
- **#8:** `setRate` surfaces the "credit line missing" backend message in the UI toast (not the generic
  bounds message).

## 7. W6 — UI correctness

- **#9** `next()` / `saveSection` wrapped in try/catch → toast on failure; step does not advance on error.
- **#10** `amountTotal` coercion fixed — a loaded total is preserved; `0` is not coerced to `null`.
- **#11** insurance-rate `%` field uses local string state (no `*100`/`/100` round-trip per render) →
  fractional percent entry works, no float noise.
- **#13** `affordabilityOk = totalIncome > 0 && surplus >= 0 && totalIncome >= minRequiredIncome` → an
  empty case is no longer "affordable"; the Summary warning condition simplifies.
- **#14** `termCap` error gated on `attempted`, consistent with other fields.
- **#15** first `saveSection` drops the redundant create+patch double-write; Step3/Step4 save the line
  once; `saveSection` invalidates only `['case', cid]`, not `['cases']` each step.

## 8. Phasing, testing, risks

**Phasing (implementation plan):**
- **Phase 1 (backend):** W1 + W2 + W3 + W4 + W5 — schema/migration first, then service + interceptor +
  Prisma extension, TDD throughout.
- **Phase 2 (UI):** W6.

**Testing:**
- Existing `originationCalc` fixture tests stay green.
- New backend tests: rate enforcement (reject out-of-bound, force `minRate` on create/update), term-cap
  reject, `loanType` derived, `setRate` branch scope (reject other-branch), audit rows written
  (`AuditLog` on rate/KATM/settings/pause; `RequestLog` via interceptor; `QueryLog` + recursion-exclusion
  + toggle off), `amount` persisted, computed values persisted, autosave no longer wipes collaterals.
- Frontend: `tsc --noEmit` + `vite build` (preview unreliable per `ui-verification` memory).

**Risks:**
- **Migration safety** — new `AuditLog`/`RequestLog`/`QueryLog` models + the `reason` column require a
  Prisma migration. The dev backend must be stopped before `prisma generate`/`migrate` (engine EPERM);
  use `prisma db push --skip-generate` against the Docker MySQL on :3307 per `local-dev-setup` memory.
- **Layer C volume** — mitigated by retention cron + env toggle + recursion guard (§5.3).
- **Backward compatibility** — `WorkflowEvent` is kept; existing transition behaviour unchanged.

**Future work (next sub-project):** Passport OCR — auto-fill borrower fields from an uploaded
passport/ID image, robust to low quality (MRZ parse + OCR fallback). Own spec + plan.
