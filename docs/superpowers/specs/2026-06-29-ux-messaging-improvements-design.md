# UX & Messaging Improvements — Design Spec

> Four independent improvements to the existing credit-core web apps (packages/ui + backend).
> Separate from the MKO-workbook program (SP-1…SP-8). UI work applies the **ui-ux-pro-max** skill
> at implementation time.

## Overview & scope

| Group | Requests | Size | Touches |
|---|---|---|---|
| **A. Messaging** | Case-independent DMs + Telegram-style "Saved Messages", in one unified inbox | Large | backend Message model + endpoints, `ChatsPage` |
| **B. User polish** | Copy login+password together; add `phone` to the user form | Small | `UsersPage` (+ tiny backend for phone) |
| **C. Workflow UX** | Let admin/creator submit a draft to moderator; polish the step-transition/file/comment UI | Medium | `workflow.ts`, `CaseView` |
| **D. Collateral attach** | Redesign the "Qo'shimcha rasm va izohlar" attach block (image + description) | Medium | `CaseForm` (CollateralCard) |

The in-case chat (`CaseChat` inside `CaseView`) stays as-is in all groups.

---

## A. Messaging — unified Telegram-style inbox

### A.1 Data model
Make the existing `Message.caseId` **optional** so a message can live outside a case. A message is one of three kinds (derived, no new enum needed):

