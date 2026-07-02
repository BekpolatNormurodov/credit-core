# Full UI + backend localization (uz ⇄ ru) — design

Date: 2026-07-02

## Problem

The app has an i18n scaffold (`packages/ui/src/lib/i18n.tsx`) and a working language
switcher (`packages/ui/src/components/Switches.tsx`), but only ~16–21 keys are
translated (sidebar nav, common buttons, login). The `t()` helper is used in a single
file (`RoleApp.tsx`). Everything else — page titles, buttons, form labels, table
headers, statuses, validation, enum labels — is hardcoded Uzbek. Backend responses
(errors, validation, one persisted notification) are also Uzbek-only.

Result: switching to "Русский" only changes the sidebar; all content stays Uzbek, which
reads to the user as "the language did not change in real time." The switcher's
reactivity is fine — there is simply almost no translatable text wired up.

Recon (parallel Explore agents, 2026-07-02) measured the surface:

- **Frontend:** ~368 distinct user-facing strings across ~23 files. Groups: infra 38 /
  enum-heavy 197 / origination 54 / other 79.
- **Backend:** ~48 request-time strings (errors + validation), of which validation is
  already centralized in `apps/backend/src/main.ts` via a `translate()` function.
  Exactly **one persisted** string: the deadline-overdue notification
  (`apps/backend/src/deadlines/deadlines.module.ts:72`), written to the `Message` table.
- **Enum labels** (`packages/shared/src/labels.ts`: `ROLE_LABEL`, `STATUS_LABEL`,
  `PRODUCT_LABEL`, `DOCUMENT_LABEL`) are used by **both** frontend and backend.
- **No language signal** is sent from the client today.

## Goal

Full uz/ru localization of all static UI chrome and all backend-generated API messages.
Default language is Uzbek; the web client tells the backend its language and the backend
answers in that language. Everything must switch **in real time** with no reload.

## Scope boundary

**Translated (static UI + API chrome):** page titles/subtitles, buttons, form labels &
placeholders, table headers, empty states, validation messages, tooltips, enum labels
(role, status, product, document type, workflow decision), backend error/validation
messages, system notifications.

**Not translated (dynamic user data):** borrower names, amounts, dates, chat &
notification message *bodies* typed by users, uploaded file names, case numbers, logins.
These are whatever the user entered and stay as-is.

**Documents:** generated **PDFs** (contract / application / petition) stay **Uzbek**
(formal legal records). **Excel export** follows the request language.

## Chosen approach — hybrid

Confirmed with the user: centralized bilingual source for reused/enum tokens, plus an
inline `tt('uz','ru')` helper for one-off page strings. All lookups happen at render
time from the current language, so switching is instant.

## Frontend design

### 1. `i18n.tsx` — add `tt()`
Extend the context with `tt(uz: string, ru: string): string => (lang === 'ru' ? ru : uz)`.
One-off page strings use `tt('Yangi ariza','Новая заявка')`. Keep the existing keyed
`dict` + `t()` for the small set of reused common tokens (Save/Cancel/Add/Search…),
extended with any missing ones. No component reads `localStorage` directly; all read
`useI18n()` so every consumer re-renders when `lang` changes.

### 2. Enum labels — make `packages/shared/src/labels.ts` bilingual
Because the backend also needs Russian, the enum label maps become bilingual and shared
by both sides (single source of truth):

- `ROLE_LABEL: Record<Role, { uz: string; ru: string }>` (same for `STATUS_LABEL`,
  `PRODUCT_LABEL`, `DOCUMENT_LABEL`; add `DECISION_LABEL` / `DECISION_PAST` for the
  workflow-decision text currently inlined in `CaseView.tsx` / `CaseTimeline.tsx`).
- Add a helper `pickLabel(map, key, lang: 'uz' | 'ru' = 'uz'): string`.
- **Frontend:** a `useLabels()` hook (in `packages/ui/src/lib/labels.tsx` or folded into
  `i18n.tsx`) binds the current language and exposes `roleLabel(r)`, `statusLabel(s)`,
  `productLabel(p)`, `docLabel(d)`, `decisionLabel(dec)`, `decisionPast(dec)`. All UI
  imports of `ROLE_LABEL[...]` etc. migrate to the hook.
- **Backend:** calls `pickLabel(map, key, lang)` with the request language (or `'uz'` for
  PDFs).

