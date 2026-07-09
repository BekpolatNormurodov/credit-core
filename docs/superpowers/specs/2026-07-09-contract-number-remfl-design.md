# Feature A — Shartnoma raqami (auto) + "Qayta MFL lash"

**Sana:** 2026-07-09
**Holat:** Dizayn tasdiqlash bosqichida
**Qamrov:** Faqat Feature A. Feature B (sug'urta 2%/4% muddat bracketlari, 80/20 summa taqsimi, "Ariza xati", buxgalter ko'rinishi) — **alohida spec**.

---

## 1. Muammo / maqsad

Hozir operator shartnoma raqamini (`12 MFL 42 PS`) **qo'lda** yozadi. Kerak:

1. Shartnoma raqamini **avtomatik** generatsiya qilish — ariza **moderatorga yuborilganda** (DRAFT → MODERATION).
2. Takroriy mijozlar uchun **"Qayta MFL lash"** oqimi: mijozni qidirib topib, uning MFL identifikatorini saqlagan holda yangi ariza ochish.

Bu raqam mavjud `CreditCase.number` (`BR-2026-0001` = **ariza id**) dan **butunlay boshqa** narsa. Ariza id yaratilishda beriladi va o'zgarmaydi; shartnoma raqami submit'da beriladi.

## 2. Raqam tuzilishi

Format: **`{GLOBAL} MFL {YILLIK} {FILIAL}`** — masalan `2012 MFL 1320 PS`.

| Qism | Misol | Qoida |
|------|-------|-------|
| GLOBAL | `2012` | Kompaniya bo'yicha **yagona**, hech qachon nollanmaydi, har shartnomada +1 |
| `MFL` | `MFL` | O'zgarmas literal |
| YILLIK | `1320` | Kompaniya bo'yicha **yagona**, **har kalendar yil boshida 0 dan** boshlanadi, har yangi mijoz shartnomasida +1. Bu qiymat "Liniya № (РКЛ)" bilan bir xil |
| FILIAL | `PS` | Ariza filialining simvoli (`Branch.symbol`, mavjud `@unique`) |

Ikkala hisoblagich ham kompaniya bo'yicha yagona; filial simvoli — faqat teg (`912 BR` keyin `913 PS` — ketma-ket).

## 3. Ma'lumot modeli (Prisma)

### 3.1 Yangi jadval — atomik hisoblagichlar
```prisma
model ContractCounter {
  id    String @id   // "global" yoki yil: "2026"
  value Int    @default(0)
}
```
- `"global"` qatori — global hisoblagich.
- `"<yil>"` qatori — o'sha yil hisoblagichi (birinchi murojaatда upsert bilan yaratiladi → avtomatik nollanish).

### 3.2 CreditCase'ga qo'shiladigan maydonlar
```prisma
contractGlobalNo  Int?
contractYearlyNo  Int?
contractBranchSym String?
contractNumber    String?  @unique   // "2012 MFL 1320 PS"
isReMfl           Boolean  @default(false)
reMflSourceId     String?            // Qayta MFL manba shartnoma (CreditCase.id)
```
DRAFT'da hammasi bo'sh. `contractNumber` unique — takrorlanmaydi.

## 4. Raqam berish mantiqi (SUBMIT: DRAFT → MODERATION)

Workflow transition ичida, `WorkflowDecision.SUBMIT` + `DRAFT → MODERATION` bo'lganda, **bitta tranzaksiyada**:

1. Agar `case.contractNumber` allaqachon bor bo'lsa (qaytarilib, qayta yuborilsa) → **saqlanadi**, qayta bermaydi.
2. Aks holda:
   - `global = increment("global")` — atomik (`update ... { value: { increment: 1 } }`, yangi qiymat qaytariladi).
   - **Yangi mijoz** (`isReMfl = false`): `yearly = increment("<joriy_yil>")` (yil qatori yo'q bo'lsa upsert bilan 1 dan), `branchSym = case.branch.symbol`.
   - **Qayta MFL** (`isReMfl = true`): `yearly = source.contractYearlyNo`, `branchSym = source.contractBranchSym` — **yillik oshmaydi**.
   - `contractNumber = \`${global} MFL ${yearly} ${branchSym}\``.
3. Maydonlar case'ga yoziladi.

**Poyga xavfsizligi:** hisoblagich `increment` DB satr-blokировkаsi ostida atomik — bir vaqtdagi submitlar bo'shliq/kolliziyasiz ketma-ket raqam oladi.

**Yil nollanishi:** submit vaqtidagi kalendar yil (`getFullYear()`) bo'yicha `"<yil>"` qatori ishlatiladi.

## 5. "Qayta MFL lash" oqimi

### 5.1 Sahifa
- **Yangi sahifa/route: "Qayta MFL"** — faqat **operator + admin** ko'radi.
- Qidiruv maydoni: F.I.O / passport (seriya+raqam) / PINFL / telefon.

### 5.2 Backend qidiruv
- Endpoint: mijozlarni (borrower) yuqoridagi mezonlar bo'yicha qidiradi.
- Har mos mijozning **oldingi shartnomalari ro'yxati** qaytariladi, har biri uchun: `contractNumber` (913 PS), **status**, **sana**, **summa** (amountTotal), F.I.O.