- **case** — `caseId` set (today's behaviour, unchanged).
- **dm** — `caseId` null, `toUserId` set (a private A↔B message).
- **saved** — `caseId` null, `toUserId == senderId` (a message to oneself).

Prisma change (`apps/backend/prisma/schema.prisma`, `Message`):
```prisma
  case   CreditCase? @relation(fields: [caseId], references: [id], onDelete: Cascade)
  caseId String?
```
`@@index([caseId])` stays. Add `@@index([toUserId])` for DM/inbox queries. No other model is added — DM threads and the Saved thread are *derived* from `(senderId, toUserId, caseId is null)`. One migration: `message_caseid_nullable`.

### A.2 Thread identity
- **DM thread (A↔B)** = all messages where `caseId IS NULL AND ((senderId=A AND toUserId=B) OR (senderId=B AND toUserId=A))`.
- **Saved thread (me)** = messages where `caseId IS NULL AND senderId=me AND toUserId=me`.
- Unread reuses the existing `readBy` comma-list. `editable`/edit/delete reuse existing rules.

### A.3 Backend endpoints (extend `messages` module)
- `GET /conversations` → unified inbox list: `[{ kind, key, title, avatar?, lastMessage, lastAt, unread }]`, with the Saved thread always first (pinned), then DMs and case-chats by `lastAt` desc.
- `GET /dm/:userId/messages` / `POST /dm/:userId/messages` → DM thread (POST body `{ text?, files? }`, max 3 files; reuses `StorageService`, stored under `dm/<sortedPairKey>/`).
- `GET /saved/messages` / `POST /saved/messages` → self thread (stored under `saved/<userId>/`).
- `POST /messages/:id/save-to-saved` → copies the source message's `text` + attachment files into the caller's Saved thread (new `Message` + copied `Document` rows; original untouched). Authorised only if the caller can currently see the source message.
- Existing case endpoints (`/cases/:id/messages…`) unchanged.

### A.4 Frontend (`packages/ui`)
- Redesign `pages/ChatsPage.tsx` into a two-pane messenger: left = conversation list (📌 **Saqlangan xabarlar** pinned top, then DMs + case-chats with last-message preview + unread badge + search), right = selected thread (reuses the existing message bubble/compose/attachment UI from `CaseChat`, refactored into a shared `MessageThread` component so case-chat and DM/saved share it).
- **New DM**: a "+" / compose button opens the existing directory search (`GET /directory`) to pick a user → opens/creates the DM thread.
- **Save to Saved**: a per-message action ("Saqlanganlarga qo'shish") on every message in any thread.
- The Saved thread is a normal composer (post text/image/file to yourself), exactly like Telegram Saved Messages.
- Sidebar (`RoleApp.tsx`): no new nav item needed — everything lives under the existing **Chats** entry (the unified inbox). (If desired later, a "Saved" shortcut can be added.)

---

## B. User management polish (`pages/UsersPage.tsx`)
- **Copy login+password together**: add one button per user row (and in the credentials cell) that writes `"<login> / <plainPassword>"` (two lines) to the clipboard, with a "nusxalandi" toast. Keep the existing eye-toggle and per-field copy buttons.
- **Phone in the form**: add a `phone` input to the create/edit user form (the `User.phone` column already exists). Optional field, light validation (digits/`+`/spaces). Wire it through the existing `POST /users` and `PUT /users/:id` payloads (`phone?: string`). Show phone in the user table (or in the row's expand/edit).

---

## C. Workflow UX (`packages/shared/src/workflow.ts`, `pages/CaseView.tsx`)
### C.1 Submit-draft fix
Admin (and operators) create draft cases, but `SUBMIT` is OPERATOR-only, so an admin-created draft is stuck. Add a transition rule:
```ts
{ from: DRAFT, to: MODERATION, role: ADMIN, decision: SUBMIT },
```
(Operators keep their existing `DRAFT→MODERATION` rule.) No data-model change; `WorkflowService.resolve` already keys off `(from, role, decision)`.

### C.2 Action-panel polish (ui-ux-pro-max)
Rework the transition area in `CaseView` into a clear **"Amaliyot"** panel:
- Primary action button(s) with explicit labels + icons per decision (Yuborish/Tasdiqlash/Qaytarish/Yakunlash/Bekor qilish), the comment textarea framed inside the panel as "Qaror izohi".
- Inline, contextual requirements/prompts — e.g. at `DIRECTOR_REVIEW`, show the "yakuniy hujjat shart" requirement next to a focused upload control; disable Approve until satisfied with a clear reason.
- Destructive actions (Cancel) keep a typed/explicit confirm; Reopen vs Cancel stay in the existing modal but restyled for clarity.
- Better loading (per-button spinner) and empty/terminal states (FINALIZED/CANCELLED show a summary, no actions).
- File-upload and comment interactions get consistent affordances (drag-drop where it fits, progress, success toasts).

---

## D. Collateral attachment redesign (`pages/CaseForm.tsx` — CollateralCard)
Redesign the **"Qo'shimcha rasm va izohlar"** block (currently a cramped row per file) into a clean, modern attach experience:
- A prominent **dropzone** ("Rasm/fayl tashlang yoki tanlang", accepts `image/*,.pdf,.doc,.docx`) supporting drag-drop + click; multiple files.
- Each staged attachment renders as a **card** in a responsive grid: a larger image thumbnail (or typed file icon), the **Nomi** and **Izoh matni** fields stacked clearly beneath, the original filename, and a delete button. Image cards open a lightbox preview on click.
- Both an image **and** a plain description can be attached together (the data already supports `title` + `description` per `StagedColDoc`/`Document`); the redesign just makes that obvious and pleasant.
- No data-model change — reuses `StagedColDoc`, `addColDocs`/`removeColDoc`/`setColDocField`, and the existing `POST /documents/upload?collateralId=…` flow. Apply ui-ux-pro-max for spacing/typography/states.

---

## Data-model changes (summary)
- **Only one schema change:** `Message.caseId` → optional (+ `@@index([toUserId])`). One Prisma migration (`message_caseid_nullable`). Groups B/C/D need **no** schema change.

## Testing / verification
- **A:** unit-test thread identity (DM pair, saved self) and the `save-to-saved` copy; manual: send a DM, post to Saved, save a case message to Saved, verify unread + inbox ordering; confirm case-chat still works.
- **B:** copy-both writes both credentials; phone persists on create/edit and shows in the table.
- **C:** admin can submit a draft → MODERATION (add a workflow.ts unit test); existing `workflow.service.spec.ts` stays green; manual walk of the action panel per role/status.
- **D:** attach an image + description to a collateral, save, reload, confirm both persisted and rendered; drag-drop + lightbox work.
- Backend `npm test` green; build/tsc clean for the web apps.

## Risks / open questions
- **Message.caseId nullable** loosens an invariant — audit every `messages` query/visibility path so case logic still filters `caseId` correctly (the `visibleTo` filter and case feeds must not leak DMs into case views, and vice-versa).
- DM is **any-user-to-any-user** (internal tool; directory already lists all). If role/branch restrictions are wanted later, add them in `GET /directory` + DM POST guard.
- `save-to-saved` copies files (duplicates storage) rather than referencing the original — chosen for isolation (deleting the source must not break Saved). Acceptable; revisit if storage grows.
- ui-ux-pro-max polish (C, D, and the A inbox) is design-quality work — budget review iterations on the visuals.