### 3. Reactivity guarantee
Language-independent maps (color / icon / tone) stay at module scope (perf preserved
from the prior session). Only **text-producing** maps move to render-time hook lookups,
so a language change re-renders every consumer immediately.

### 4. Migration surface (~23 files, by group)
- **infra:** `lib/i18n.tsx`, new `lib/labels.tsx`, `components/primitives.tsx`,
  `components/DataTable.tsx`, `components/forms.tsx`.
- **enum-heavy:** `CaseView.tsx` (~75), `UsersPage.tsx` (~35), `CaseChat.tsx` (~28),
  `SettingsPage.tsx` (~26), `AppShell.tsx` (~16), `ProfilePage.tsx`, `LoginPage.tsx`,
  `NotificationsPage.tsx`, `CaseTimeline.tsx`.
- **origination:** `origination/steps.tsx` (~40), `OriginationWizard.tsx`, `Summary.tsx`.
- **other:** `AnalyticsPage.tsx` (~28), `Dashboard.tsx`, `DeadlineBadge.tsx`,
  `BranchesPage.tsx`, `CreditCalculator.tsx`, `ChatsPage.tsx`.

Russian translations are authored during migration using banking/credit terminology.

## Backend design

### A. Language plumbing
- **Client:** in the axios request interceptor (`packages/api-client/src/index.ts`, where
  the Bearer token is attached), add header `X-Language: uz|ru` read from localStorage
  `cc_lang`. Default `uz`.
- **Backend:** read `req.headers['x-language']` (default `uz`). Expose a `@Lang()` param
  decorator following the `@CurrentUser` pattern for handlers/mappers that need it
  directly; the global exception filter reads the request directly.

### B. Request-time messages (errors + validation) — translate at the boundary
- New message catalog `apps/backend/src/i18n/messages.ts`:
  `{ 'errors.case_not_found': { uz, ru }, 'validation.is_not_empty': { uz, ru }, … }`
  plus `render(key, lang, params)` that interpolates `{{param}}` tokens.
- New **global HTTP exception filter**: catches `HttpException`, treats the exception
  message as a catalog key, renders it in the request language, and rewrites the response
  message. **Fallback:** if the message is not a known key, it passes through unchanged
  (so unexpected/third-party messages are never mangled).
- Services throw keys instead of Uzbek literals:
  `throw new BadRequestException('errors.case_not_found')`.
- `main.ts` validation `translate()` is reworked to emit keys + params; the same filter
  renders them. This localizes ~48 messages in one place without threading a language
  argument through every service.

### C. Persisted deadline notification — store key + params, render on read
- Prisma `Message` model gains two nullable columns: `textKey String?`, `textParams
  Json?` (nullable → safe additive migration).
- The deadline job writes `textKey = 'notif.deadline_overdue'` and
  `textParams = { number, statusKey }` instead of a rendered string.
- The message/notification **read mapper** renders `text` from `textKey` + `textParams`
  in the request language (catalog + bilingual `STATUS_LABEL`) when `textKey` is present;
  otherwise it returns the stored `text` (user chat messages, and any pre-migration
  rows). User-entered message bodies are never touched.

### D. Documents
- PDF templates pass `'uz'` to `pickLabel` (stay Uzbek).
- Excel export passes the request language.

## Testing

- **Backend unit:** catalog `render()` interpolation; exception-filter key→message
  translation for uz and ru plus the unknown-key passthrough; validation factory emits
  keys; deadline job persists `textKey`/`textParams`; message mapper renders per language
  and falls back to `text`. Extend existing specs under `apps/backend/src/**/*.spec.ts`.
- **Frontend:** `tt()` returns the right language; `useLabels()` reflects language; a
  representative page switches all visible chrome on language change (no reload).
- **Manual:** switch uz↔ru in the running app; confirm content + enum labels flip
  instantly and a triggered validation/error returns in the selected language.
- Node is not on PATH locally; the full `tsc`/build runs at the Docker deploy step.
  Verify locally via targeted reads + adversarial review agents as in the prior session.

## Risks / notes

- Making `shared/labels.ts` bilingual changes its shape and touches backend call sites
  (`deadlines`, `excel-export.util.ts`, `pdf.service.ts`) — mechanical, few sites.
- The exception-filter approach depends on every thrown message being a catalog key;
  the unknown-key passthrough keeps this safe during incremental migration.
- The `Message` migration is additive and nullable — no backfill required; old rows keep
  their rendered `text`.
