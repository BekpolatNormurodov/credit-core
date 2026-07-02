# uz/ru Full Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the entire app (frontend UI + backend API messages) switch between Uzbek and Russian in real time, defaulting to Uzbek and following the web client's chosen language for backend responses.

**Architecture:** A hybrid i18n scheme. Reused/enum tokens come from a single bilingual source (`packages/shared/src/labels.ts` made `{uz,ru}` + a `useLabels()` hook on the frontend, `pickLabel()` on the backend). One-off UI strings use an inline `tt('uz','ru')` helper from the i18n context. The web client sends its language as an `X-Language` header; the backend reads it (`@Lang()` decorator, default `uz`) and translates request-time messages at the boundary via a **global HTTP exception filter** driven by a keyed message catalog. The one persisted notification (deadline-overdue) is stored as `textKey`+`textParams` and rendered per reader-language on read.

**Tech Stack:** React + Vite + TypeScript (`packages/ui`), shared TS DTOs/enums (`packages/shared`), axios client (`packages/api-client`), NestJS + Prisma + MySQL (`apps/backend`).

## Global Constraints

- Default language is **Uzbek** (`uz`); Russian (`ru`) is opt-in. Any missing translation falls back to Uzbek, never to a raw key.
- Language values are the literal strings `'uz'` and `'ru'`; the frontend stores the choice in `localStorage` key `cc_lang`; the wire signal is HTTP header `X-Language`.
- **Do NOT translate dynamic user data**: borrower names, amounts, dates, user-typed chat/notification bodies, file names, case numbers, logins.
- **Generated PDFs stay Uzbek** (legal records); **Excel export follows the request language**.
- Commit after every task. Commit trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Node is not on the dev machine's PATH.** Test/`tsc` commands in this plan run at execution time on a Node-capable environment or at the Docker deploy build. When Node is unavailable, verify a task by reading the diff + the adversarial-review approach used previously, and defer the type-check to the deploy build.
- Enum key → RU glossary (authoritative; use verbatim):

  | Enum | Key | uz | ru |
  |------|-----|----|----|
  | Role | OPERATOR | Operator | Оператор |
  | Role | MODERATOR | Moderator | Модератор |
  | Role | DIRECTOR | Direktor | Директор |
  | Role | ADMIN | Administrator | Администратор |
  | CaseStatus | DRAFT | Qoralama | Черновик |
  | CaseStatus | MODERATION | Moderatsiyada | На модерации |
  | CaseStatus | DIRECTOR_REVIEW | Direktor ko‘rigida | На рассмотрении директора |
  | CaseStatus | ADMIN_FINALIZE | Yakunlash (admin) | Финализация (админ) |
  | CaseStatus | FINALIZED | Yakunlangan | Завершено |
  | CaseStatus | REJECTED | Rad etilgan | Отклонено |
  | CaseStatus | CANCELLED | Bekor qilingan | Отменено |
  | ProductType | REAL_ESTATE | Uy-joy (ko‘chmas mulk) | Недвижимость (жильё) |
  | ProductType | AUTO | Avtotransport | Автотранспорт |
  | DocumentType | NOTARY | Notarial hujjat | Нотариальный документ |
  | DocumentType | SCAN | Skan | Скан |
  | DocumentType | PASSPORT | Pasport | Паспорт |
  | DocumentType | COLLATERAL_PHOTO | Garov rasmi | Фото залога |
  | DocumentType | TECH_PASSPORT | Texnik pasport | Техпаспорт |
  | DocumentType | DIRECTOR_FINAL | Yakuniy hujjat (direktor) | Итоговый документ (директор) |
  | DocumentType | GENERATED_PDF | Generatsiya qilingan PDF | Сгенерированный PDF |
  | DocumentType | CHAT | Chat fayli | Файл чата |
  | DocumentType | OTHER | Boshqa | Другое |
  | WorkflowDecision (imperative) | SUBMIT | Yuborish | Отправить |
  | WorkflowDecision (imperative) | APPROVE | Tasdiqlash | Утвердить |
  | WorkflowDecision (imperative) | RETURN | Qaytarish | Вернуть |
  | WorkflowDecision (imperative) | FINALIZE | Yakunlash | Завершить |
  | WorkflowDecision (imperative) | CANCEL | Bekor qilish | Отменить |
  | WorkflowDecision (imperative) | REOPEN | Qayta to‘ldirishga qaytarish | Вернуть на доработку |
  | WorkflowDecision (past) | SUBMIT | Yuborildi | Отправлено |
  | WorkflowDecision (past) | APPROVE | Tasdiqlandi | Утверждено |
  | WorkflowDecision (past) | RETURN | Qaytarildi | Возвращено |
  | WorkflowDecision (past) | FINALIZE | Yakunlandi | Завершено |
  | WorkflowDecision (past) | CANCEL | Bekor qilindi | Отменено |
  | WorkflowDecision (past) | REOPEN | Qayta to‘ldirishga qaytarildi | Возвращено на доработку |

---

## Phase 1 — Shared bilingual labels (foundation for FE + BE)

### Task 1: Make `packages/shared/src/labels.ts` bilingual + `pickLabel`