### 5.3 Tanlash va yaratish
- Operator ro'yxatdan **aniq bitta oldingi shartnomani** tanlaydi (har xil case bo'lgani uchun — status/sana/summa ko'rinadi).
- Yangi DRAFT ochiladi va **ko'chiriladi**: shaxsiy ma'lumot (F.I.O, passport, PINFL, telefon, manzil, yaqin kishilar). `isReMfl = true`, `reMflSourceId = <tanlangan case id>`.
- Moliyaviy qismi (summa, garov, sug'urta, ish) **bo'sh** — yangidan.
- Passport o'zgargan bo'lsa qayta skaner qilinadi (mavjud PassportScan).
- Submit'da §4 bo'yicha: global oshadi, yillik+filial manbadan saqlanadi.

## 6. UI o'zgarishlari

- **Step 3 (Liniya)** raqam maydonlari:
  - "Liniya № (РКЛ)" → `contractYearlyNo`, **avto, read-only** (DRAFT'da "—", submit'dan keyin to'ladi).
  - To'liq shartnoma raqami "2012 MFL 1320 PS" → `contractNumber`, **avto, read-only**.
  - Hozirgi **qo'lda** kiritish (lineNumber/orderNumber) olib tashlanadi.
- Hujjatlarда (contract, credit-application) to'liq `contractNumber` ko'rsatiladi.
- **Qayta MFL** sahifasi operator+admin web ilovalariga qo'shiladi.

## 7. Chekka holatlar / qarorlar

- **Yillik kolliziya:** takroriy mijoz eski yillik raqamini (913) saqlaydi. Kelasi yili yangi mijoz ham 913 ga yetishi mumkin → "913 PS" ikki mijozda uchrashi mumkin. Lekin **to'liq raqam GLOBAL tufayli yagona** (`3001 MFL 913 PS` ≠ `1500 MFL 913 PS`). Yillik raqam — mijozning MFL-identifikatori, global — unikal shartnoma raqami. Bu **maqbul** deb qabul qilingan.
- **Filial o'zgarishi:** takroriy mijoz boshqa filialda qayta olsa ham, saqlanadigan filial simvoli **manba shartnomadan** olinadi.
- **Qaytarish (RETURN):** ariza moderatordan qaytarilib, qayta yuborilsa — raqam **qayta berilmaydi** (bir marta).
- **Mavjud `number` (ariza id):** o'zgarmaydi, alohida qoladi.

## 8. Test rejasi (yuqori daraja)

- Hisoblagich: birinchi submit → global=1, yearly=1; keyingi → 2,2; yil o'zgarsa yillik 1 dan, global davom.
- Qayta MFL: manba `1022 MFL 913 PS` → yangi submit `{next_global} MFL 913 PS`, yillik oshmaydi.
- Qayta submit (RETURN'dan keyin) raqamni o'zgartirmaydi.
- Unique cheklov: `contractNumber` takrorlanmaydi.
- Qidiruv: passport/PINFL/telefon/F.I.O bo'yicha topadi, status+sana+summa qaytaradi.

## 9. Qamrovdan tashqari (keyingi spec/feature'lar)

Avval Feature A tugatiladi (spec → reja → code), keyin quyidagilar navbat bilan:

- **Feature B** — Sug'urta muddat bracketlari: ≤2 yil → 2%, 2–4 yil → 4% (hozirgi 2%/yil o'rniga); 80/20 summa taqsimi tafsilotlari; buxgalter ko'rinishi.
- **Feature C — Hujjatlar generatsiyasi (director "Imzolash")** — Director ko'rigida **fayl biriktirmaydi**, **"Imzolash"** tugmasini bosadi → quyidagi hujjatlar to'plami **PDF** qilib avto generatsiya bo'ladi. Bosilganda **"Generatsiya bo'lyapti…"** xabari ko'rsatiladi. Bu hozirgi "yakuniy fayl biriktirish shart" talabini **almashtiradi**. Mijoz tasdiqlangach hujjatlarni (ayniqsa Ходатайство/Ariza xati) ochib/print qilib, 2–3 joyda qo'lda imzolaydi.
  Hujjatlar (mavjud DOC_REGISTRY + SP-6 tizimida):
  1. **Ходатайство** (Ariza xati / murojaatnoma) — *mavjud (petition.ts)*
  2. **Протокол** (qo'mita protokoli) — *yangi*
  3. **РКЛ Ген** (bosh kelishuv liniyasi shartnomasi) — *yangi* (matn: "…ушбу Келишувнинг ажралмас қисми…")
  4. **Score отчет** (skoring hisoboti) — *yangi*
  5. **Акт согласования** (kelishuv/baholash akti) — *mavjud (pdf.service valuationAct)*
  6. **Приказ** (buyruq) — *yangi*
  Har hujjatning aniq mazmuni/bo'limlari Feature C spec'ida (eski namunalardan olinadi).
- **KATM required** — Step 5 (KATM) maydonlari **majburiy** bo'ladi, bazaga yoziladi, "yashil galochka" mantiqiga qo'shiladi.
- **To'lov sanasi — ish kuni moslashuvi** — Har oylik to'lov sanasi dam olish (Sha/Ya) yoki O'zbekistonning 8 ta doimiy bayramiga (1-yan, 14-yan, 8-mar, 21-mar, 9-may, 1-sen, 1-okt, 8-dek) tushsa → **keyingi ish kuniga** suriladi. Mavjud `business-days.ts` faqat dam olishni biladi; 8 bayram qo'shiladi (yalpi holiday ro'yxati + `isHoliday`). Faqat to'lov sanalariga qo'llanadi (SLA'ga emas).