**Files:**
- Modify: `packages/shared/src/labels.ts` (whole file)
- Modify: `packages/shared/src/index.ts` (ensure the new `pickLabel`, `DECISION_LABEL`, `DECISION_PAST`, and `LabelText` type are exported — add to the existing `export * from './labels'` if that's how it re-exports; otherwise add named exports)
- Test: `packages/shared/src/labels.spec.ts` (create)

**Interfaces:**
- Produces: `type LabelText = { uz: string; ru: string }`; `ROLE_LABEL/STATUS_LABEL/PRODUCT_LABEL/DOCUMENT_LABEL: Record<Enum, LabelText>`; `DECISION_LABEL/DECISION_PAST: Record<WorkflowDecision, LabelText>`; `pickLabel(map: Record<string, LabelText>, key: string, lang?: 'uz' | 'ru'): string`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/shared/src/labels.spec.ts
import { ROLE_LABEL, STATUS_LABEL, DECISION_LABEL, pickLabel } from './labels';
import { Role, CaseStatus, WorkflowDecision } from './enums';

describe('bilingual labels', () => {
  it('returns uz by default and ru when asked', () => {
    expect(pickLabel(ROLE_LABEL, Role.DIRECTOR)).toBe('Direktor');
    expect(pickLabel(ROLE_LABEL, Role.DIRECTOR, 'ru')).toBe('Директор');
    expect(pickLabel(STATUS_LABEL, CaseStatus.MODERATION, 'ru')).toBe('На модерации');
    expect(pickLabel(DECISION_LABEL, WorkflowDecision.APPROVE, 'ru')).toBe('Утвердить');
  });
  it('falls back to uz for an unknown lang value', () => {
    expect(pickLabel(ROLE_LABEL, Role.ADMIN, 'de' as any)).toBe('Administrator');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (Node-capable env): from `packages/shared`, `npm test -- labels` (Jest). Expected: FAIL — `pickLabel` not exported / labels are strings not objects.

- [ ] **Step 3: Write the implementation**

Replace the whole `packages/shared/src/labels.ts` with:

```ts
import { CaseStatus, DocumentType, ProductType, Role, WorkflowDecision } from './enums';

export type Lang = 'uz' | 'ru';
export type LabelText = { uz: string; ru: string };

/** Bilingual enum labels — single source shared by the UI (useLabels) and backend (pickLabel). */
export const ROLE_LABEL: Record<Role, LabelText> = {
  [Role.OPERATOR]: { uz: 'Operator', ru: 'Оператор' },
  [Role.MODERATOR]: { uz: 'Moderator', ru: 'Модератор' },
  [Role.DIRECTOR]: { uz: 'Direktor', ru: 'Директор' },
  [Role.ADMIN]: { uz: 'Administrator', ru: 'Администратор' },
};

export const STATUS_LABEL: Record<CaseStatus, LabelText> = {
  [CaseStatus.DRAFT]: { uz: 'Qoralama', ru: 'Черновик' },
  [CaseStatus.MODERATION]: { uz: 'Moderatsiyada', ru: 'На модерации' },
  [CaseStatus.DIRECTOR_REVIEW]: { uz: 'Direktor ko‘rigida', ru: 'На рассмотрении директора' },
  [CaseStatus.ADMIN_FINALIZE]: { uz: 'Yakunlash (admin)', ru: 'Финализация (админ)' },
  [CaseStatus.FINALIZED]: { uz: 'Yakunlangan', ru: 'Завершено' },
  [CaseStatus.REJECTED]: { uz: 'Rad etilgan', ru: 'Отклонено' },
  [CaseStatus.CANCELLED]: { uz: 'Bekor qilingan', ru: 'Отменено' },
};

export const PRODUCT_LABEL: Record<ProductType, LabelText> = {
  [ProductType.REAL_ESTATE]: { uz: 'Uy-joy (ko‘chmas mulk)', ru: 'Недвижимость (жильё)' },
  [ProductType.AUTO]: { uz: 'Avtotransport', ru: 'Автотранспорт' },
};

export const DOCUMENT_LABEL: Record<DocumentType, LabelText> = {
  [DocumentType.NOTARY]: { uz: 'Notarial hujjat', ru: 'Нотариальный документ' },
  [DocumentType.SCAN]: { uz: 'Skan', ru: 'Скан' },
  [DocumentType.PASSPORT]: { uz: 'Pasport', ru: 'Паспорт' },
  [DocumentType.COLLATERAL_PHOTO]: { uz: 'Garov rasmi', ru: 'Фото залога' },
  [DocumentType.TECH_PASSPORT]: { uz: 'Texnik pasport', ru: 'Техпаспорт' },
  [DocumentType.DIRECTOR_FINAL]: { uz: 'Yakuniy hujjat (direktor)', ru: 'Итоговый документ (директор)' },
  [DocumentType.GENERATED_PDF]: { uz: 'Generatsiya qilingan PDF', ru: 'Сгенерированный PDF' },
  [DocumentType.CHAT]: { uz: 'Chat fayli', ru: 'Файл чата' },
  [DocumentType.OTHER]: { uz: 'Boshqa', ru: 'Другое' },
};

/** Imperative decision labels (buttons). Previously inlined in CaseView.tsx. */
export const DECISION_LABEL: Record<WorkflowDecision, LabelText> = {
  [WorkflowDecision.SUBMIT]: { uz: 'Yuborish', ru: 'Отправить' },
  [WorkflowDecision.APPROVE]: { uz: 'Tasdiqlash', ru: 'Утвердить' },
  [WorkflowDecision.RETURN]: { uz: 'Qaytarish', ru: 'Вернуть' },
  [WorkflowDecision.FINALIZE]: { uz: 'Yakunlash', ru: 'Завершить' },
  [WorkflowDecision.CANCEL]: { uz: 'Bekor qilish', ru: 'Отменить' },
  [WorkflowDecision.REOPEN]: { uz: 'Qayta to‘ldirishga qaytarish', ru: 'Вернуть на доработку' },
};

/** Past-tense decision labels (timeline). Previously inlined in CaseTimeline.tsx. */
export const DECISION_PAST: Record<WorkflowDecision, LabelText> = {
  [WorkflowDecision.SUBMIT]: { uz: 'Yuborildi', ru: 'Отправлено' },
  [WorkflowDecision.APPROVE]: { uz: 'Tasdiqlandi', ru: 'Утверждено' },
  [WorkflowDecision.RETURN]: { uz: 'Qaytarildi', ru: 'Возвращено' },
  [WorkflowDecision.FINALIZE]: { uz: 'Yakunlandi', ru: 'Завершено' },
  [WorkflowDecision.CANCEL]: { uz: 'Bekor qilindi', ru: 'Отменено' },
  [WorkflowDecision.REOPEN]: { uz: 'Qayta to‘ldirishga qaytarildi', ru: 'Возвращено на доработку' },
};

/** Pick a label string in the given language, defaulting to Uzbek. */
export function pickLabel(map: Record<string, LabelText>, key: string, lang: Lang = 'uz'): string {
  const entry = map[key];
  if (!entry) return key;
  return lang === 'ru' ? entry.ru : entry.uz;
}
```

- [ ] **Step 4: Verify the shared index re-exports the new symbols**

Read `packages/shared/src/index.ts`. If it uses `export * from './labels';`, no change is needed (new symbols are included). If it lists named exports, add `pickLabel, DECISION_LABEL, DECISION_PAST, type LabelText, type Lang`. Ensure `Lang` is not double-declared elsewhere in shared; if it is, import from `./labels` instead of redeclaring.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- labels`. Expected: PASS. (If Node unavailable, defer to deploy build; verify by reading the diff.)

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/labels.ts packages/shared/src/labels.spec.ts packages/shared/src/index.ts
git commit -m "feat(shared): bilingual enum labels + pickLabel"
```

> **NOTE — this breaks all current `LABEL[x]` call sites** (they now yield an object). Tasks 6, 8, 9 (backend) and Phase 3 (frontend) migrate them to `pickLabel`/`useLabels`. Until then the workspace won't type-check; land Phase 1→2 before relying on a green build.

---

## Phase 2 — Backend localization

### Task 2: Language plumbing — client `X-Language` header + `@Lang()` decorator

**Files:**
- Modify: `packages/api-client/src/index.ts:77-81` (request interceptor)
- Create: `apps/backend/src/common/lang.decorator.ts`
- Test: `apps/backend/src/common/lang.decorator.spec.ts` (create)

**Interfaces:**
- Produces: `@Lang()` param decorator resolving to `'uz' | 'ru'`; helper `langFromRequest(req): Lang`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/backend/src/common/lang.decorator.spec.ts
import { langFromRequest } from './lang.decorator';

describe('langFromRequest', () => {
  it('defaults to uz', () => {
    expect(langFromRequest({ headers: {} })).toBe('uz');
  });
  it('reads ru from x-language', () => {
    expect(langFromRequest({ headers: { 'x-language': 'ru' } })).toBe('ru');
  });
  it('ignores unknown values (falls back to uz)', () => {
    expect(langFromRequest({ headers: { 'x-language': 'fr' } })).toBe('uz');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: from `apps/backend`, `npm test -- lang.decorator`. Expected: FAIL — module not found.

- [ ] **Step 3: Implement the decorator**

```ts
// apps/backend/src/common/lang.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Lang } from '@credit-core/shared';

export function langFromRequest(req: { headers?: Record<string, unknown> }): Lang {
  const raw = String(req.headers?.['x-language'] ?? '').toLowerCase();
  return raw === 'ru' ? 'ru' : 'uz';
}

export const Lang = createParamDecorator((_data: unknown, ctx: ExecutionContext): Lang =>
  langFromRequest(ctx.switchToHttp().getRequest()),
);
```

- [ ] **Step 4: Add the client header (interceptor)**

In `packages/api-client/src/index.ts`, replace the interceptor at lines 77-81 with:

```ts
http.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const lang = (typeof localStorage !== 'undefined' && localStorage.getItem('cc_lang')) || 'uz';
  config.headers['X-Language'] = lang === 'ru' ? 'ru' : 'uz';
  return config;
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- lang.decorator`. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/common/lang.decorator.ts apps/backend/src/common/lang.decorator.spec.ts packages/api-client/src/index.ts
git commit -m "feat(i18n): send X-Language header + @Lang() decorator"
```

### Task 3: Backend message catalog + `render` / `renderNotification`

**Files:**
- Create: `apps/backend/src/i18n/messages.catalog.ts`
- Create: `apps/backend/src/i18n/render.ts`
- Test: `apps/backend/src/i18n/render.spec.ts` (create)

**Interfaces:**
- Produces: `CATALOG: Record<string, LabelText>`; `FIELD_LABEL: Record<string, LabelText>`; `render(key: string, lang: Lang, vars?: Record<string, string | number>): string`; `renderNotification(key: string, params: Record<string, any> | null, lang: Lang): string`.
- Consumes: `pickLabel`, `STATUS_LABEL`, `LabelText`, `Lang` from `@credit-core/shared`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/backend/src/i18n/render.spec.ts
import { render, renderNotification } from './render';

describe('render', () => {
  it('interpolates and localizes a known key', () => {
    expect(render('errors.case_not_found', 'ru')).toBe('Заявка не найдена');
    expect(render('errors.case_not_found', 'uz')).toBe('Ariza topilmadi');
  });
  it('interpolates {{vars}}', () => {
    expect(render('validation.min_length', 'ru', { field: 'Логин', n: 3 }))
      .toBe('Логин должен содержать не менее 3 символов');
  });
  it('returns the key unchanged when unknown', () => {
    expect(render('errors.__nope__', 'ru')).toBe('errors.__nope__');
  });
  it('renderNotification localizes the deadline status param', () => {
    expect(renderNotification('notif.deadline_overdue', { number: 'A-1', status: 'MODERATION' }, 'ru'))
      .toBe('Заявка «A-1» на этапе «На модерации» просрочена.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- i18n/render`. Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the catalog**

```ts
// apps/backend/src/i18n/messages.catalog.ts
import type { LabelText } from '@credit-core/shared';

/** DTO property → visible field name, bilingual (used by validation messages). */
export const FIELD_LABEL: Record<string, LabelText> = {
  login: { uz: 'Login', ru: 'Логин' },
  password: { uz: 'Parol', ru: 'Пароль' },
  fullName: { uz: 'F.I.O', ru: 'Ф.И.О' },
  role: { uz: 'Rol', ru: 'Роль' },
  branchId: { uz: 'Filial', ru: 'Филиал' },
  name: { uz: 'Nomi', ru: 'Название' },
  symbol: { uz: 'Simvol', ru: 'Символ' },
  region: { uz: 'Hudud', ru: 'Регион' },
  amount: { uz: 'Summa', ru: 'Сумма' },
  termMonths: { uz: 'Muddat', ru: 'Срок' },
  katmPrice: { uz: 'KATM narxi', ru: 'Цена КАТМ' },
  isActive: { uz: 'Holat', ru: 'Статус' },
  decision: { uz: 'Qaror', ru: 'Решение' },
  comment: { uz: 'Izoh', ru: 'Комментарий' },
};

/** All backend user-facing message templates. Keys are thrown by services / emitted by validation. */
export const CATALOG: Record<string, LabelText> = {
  // ── errors ──
  'errors.user_not_found': { uz: 'Foydalanuvchi topilmadi', ru: 'Пользователь не найден' },
  'errors.cannot_block_self': { uz: 'O‘zingizni bloklay olmaysiz', ru: 'Вы не можете заблокировать себя' },
  'errors.last_admin': { uz: 'Oxirgi faol adminni bloklab yoki rolini o‘zgartirib bo‘lmaydi', ru: 'Нельзя заблокировать последнего активного администратора или изменить его роль' },
  'errors.no_image': { uz: 'Rasm yuborilmadi', ru: 'Изображение не отправлено' },
  'errors.no_avatar': { uz: 'Avatar yo‘q', ru: 'Аватар отсутствует' },
  'errors.bad_credentials': { uz: 'Login yoki parol noto‘g‘ri', ru: 'Неверный логин или пароль' },
  'errors.account_inactive': { uz: 'Hisob faol emas', ru: 'Аккаунт неактивен' },
  'errors.role_forbidden': { uz: 'Sizning rolingiz uchun ruxsat yo‘q', ru: 'Нет доступа для вашей роли' },
  'errors.no_file': { uz: 'Fayl yuborilmadi', ru: 'Файл не отправлен' },
  'errors.caseId_required': { uz: 'caseId kerak', ru: 'Требуется caseId' },
  'errors.doc_not_found': { uz: 'Hujjat topilmadi', ru: 'Документ не найден' },
  'errors.doc_no_edit': { uz: 'Bu hujjatni o‘zgartira olmaysiz', ru: 'Вы не можете изменить этот документ' },
  'errors.doc_no_delete': { uz: 'Bu hujjatni o‘chira olmaysiz', ru: 'Вы не можете удалить этот документ' },
  'errors.msg_not_found': { uz: 'Xabar topilmadi', ru: 'Сообщение не найдено' },
  'errors.forbidden': { uz: 'Ruxsat yo‘q', ru: 'Нет доступа' },
  'errors.msg_only_own': { uz: 'Faqat o‘z xabaringizni o‘zgartira olasiz', ru: 'Вы можете изменять только свои сообщения' },
  'errors.msg_already_read': { uz: 'Xabar allaqachon o‘qilgan — o‘zgartirib bo‘lmaydi', ru: 'Сообщение уже прочитано — изменить нельзя' },
  'errors.case_not_found': { uz: 'Ariza topilmadi', ru: 'Заявка не найдена' },
  'errors.case_only_draft_edit': { uz: 'Faqat qoralama holatidagi arizani tahrirlash mumkin', ru: 'Редактировать можно только заявку в статусе черновика' },
  'errors.case_not_yours': { uz: 'Bu ariza sizga tegishli emas', ru: 'Эта заявка вам не принадлежит' },
  'errors.case_only_active_pause': { uz: 'Faqat aktiv bosqichdagi arizani pauzaga qo‘yish mumkin', ru: 'Приостановить можно только заявку на активном этапе' },
  'errors.collateral_required': { uz: 'Kamida bitta garov kiritilishi shart', ru: 'Необходимо указать хотя бы один залог' },
  'errors.credit_line_incomplete': { uz: 'Kredit liniyasi to‘liq emas (summa, muddat va jadval turi shart)', ru: 'Кредитная линия неполная (нужны сумма, срок и тип графика)' },
  'errors.rate_only_mod_admin': { uz: 'Foizni faqat moderator yoki admin o‘zgartiradi', ru: 'Ставку меняет только модератор или администратор' },
  'errors.rate_only_moderation': { uz: 'Faqat moderatsiya bosqichida foizni o‘zgartirish mumkin', ru: 'Ставку можно менять только на этапе модерации' },
  'errors.case_not_your_branch': { uz: 'Bu ariza sizning filialingizga tegishli emas', ru: 'Эта заявка не относится к вашему филиалу' },
  'errors.credit_line_empty': { uz: 'Kredit liniyasi to‘ldirilmagan', ru: 'Кредитная линия не заполнена' },
  'errors.director_final_required': { uz: 'Tasdiqlashdan oldin kamida 1 ta yakuniy hujjat (DIRECTOR_FINAL) yuklang', ru: 'Перед утверждением загрузите хотя бы 1 итоговый документ (DIRECTOR_FINAL)' },
  'errors.doc_draft_only': { uz: 'Hujjat hali mavjud emas (qoralama)', ru: 'Документ ещё недоступен (черновик)' },
  // ── errors with params ──
  'errors.rate_out_of_range': { uz: 'Foiz {{min}}% va {{max}}% oralig‘ida bo‘lishi kerak', ru: 'Ставка должна быть в диапазоне от {{min}}% до {{max}}%' },
  'errors.workflow_not_allowed': { uz: '«{{status}}» holatida «{{role}}» roli «{{decision}}» amalini bajara olmaydi', ru: 'В статусе «{{status}}» роль «{{role}}» не может выполнить действие «{{decision}}»' },
  // ── validation (params: field, n) ──
  'validation.is_not_empty': { uz: '{{field}} kiritilishi shart', ru: '{{field}} обязательно для заполнения' },
  'validation.is_string': { uz: '{{field}} matn bo‘lishi kerak', ru: '{{field}} должно быть строкой' },
  'validation.min_length': { uz: '{{field}} kamida {{n}} ta belgi bo‘lishi kerak', ru: '{{field}} должен содержать не менее {{n}} символов' },
  'validation.max_length': { uz: '{{field}} ko‘pi bilan {{n}} ta belgi bo‘lishi kerak', ru: '{{field}} должен содержать не более {{n}} символов' },
  'validation.is_email': { uz: '{{field}} noto‘g‘ri formatda', ru: '{{field}} имеет неверный формат' },
  'validation.is_enum': { uz: '{{field}} qiymati noto‘g‘ri', ru: 'Недопустимое значение {{field}}' },
  'validation.is_number': { uz: '{{field}} raqam bo‘lishi kerak', ru: '{{field}} должно быть числом' },
  'validation.is_boolean': { uz: '{{field}} ha/yo‘q qiymat bo‘lishi kerak', ru: '{{field}} должно быть да/нет' },
  'validation.min': { uz: '{{field}} kamida {{n}} bo‘lishi kerak', ru: '{{field}} должно быть не менее {{n}}' },
  'validation.max': { uz: '{{field}} ko‘pi bilan {{n}} bo‘lishi kerak', ru: '{{field}} должно быть не более {{n}}' },
  'validation.invalid': { uz: '{{field}} noto‘g‘ri', ru: '{{field}} некорректно' },
  'validation.rate_min_max': { uz: 'Min yillik foiz Max dan katta bo‘lmasligi kerak', ru: 'Мин. годовая ставка не должна превышать макс.' },
  'validation.tranche_max_months': { uz: 'Transh muddati {{max}} oydan oshmasligi kerak', ru: 'Срок транша не должен превышать {{max}} мес.' },
  'validation.line_max_months': { uz: 'Liniya muddati {{max}} oydan oshmasligi kerak', ru: 'Срок линии не должен превышать {{max}} мес.' },
  // ── notifications (persisted; rendered on read) ──
  'notif.deadline_overdue': { uz: '«{{number}}» arizasi «{{status}}» bosqichida belgilangan muddatdan o‘tib ketdi.', ru: 'Заявка «{{number}}» на этапе «{{status}}» просрочена.' },
  // ── katm placeholders ──
  'katm.coming_soon': { uz: 'KATM integratsiyasi tez kunda ishga tushadi', ru: 'Интеграция КАТМ скоро заработает' },
  'katm.reports_coming_soon': { uz: 'Tez kunda: KATM hisobotlari shu yerda ko‘rinadi', ru: 'Скоро: отчёты КАТМ появятся здесь' },
};
```

- [ ] **Step 4: Implement `render` / `renderNotification`**

```ts
// apps/backend/src/i18n/render.ts
import { pickLabel, STATUS_LABEL, type Lang } from '@credit-core/shared';
import { CATALOG } from './messages.catalog';

/** Interpolate {{name}} tokens from vars into a localized catalog template. */
export function render(key: string, lang: Lang, vars: Record<string, string | number> = {}): string {
  const template = pickLabel(CATALOG, key, lang);
  if (template === key) return key; // unknown key → pass through unchanged
  return template.replace(/\{\{(\w+)\}\}/g, (_m, name) =>
    name in vars ? String(vars[name]) : `{{${name}}}`,
  );
}

/** Render a persisted notification whose params may contain enum keys needing localization. */
export function renderNotification(key: string, params: Record<string, any> | null, lang: Lang): string {
  const p = params ?? {};
  if (key === 'notif.deadline_overdue') {
    return render(key, lang, {
      number: String(p.number ?? ''),
      status: pickLabel(STATUS_LABEL, String(p.status ?? ''), lang),
    });
  }
  return render(key, lang, p);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- i18n/render`. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/i18n/messages.catalog.ts apps/backend/src/i18n/render.ts apps/backend/src/i18n/render.spec.ts
git commit -m "feat(i18n): backend message catalog + render/renderNotification"
```

### Task 4: Global HTTP exception filter (translate at the boundary) + register

**Files:**
- Create: `apps/backend/src/i18n/i18n-exception.filter.ts`
- Create: `apps/backend/src/i18n/i18n.module.ts`
- Modify: `apps/backend/src/app.module.ts` (import `I18nModule`)
- Test: `apps/backend/src/i18n/i18n-exception.filter.spec.ts` (create)

**Interfaces:**
- Consumes: `render` (Task 3), `langFromRequest` (Task 2).
- Produces: `I18nExceptionFilter` registered via `APP_FILTER`. Behaviour: for an `HttpException`, translate the `message` in the request language; a string message that is a known catalog key → rendered; an array of `{ key, params }` (from validation, Task 5) → array of rendered strings; anything else → unchanged.

- [ ] **Step 1: Write the failing test**

```ts
// apps/backend/src/i18n/i18n-exception.filter.spec.ts
import { NotFoundException, BadRequestException, ArgumentsHost } from '@nestjs/common';
import { I18nExceptionFilter } from './i18n-exception.filter';

function hostFor(lang: string, captured: { body?: any; code?: number }): ArgumentsHost {
  const res = { status: (c: number) => { captured.code = c; return res; }, json: (b: any) => { captured.body = b; } };
  const req = { headers: { 'x-language': lang } };
  return { switchToHttp: () => ({ getResponse: () => res, getRequest: () => req }) } as unknown as ArgumentsHost;
}

describe('I18nExceptionFilter', () => {
  const filter = new I18nExceptionFilter();
  it('translates a key message to ru', () => {
    const cap: any = {};
    filter.catch(new NotFoundException('errors.case_not_found'), hostFor('ru', cap));
    expect(cap.code).toBe(404);
    expect(cap.body.message).toBe('Заявка не найдена');
  });
  it('passes through an unknown (non-key) message', () => {
    const cap: any = {};
    filter.catch(new BadRequestException('raw text'), hostFor('ru', cap));
    expect(cap.body.message).toBe('raw text');
  });
  it('renders an array of {key,params} (validation)', () => {
    const cap: any = {};
    filter.catch(new BadRequestException([{ key: 'validation.is_not_empty', params: { field: 'Логин' } }] as any), hostFor('ru', cap));
    expect(cap.body.message).toEqual(['Логин обязательно для заполнения']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- i18n-exception`. Expected: FAIL — filter not found.

- [ ] **Step 3: Implement the filter**

```ts
// apps/backend/src/i18n/i18n-exception.filter.ts
import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import type { Lang } from '@credit-core/shared';
import { langFromRequest } from '../common/lang.decorator';
import { render } from './render';

type ValidationItem = { key: string; params?: Record<string, string | number> };

function localizeOne(msg: unknown, lang: Lang): unknown {
  if (typeof msg === 'string') return render(msg, lang); // known key → rendered; else unchanged
  if (msg && typeof msg === 'object' && typeof (msg as ValidationItem).key === 'string') {
    const v = msg as ValidationItem;
    return render(v.key, lang, v.params ?? {});
  }
  return msg;
}

/** Translate HttpException messages into the request language at the response boundary. */
@Catch(HttpException)
export class I18nExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest();
    const res = ctx.getResponse();
    const lang = langFromRequest(req);
    const status = exception.getStatus();
    const body = exception.getResponse();

    let payload: any;
    if (typeof body === 'string') {
      payload = { statusCode: status, message: render(body, lang) };
    } else {
      const b = body as Record<string, any>;
      const message = Array.isArray(b.message)
        ? b.message.map((m: unknown) => localizeOne(m, lang))
        : localizeOne(b.message, lang);
      payload = { ...b, statusCode: status, message };
    }
    res.status(status).json(payload);
  }
}
```

- [ ] **Step 4: Register the filter globally**

```ts
// apps/backend/src/i18n/i18n.module.ts
import { Global, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { I18nExceptionFilter } from './i18n-exception.filter';

@Global()
@Module({
  providers: [{ provide: APP_FILTER, useClass: I18nExceptionFilter }],
})
export class I18nModule {}
```

Then in `apps/backend/src/app.module.ts`, add `I18nModule` to the `imports` array (place it alongside the other feature modules; read the file first to match its import style and ordering).

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- i18n-exception`. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/i18n/i18n-exception.filter.ts apps/backend/src/i18n/i18n.module.ts apps/backend/src/app.module.ts apps/backend/src/i18n/i18n-exception.filter.spec.ts
git commit -m "feat(i18n): global exception filter translates messages at the boundary"
```

### Task 5: Validation emits keys+params (main.ts) instead of Uzbek strings

**Files:**
- Modify: `apps/backend/src/main.ts:5-51` (FIELD_LABELS, translate, flatten, exceptionFactory)

**Interfaces:**
- Consumes: `FIELD_LABEL` catalog (Task 3), the filter (Task 4).
- Produces: `flatten(errors)` returns `Array<{ key: string; params: Record<string, string | number> }>`; the ValidationPipe throws `new BadRequestException(flatten(...))`. The `params.field` is the **localized** field label rendered by the filter... NO — to keep field labels localized, `params.field` carries the bilingual lookup done at render time. Implementation below passes the field **property name** and lets the catalog's field label resolve per language.

- [ ] **Step 1: Replace the translate/flatten block**

Replace `apps/backend/src/main.ts` lines 5-39 (the `FIELD_LABELS`, `label`, `translate`, `flatten` block) with:

```ts
import { FIELD_LABEL } from './i18n/messages.catalog';
import { pickLabel } from '@credit-core/shared';

// class-validator constraint key → catalog key.
const CONSTRAINT_KEY: Record<string, string> = {
  isNotEmpty: 'validation.is_not_empty',
  isString: 'validation.is_string',
  minLength: 'validation.min_length',
  maxLength: 'validation.max_length',
  isEmail: 'validation.is_email',
  isEnum: 'validation.is_enum',
  isInt: 'validation.is_number',
  isNumber: 'validation.is_number',
  isNumberString: 'validation.is_number',
  isBoolean: 'validation.is_boolean',
  min: 'validation.min',
  max: 'validation.max',
};

type ValidationItem = { key: string; params: Record<string, string | number> };

/**
 * Emit {key, params} items; the global I18nExceptionFilter renders them in the
 * request language. We pass `fieldKey` (the raw DTO property) — NOT a pre-rendered
 * label — so the filter can resolve it to the localized field name via FIELD_LABEL
 * at render time (Step 2 below). `n` carries the numeric bound for min/max/length.
 */
function flatten(errors: ValidationError[]): ValidationItem[] {
  const out: ValidationItem[] = [];
  for (const e of errors) {
    if (e.constraints) {
      for (const [ck, raw] of Object.entries(e.constraints)) {
        const key = CONSTRAINT_KEY[ck] ?? 'validation.invalid';
        const n = raw.match(/(\d+)/)?.[1];
        out.push({ key, params: { fieldKey: e.property, ...(n ? { n } : {}) } });
      }
    }
    if (e.children?.length) out.push(...flatten(e.children));
  }
  return out;
}
```

> **Field-label localization:** `params.fieldKey` is the DTO property (e.g. `login`). The catalog templates use `{{field}}`, not `{{fieldKey}}`. So the filter must resolve `fieldKey → localized FIELD_LABEL` before interpolation. Update `render` usage for validation: in `localizeOne` (Task 4 filter), when the item has `params.fieldKey`, add `field = pickLabel(FIELD_LABEL, params.fieldKey, lang)` to the vars. Apply this now.

- [ ] **Step 2: Extend the filter to resolve `fieldKey → field`**

In `apps/backend/src/i18n/i18n-exception.filter.ts`, change `localizeOne` to:

```ts
import { pickLabel, type Lang } from '@credit-core/shared';
import { FIELD_LABEL } from './messages.catalog';
// ...
function localizeOne(msg: unknown, lang: Lang): unknown {
  if (typeof msg === 'string') return render(msg, lang);
  if (msg && typeof msg === 'object' && typeof (msg as ValidationItem).key === 'string') {
    const v = msg as ValidationItem & { params?: Record<string, any> };
    const params = { ...(v.params ?? {}) };
    if (params.fieldKey) params.field = pickLabel(FIELD_LABEL, String(params.fieldKey), lang);
    return render(v.key, lang, params);
  }
  return msg;
}
```

- [ ] **Step 3: Point the ValidationPipe at the new flatten**

The existing `exceptionFactory: (errors) => new BadRequestException(flatten(errors as ValidationError[]))` (main.ts:50) stays as-is — `flatten` now returns the `{key,params}` array. Remove the now-unused `label`/`translate`/`FIELD_LABELS`.

- [ ] **Step 4: Update the filter test for the fieldKey path**

Add to `i18n-exception.filter.spec.ts`:

```ts
it('resolves fieldKey to a localized field label', () => {
  const cap: any = {};
  filter.catch(new BadRequestException([{ key: 'validation.min_length', params: { fieldKey: 'password', n: 6 } }] as any), hostFor('ru', cap));
  expect(cap.body.message).toEqual(['Пароль должен содержать не менее 6 символов']);
});
```

Run: `npm test -- i18n-exception`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/main.ts apps/backend/src/i18n/i18n-exception.filter.ts apps/backend/src/i18n/i18n-exception.filter.spec.ts
git commit -m "feat(i18n): validation emits keys+params, filter localizes field labels"
```

### Task 6: Migrate service throw-sites from Uzbek literals to catalog keys

**Files (replace the literal message with the catalog key; behavior identical):**
- `apps/backend/src/users/users.module.ts`: `Foydalanuvchi topilmadi`→`errors.user_not_found`; `O'zingizni bloklay olmaysiz`→`errors.cannot_block_self`; `Oxirgi faol adminni…`→`errors.last_admin`; `Rasm yuborilmadi`→`errors.no_image`; `Avatar yo'q`→`errors.no_avatar`.
- `apps/backend/src/auth/auth.service.ts`: both `Login yoki parol noto'g'ri`→`errors.bad_credentials`; `Foydalanuvchi topilmadi`→`errors.user_not_found`.
- `apps/backend/src/auth/jwt.strategy.ts`: `Hisob faol emas`→`errors.account_inactive`.
- `apps/backend/src/auth/roles.guard.ts`: `Sizning rolingiz uchun ruxsat yo'q`→`errors.role_forbidden`.
- `apps/backend/src/auth/auth.controller.ts`: `Rasm yuborilmadi`→`errors.no_image`.
- `apps/backend/src/documents/documents.controller.ts`: `Fayl yuborilmadi`→`errors.no_file` (both); `caseId kerak`→`errors.caseId_required`; `Hujjat topilmadi`→`errors.doc_not_found` (all); `Bu hujjatni o'zgartira olmaysiz`→`errors.doc_no_edit`; `Bu hujjatni o'chira olmaysiz`→`errors.doc_no_delete`.
- `apps/backend/src/messages/messages.module.ts`: `Xabar topilmadi`→`errors.msg_not_found` (all); `Ruxsat yo'q`→`errors.forbidden`; `Faqat o'z xabaringizni…`→`errors.msg_only_own`; `Xabar allaqachon o'qilgan…`→`errors.msg_already_read`; `Matn bo'sh bo'lishi mumkin emas`→`validation.is_not_empty` with no field is wrong — use a dedicated key `errors.msg_empty` (add to catalog: `{ uz: 'Matn bo‘sh bo‘lishi mumkin emas', ru: 'Текст не может быть пустым' }`).
- `apps/backend/src/credit-cases/workflow.service.ts`: line 29 `"…" holatida…`→`errors.workflow_not_allowed` — **this has params**; throw `new BadRequestException(JSON.stringify({ key: 'errors.workflow_not_allowed', params: { status: pickLabel(STATUS_LABEL, status, ...), role, decision } }))` will NOT work because the filter parses arrays/keys, not JSON. Instead throw the message as the plain key and pass params via a subclass-free convention: throw `new BadRequestException({ message: { key: 'errors.workflow_not_allowed', params: { status, role, decision } } } as any)`. The filter's `localizeOne` already handles a `{key,params}` object. For the `status`/`role`/`decision` params, pass **enum keys** and resolve them in the filter: extend `renderNotification`-style resolution — simplest: pre-resolve here to localized-independent tokens is impossible, so add these three enum resolutions into `localizeOne` when the key is `errors.workflow_not_allowed` (resolve `status` via STATUS_LABEL, `role` via ROLE_LABEL, `decision` via DECISION_LABEL). Line 34 `Tasdiqlashdan oldin…`→`errors.director_final_required` (no params).
- `apps/backend/src/credit-cases/credit-cases.service.ts`: `Ariza topilmadi`→`errors.case_not_found` (all occurrences); `Faqat qoralama holatidagi…`→`errors.case_only_draft_edit`; `Bu ariza sizga tegishli emas`→`errors.case_not_yours`; `Faqat aktiv bosqichdagi…`→`errors.case_only_active_pause`; `Kamida bitta garov…`→`errors.collateral_required`; `Kredit liniyasi to'liq emas…`→`errors.credit_line_incomplete`; `Foizni faqat moderator…`→`errors.rate_only_mod_admin`; `Faqat moderatsiya bosqichida…`→`errors.rate_only_moderation`; `Bu ariza sizning filialingizga…`→`errors.case_not_your_branch`; `Kredit liniyasi to'ldirilmagan`→`errors.credit_line_empty`; `Foiz {{min}}%…`→`errors.rate_out_of_range` with params `{ min, max }` (use the `{key,params}` object form).
- `apps/backend/src/import/import.module.ts`: `Fayl yuborilmadi`→`errors.no_file`.
- `apps/backend/src/output/case-documents.controller.ts`: `case not found`→`errors.case_not_found`; `unknown document`→`errors.doc_not_found`; `hujjat hali mavjud emas (qoralama)`→`errors.doc_draft_only`.
- `apps/backend/src/settings/settings.module.ts`: `Min yillik foiz Max dan…`→`validation.rate_min_max`.
- `apps/backend/src/katm/katm.module.ts`: `KATM integratsiyasi…`→ return `render('katm.coming_soon', lang)` and `Tez kunda: KATM hisobotlari…`→`render('katm.reports_coming_soon', lang)`. These are returned in a JSON body (not thrown), so add `@Lang() lang` to the handler and call `render(...)` directly (import from `../i18n/render`).
- `packages/shared/src/origination.ts`: `Transh muddati…`→`validation.tranche_max_months` / `Liniya muddati…`→`validation.line_max_months`. These run in shared validation used by the backend; if they throw plain strings consumed by the filter, emit the `{key,params:{max}}` object shape.

**Steps:**

- [ ] **Step 1: Add the two missing catalog keys**

Add to `CATALOG` in `messages.catalog.ts`:
```ts
'errors.msg_empty': { uz: 'Matn bo‘sh bo‘lishi mumkin emas', ru: 'Текст не может быть пустым' },
```

- [ ] **Step 2: Extend `localizeOne` with the workflow enum params**

In `i18n-exception.filter.ts` `localizeOne`, before `render(...)`, add:
```ts
if (v.key === 'errors.workflow_not_allowed') {
  params.status = pickLabel(STATUS_LABEL, String(params.status), lang);
  params.role = pickLabel(ROLE_LABEL, String(params.role), lang);
  params.decision = pickLabel(DECISION_LABEL, String(params.decision), lang);
}
```
Import `STATUS_LABEL, ROLE_LABEL, DECISION_LABEL` from `@credit-core/shared`.

- [ ] **Step 3: Replace each literal with its key** (per the file list above). For the plain-string throws, just swap the string. For the parametrized ones (`errors.rate_out_of_range`, `errors.workflow_not_allowed`, `validation.tranche_max_months`, `validation.line_max_months`), throw the object form:
```ts
throw new BadRequestException({ message: { key: 'errors.rate_out_of_range', params: { min, max } } } as any);
```
(NestJS wraps this; the filter reads `body.message` which is the `{key,params}` object → `localizeOne` renders it.)

- [ ] **Step 4: Verify no Uzbek literals remain in thrown exceptions**

Run: `grep -rnE "throw new [A-Za-z]+Exception\('[^']*[а-яёА-ЯЁ‘’a-z]" apps/backend/src` — should only match keys (dotted, ASCII). Manually scan the output for any leftover natural-language message.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src packages/shared/src/origination.ts
git commit -m "refactor(i18n): backend throws catalog keys instead of Uzbek literals"
```

### Task 7: Persisted deadline notification — Prisma migration + write key+params

**Files:**
- Modify: `apps/backend/prisma/schema.prisma:332-350` (Message model)
- Create: migration via `npx prisma migrate dev --name message_i18n` (generated SQL)
- Modify: `apps/backend/src/deadlines/deadlines.module.ts:72-80`
- Test: `apps/backend/src/deadlines/deadlines.spec.ts` (create — pure builder test)

**Interfaces:**
- Produces: `Message.textKey String?`, `Message.textParams Json?`; a pure helper `buildOverdueNotif(number, status)` returning `{ textKey, textParams, text }`.

- [ ] **Step 1: Add the columns to the Message model**

In `schema.prisma`, inside `model Message` (after `text String? @db.Text`), add:
```prisma
  textKey     String?    // i18n catalog key for system-generated text (null for user messages)
  textParams  Json?      // params for textKey (e.g. { number, status })
```

- [ ] **Step 2: Generate the migration**

Run (Node env): from `apps/backend`, `npx prisma migrate dev --name message_i18n`. Expected: creates `prisma/migrations/<ts>_message_i18n/migration.sql` adding two nullable columns; no data loss. (No Node locally → this runs at deploy; the additive nullable columns are safe.)

- [ ] **Step 3: Write the failing test**

```ts
// apps/backend/src/deadlines/deadlines.spec.ts
import { buildOverdueNotif } from './deadlines.module';

describe('buildOverdueNotif', () => {
  it('stores a key + params and a uz fallback text', () => {
    const n = buildOverdueNotif('A-42', 'MODERATION');
    expect(n.textKey).toBe('notif.deadline_overdue');
    expect(n.textParams).toEqual({ number: 'A-42', status: 'MODERATION' });
    expect(n.text).toContain('A-42'); // uz fallback/preview
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm test -- deadlines`. Expected: FAIL — `buildOverdueNotif` not exported.

- [ ] **Step 5: Implement + use the builder**

In `deadlines.module.ts`, add (module scope, exported) and use it:

```ts
import { pickLabel, STATUS_LABEL, CaseStatus } from '@credit-core/shared';
import { renderNotification } from '../i18n/render';

/** Build the persisted overdue-notification fields: i18n key + params + a uz preview text. */
export function buildOverdueNotif(number: string, status: string) {
  return {
    textKey: 'notif.deadline_overdue',
    textParams: { number, status },
    text: renderNotification('notif.deadline_overdue', { number, status }, 'uz'),
  };
}
```

Then replace lines 72-77 (the `const text = ...` and the `message.create` data) with:

```ts
const notif = buildOverdueNotif(c.number, c.status);
await this.prisma.$transaction([
  ...roles.map((role) =>
    this.prisma.message.create({
      data: { caseId: c.id, senderId: systemId, toRole: role, text: notif.text, textKey: notif.textKey, textParams: notif.textParams, readBy: systemId },
    }),
  ),
  this.prisma.creditCase.update({ where: { id: c.id }, data: { overdueNotified: true } }),
]);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- deadlines`. Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/prisma/schema.prisma apps/backend/prisma/migrations apps/backend/src/deadlines/deadlines.module.ts apps/backend/src/deadlines/deadlines.spec.ts
git commit -m "feat(i18n): persist deadline notification as key+params"
```

### Task 8: Render message text per reader-language on read (`list` + `feed`)

**Files:**
- Modify: `apps/backend/src/messages/messages.module.ts` (add a render helper; use `@Lang()` in `feed` and `list`)
- Test: `apps/backend/src/messages/message-text.spec.ts` (create — pure helper test)

**Interfaces:**
- Produces: `messageText(m: { text: string | null; textKey: string | null; textParams: any }, lang: Lang): string | null` = `m.textKey ? renderNotification(m.textKey, m.textParams, lang) : m.text`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/backend/src/messages/message-text.spec.ts
import { messageText } from './messages.module';

describe('messageText', () => {
  it('renders a system message from its key in ru', () => {
    const t = messageText({ text: 'uz preview', textKey: 'notif.deadline_overdue', textParams: { number: 'A-1', status: 'MODERATION' } }, 'ru');
    expect(t).toBe('Заявка «A-1» на этапе «На модерации» просрочена.');
  });
  it('returns plain text for user messages', () => {
    expect(messageText({ text: 'salom', textKey: null, textParams: null }, 'ru')).toBe('salom');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- message-text`. Expected: FAIL — `messageText` not exported.

- [ ] **Step 3: Implement + wire it**

Add near the top of `messages.module.ts` (module scope, exported):

```ts
import { type Lang } from '@credit-core/shared';
import { renderNotification } from '../i18n/render';

/** Resolve a message's display text: render system (keyed) text per language, else the raw user text. */
export function messageText(m: { text: string | null; textKey: string | null; textParams: any }, lang: Lang): string | null {
  return m.textKey ? renderNotification(m.textKey, m.textParams, lang) : m.text;
}
```

- In `feed()` (add `@Lang() lang: Lang` param; ensure the query `select`/`include` returns `textKey` and `textParams` — `message.findMany` without `select` returns all scalar fields, so `textKey`/`textParams` are present) change `text: m.text` (line ~116) to `text: messageText(m, lang)`.
- In `list()` (add `@Lang() lang: Lang` param) change `text: m.text` (line ~199) to `text: messageText(m, lang)`. `msgInclude` returns full scalar fields, so `textKey`/`textParams` are present.
- Import `Lang` decorator: `import { Lang as LangParam } from '../common/lang.decorator';` — NOTE: the decorator and the `Lang` type share a name. Import the decorator under an alias to avoid the clash: `import { Lang } from '../common/lang.decorator';` and import the **type** as `import type { Lang as LangCode } from '@credit-core/shared';`, then annotate params as `@Lang() lang: LangCode`. Apply this aliasing consistently in this file.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- message-text`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/messages/messages.module.ts apps/backend/src/messages/message-text.spec.ts
git commit -m "feat(i18n): render system message text per request language"
```

### Task 9: Excel export follows request language; PDF + watermark stay Uzbek

**Files:**
- Modify: `apps/backend/src/output/excel-export.util.ts` (add `lang` param; bilingual headers + `pickLabel`)
- Modify: the Excel controller/handler that calls `exportCasesListToExcel` / `exportCaseToExcel` (add `@Lang()` and pass it) — find via `grep -rn "exportCasesListToExcel\|exportCaseToExcel" apps/backend/src`
- Modify: `apps/backend/src/output/documents/doc-layout.ts` (keep watermark Uzbek — no behavior change needed, but the labels are already Uzbek-only and PDFs stay Uzbek, so **leave as-is**)
- Modify: `apps/backend/src/output/excel-export.util.ts` import + PRODUCT_LABEL/STATUS_LABEL usage (lines 2, 22-23) to `pickLabel(..., lang)`

**Interfaces:**
- Produces: `exportCasesListToExcel(rows, lang: Lang = 'uz')`, `exportCaseToExcel(c, lang: Lang = 'uz')`.

- [ ] **Step 1: Parametrize the Excel headers + labels**

In `excel-export.util.ts`:
- Change import to `import { CreditCaseDto, CreditCaseListItem, PRODUCT_LABEL, STATUS_LABEL, pickLabel, type Lang } from '@credit-core/shared';`
- Change signatures to `export async function exportCasesListToExcel(rows: CreditCaseListItem[], lang: Lang = 'uz')` and `export async function exportCaseToExcel(c: CreditCaseDto, lang: Lang = 'uz')`.
- Replace `PRODUCT_LABEL[c.productType]`→`pickLabel(PRODUCT_LABEL, c.productType, lang)` and `STATUS_LABEL[c.status]`→`pickLabel(STATUS_LABEL, c.status, lang)`.
- Make the column headers + the fixed Uzbek strings (`'№'`, `'Qarz oluvchi'`, `'Mahsulot'`, `'Filial'`, `'Holat'`, `"Summa (so'm)"`, `'Yangilangan'`, worksheet name `'Arizalar'`, and the key/value labels + `'Avtotransport'`/`'Uy-joy'`) bilingual with a small local `const L = (uz: string, ru: string) => (lang === 'ru' ? ru : uz);` helper. Example:
```ts
{ header: L('Qarz oluvchi', 'Заёмщик'), key: 'borrower', width: 28 },
```
Translate each header using the glossary + banking terms (e.g. Mahsulot→Продукт, Filial→Филиал, Holat→Статус, Summa (so'm)→Сумма (сум), Yangilangan→Обновлено, Qarz oluvchi→Заёмщик).

- [ ] **Step 2: Pass `@Lang()` from the controller**

In the Excel handler(s), add `@Lang() lang: LangCode` and pass `lang` to the export function. (Alias imports as in Task 8 to avoid the `Lang` name clash.)

- [ ] **Step 3: Verify + commit**

Run: `grep -rn "PRODUCT_LABEL\[\|STATUS_LABEL\[" apps/backend/src` — expect zero direct index accesses remain (all via `pickLabel`). Then:
```bash
git add apps/backend/src/output
git commit -m "feat(i18n): Excel export follows request language; PDFs stay Uzbek"
```

---

## Phase 3 — Frontend localization

### Task 10: `i18n.tsx` — add `tt()` + extend common dict

**Files:**
- Modify: `packages/ui/src/lib/i18n.tsx` (whole file)
- Test: `packages/ui/src/lib/i18n.spec.tsx` (create, if the UI package has a test runner; else verify by build)

**Interfaces:**
- Produces: context adds `tt: (uz: string, ru: string) => string`; keeps `t`, `lang`, `setLang`. Extends `dict` with common tokens used app-wide.

- [ ] **Step 1: Add `tt` to the context + provider**

In `packages/ui/src/lib/i18n.tsx`:
- Extend the context type: `{ lang: Lang; setLang: (l: Lang) => void; t: (k: string) => string; tt: (uz: string, ru: string) => string }` and the default value `tt: (uz) => uz`.
- In `I18nProvider`, add `const tt = (uz: string, ru: string) => (lang === 'ru' ? ru : uz);` and include `tt` in the provider value.
- Extend `dict` with the common reused tokens (add any missing): `common.cancel` `{uz:'Bekor', ru:'Отмена'}`, `common.delete` `{uz:'O‘chirish', ru:'Удалить'}`, `common.edit` `{uz:'Tahrirlash', ru:'Редактировать'}`, `common.close` `{uz:'Yopish', ru:'Закрыть'}`, `common.back` `{uz:'Orqaga', ru:'Назад'}`, `common.next` `{uz:'Keyingi', ru:'Далее'}`, `common.loading` `{uz:'Yuklanmoqda…', ru:'Загрузка…'}`, `common.empty` `{uz:'Ma’lumot yo‘q', ru:'Нет данных'}`.

- [ ] **Step 2: (If a UI test runner exists) test `tt`**

```tsx
// packages/ui/src/lib/i18n.spec.tsx — only if vitest/jest is configured for packages/ui
import { render, screen, act } from '@testing-library/react';
import { I18nProvider, useI18n } from './i18n';
function Probe() { const { tt, setLang } = useI18n(); (globalThis as any).__setLang = setLang; return <span>{tt('Salom', 'Привет')}</span>; }
it('tt reflects language', () => {
  render(<I18nProvider><Probe /></I18nProvider>);
  expect(screen.getByText('Salom')).toBeTruthy();
  act(() => (globalThis as any).__setLang('ru'));
  expect(screen.getByText('Привет')).toBeTruthy();
});
```
If no UI test runner is configured, skip this step and rely on the deploy build + manual verification (Task 15).

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/lib/i18n.tsx packages/ui/src/lib/i18n.spec.tsx
git commit -m "feat(ui-i18n): add tt() inline helper + common dict tokens"
```

### Task 11: `useLabels()` hook consuming bilingual shared labels

**Files:**
- Create: `packages/ui/src/lib/labels.tsx`

**Interfaces:**
- Consumes: `useI18n().lang`; `ROLE_LABEL, STATUS_LABEL, PRODUCT_LABEL, DOCUMENT_LABEL, DECISION_LABEL, DECISION_PAST, pickLabel` from `@credit-core/shared`.
- Produces: `useLabels()` returning `{ role, status, product, doc, decision, decisionPast }` — each `(key) => string` bound to the current language.

- [ ] **Step 1: Implement the hook**

```tsx
// packages/ui/src/lib/labels.tsx
import {
  ROLE_LABEL, STATUS_LABEL, PRODUCT_LABEL, DOCUMENT_LABEL, DECISION_LABEL, DECISION_PAST, pickLabel,
  type Role, type CaseStatus, type ProductType, type DocumentType, type WorkflowDecision,
} from '@credit-core/shared';
import { useI18n } from './i18n';

/** Enum-label accessors bound to the current UI language. */
export function useLabels() {
  const { lang } = useI18n();
  return {
    role: (r: Role) => pickLabel(ROLE_LABEL, r, lang),
    status: (s: CaseStatus) => pickLabel(STATUS_LABEL, s, lang),
    product: (p: ProductType) => pickLabel(PRODUCT_LABEL, p, lang),
    doc: (d: DocumentType) => pickLabel(DOCUMENT_LABEL, d, lang),
    decision: (d: WorkflowDecision) => pickLabel(DECISION_LABEL, d, lang),
    decisionPast: (d: WorkflowDecision) => pickLabel(DECISION_PAST, d, lang),
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/ui/src/lib/labels.tsx
git commit -m "feat(ui-i18n): useLabels() hook for bilingual enum labels"
```

### Task 12: `getErrorMessage` (api-client) — bilingual network/fallback strings

**Files:**
- Modify: `packages/api-client/src/index.ts:50-66`

- [ ] **Step 1: Localize the fallback strings**

At the top of `getErrorMessage`, add `const lang = (typeof localStorage !== 'undefined' && localStorage.getItem('cc_lang')) === 'ru' ? 'ru' : 'uz'; const L = (uz: string, ru: string) => (lang === 'ru' ? ru : uz);` then wrap each hardcoded Uzbek fallback:
- timeout → `L('Server javob bermadi (timeout). Birozdan keyin urinib ko‘ring.', 'Сервер не ответил (таймаут). Повторите позже.')`
- no connection → `L('Serverga ulanib bo‘lmadi. Server ishlamayapti yoki internet aloqasi yo‘q.', 'Не удалось подключиться к серверу. Сервер недоступен или нет соединения.')`
- 401 default → `L('Avtorizatsiya muddati tugadi. Qaytadan kiring.', 'Сессия истекла. Войдите снова.')`
- 403 → `L('Ruxsat yo‘q.', 'Нет доступа.')`
- 500 → `L('Serverda xatolik yuz berdi. Birozdan keyin urinib ko‘ring.', 'Ошибка сервера. Повторите позже.')`
- generic → `L('So‘rovni bajarib bo‘lmadi.', 'Не удалось выполнить запрос.')`
- non-axios fallback → `L('Noma’lum xatolik yuz berdi.', 'Произошла неизвестная ошибка.')`
The server-provided `serverMsg` is already localized by the backend filter — leave it as-is.

- [ ] **Step 2: Commit**

```bash
git add packages/api-client/src/index.ts
git commit -m "feat(i18n): localize client-side network error fallbacks"
```

### Task 13: Migrate enum-label call sites to `useLabels()` (foundation for enum-heavy files)

**Pattern (apply everywhere an enum label is rendered):**
- Add `import { useLabels } from '../lib/labels';` (adjust depth) and, if the file used `ROLE_LABEL`/`STATUS_LABEL`/`PRODUCT_LABEL`/`DOCUMENT_LABEL` from `@credit-core/shared`, remove those specific imports (keep the enum type imports).
- Inside the component: `const L = useLabels();`
- Replace `ROLE_LABEL[x]`→`L.role(x)`, `STATUS_LABEL[x]`→`L.status(x)`, `PRODUCT_LABEL[x]`→`L.product(x)`, `DOCUMENT_LABEL[x]`→`L.doc(x)`.
- For **module-scope** maps that produced label text (`decisionLabel`/`decisionPast` in `CaseView.tsx`/`CaseTimeline.tsx`): delete the local map and use `L.decision(x)` / `L.decisionPast(x)` at render time. Keep language-independent maps (`decisionIcon`, `decisionTone`, `statusDot`, `sendTarget`) at module scope.
- `CaseView.tsx` `transitionLabel` (module scope, uses `ROLE_LABEL` + `decisionLabel`): convert to a render-time function or inline. Concretely, move it inside the component or pass `L`:
```tsx
function transitionLabel(t: { to: CaseStatus; decision: WorkflowDecision }, L: ReturnType<typeof useLabels>) {
  const target = sendTarget[t.to];
  const relabel = t.decision === WorkflowDecision.SUBMIT || t.decision === WorkflowDecision.APPROVE;
  return target && relabel
    ? (lang => lang)   // placeholder — see concrete form below
    : L.decision(t.decision);
}
```
Concrete form (use this): keep `sendTarget` at module scope; inside the component compute
```tsx
const label = (() => {
  const target = sendTarget[t.to];
  const relabel = t.decision === WorkflowDecision.SUBMIT || t.decision === WorkflowDecision.APPROVE;
  return target && relabel ? `${L.role(target)}ga yuborish` : L.decision(t.decision);
})();
```
Note the `…ga yuborish` suffix is Uzbek-grammatical; for ru render it as `Отправить: ${L.role(target)}`. So:
```tsx
const { lang } = useI18n();
return target && relabel
  ? (lang === 'ru' ? `Отправить: ${L.role(target)}` : `${L.role(target)}ga yuborish`)
  : L.decision(t.decision);
```

**Files (enum-label sites only in this task):** `CaseView.tsx`, `CaseTimeline.tsx`, `CaseChat.tsx`, `NotificationsPage.tsx`, `UsersPage.tsx`, `ProfilePage.tsx`, `LoginPage.tsx`, `SettingsPage.tsx`, `AppShell.tsx`, `Dashboard.tsx`, `AnalyticsPage.tsx`, `primitives.tsx` (`StatusBadge`).

- [ ] **Step 1:** For each file above, apply the pattern; delete now-unused `_LABEL` imports; keep enum type imports.
- [ ] **Step 2:** `grep -rnE "ROLE_LABEL\[|STATUS_LABEL\[|PRODUCT_LABEL\[|DOCUMENT_LABEL\[|decisionLabel\[|decisionPast\[" packages/ui/src` → expect **zero** matches.
- [ ] **Step 3: Commit**

```bash
git add packages/ui/src
git commit -m "refactor(ui-i18n): render enum labels via useLabels() (bilingual)"
```

### Task 14: Translate one-off UI strings with `tt()` — by group

For each file, add `const { tt } = useI18n();` (import from `../lib/i18n`) inside the component, and replace each hardcoded Uzbek user-facing string with `tt('<uz original>', '<ru translation>')`. Author RU using the glossary + banking terminology. Do NOT touch dynamic data, `className`, keys, or non-user strings.

**Example (before → after), from `NotificationsPage.tsx`:**
```tsx
// before
<h1 className="…">Bildirishnomalar</h1>
<p className="…">Hamkasblardan kelgan xabarlar va fayllar</p>
// after
<h1 className="…">{tt('Bildirishnomalar', 'Уведомления')}</h1>
<p className="…">{tt('Hamkasblardan kelgan xabarlar va fayllar', 'Сообщения и файлы от коллег')}</p>
```

**Example, from `origination/steps.tsx` (form labels):**
```tsx
<Field label={tt('F.I.O', 'Ф.И.О')}>…</Field>
<Field label={tt('Pasport seriyasi', 'Серия паспорта')}>…</Field>
```

Do the groups as separate commits so a reviewer can gate each:

- [ ] **Step 1 — group `other` + `origination`:** `Dashboard.tsx`, `AnalyticsPage.tsx`, `DeadlineBadge.tsx`, `BranchesPage.tsx`, `CreditCalculator.tsx`, `ChatsPage.tsx`, `origination/steps.tsx`, `origination/OriginationWizard.tsx`, `origination/Summary.tsx`. Commit: `feat(ui-i18n): translate origination + misc pages (uz/ru)`.
- [ ] **Step 2 — group `enum-heavy` one-offs:** `CaseView.tsx`, `CaseChat.tsx`, `UsersPage.tsx`, `SettingsPage.tsx`, `AppShell.tsx`, `ProfilePage.tsx`, `LoginPage.tsx`, `NotificationsPage.tsx`, `CaseTimeline.tsx` relative-time words (`hozir`→`сейчас`, `daqiqa oldin`→`мин. назад`, `soat oldin`→`ч. назад`, `kun oldin`→`дн. назад`). Commit: `feat(ui-i18n): translate case + admin pages (uz/ru)`.
- [ ] **Step 3 — infra/components:** `primitives.tsx`, `DataTable.tsx` (empty/search text), `forms.tsx` (the DatePicker inline error `Noto‘g‘ri sana — kk.oo.yyyy`→`Неверная дата — дд.мм.гггг`, and any placeholder). Commit: `feat(ui-i18n): translate shared components (uz/ru)`.
- [ ] **Step 4 — sweep:** `grep -rnE "[А-Яа-яЁё]" packages/ui/src` should now show RU strings are present; then scan for **remaining hardcoded Uzbek** by reviewing each file's JSX text nodes. Any leftover natural-language Uzbek in a rendered position that is not `tt(...)`/`L.*(...)`/dynamic data is a miss — wrap it. This is a manual read per file (the grep for Cyrillic only confirms RU was added, not that Uzbek is gone).

### Task 15: Verify real-time switching end-to-end

- [ ] **Step 1: Build (deploy/Node env)** — run the workspace type-check/build (`tsc -b` / the repo's build script) and fix any type errors surfaced by the `labels.ts` shape change or the `Lang` name aliasing. This is the authoritative gate given no local Node.
- [ ] **Step 2: Manual — start the app, log in.** Switch language uz↔ru via `LangSwitch`. Confirm, **with no reload**: sidebar, page titles, buttons, table headers, enum badges (status/role/product/doc), and the case timeline all flip instantly.
- [ ] **Step 3: Manual — backend messages.** With language = ru: trigger a validation error (submit an empty required field) and a domain error (e.g. open a case not in your branch); confirm the returned message is Russian. Switch to uz and confirm Uzbek.
- [ ] **Step 4: Manual — persisted notif.** With a system deadline notification present, view it in uz then ru; confirm the same notification renders in each language (key+params path). Confirm a **user-typed** chat message stays exactly as typed in both languages.
- [ ] **Step 5: Commit any fixes** from steps 1-4 with `fix(i18n): …` messages.

---

## Self-Review (author checklist — completed)

- **Spec coverage:** scope boundary (Global Constraints + Tasks 6/8/14 exclusions); hybrid mechanism (Tasks 1,10,11); `tt()` (10); `useLabels`/bilingual labels (1,11,13); reactivity (11,13 render-time + Task 15 manual); X-Language plumbing (2); `@Lang()` (2); catalog (3); exception filter (4); validation keys (5); throw-site migration (6); persisted notif key+params + migration (7,8); PDF uz / Excel lang (9); frontend 23-file migration by group (13,14). All spec sections map to a task.
- **Placeholders:** the Task 13 `transitionLabel` first snippet contains an intentional `// placeholder` that is immediately superseded by the "Concrete form (use this)" block — implement the concrete form. No other TBD/TODO.
- **Type consistency:** `Lang`/`LabelText`/`pickLabel` (Task 1) are used verbatim in Tasks 2,3,4,5,8,9,11; the `Lang` (decorator) vs `Lang` (type) name clash is handled by the aliasing note in Tasks 8/9; `render`/`renderNotification`/`messageText`/`buildOverdueNotif` signatures are consistent across Tasks 3,7,8.
