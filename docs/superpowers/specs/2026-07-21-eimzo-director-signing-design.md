# E-IMZO bilan direktor imzosi — dizayn

**Sana:** 2026-07-21
**Holat:** tasdiqlash kutilmoqda

## Muammo

Hozir `DIRECTOR_REVIEW` holatida direktor «Imzolash» tugmasini bosadi
(`packages/ui/src/pages/CaseView.tsx:359`) va ariza `FINALIZED` ga o'tadi. Bu **oddiy status
o'zgartirish** — hech qanday kriptografik imzo yo'q. Hujjatlar esa har so'rovda `DOC_REGISTRY`
dagi sof funksiyalardan qaytadan chiziladi, ya'ni "imzolangan hujjat" degan barqaror baytlar
umuman mavjud emas.

Kerak: direktor **o'z E-IMZO kaliti** bilan hujjat to'plamini imzolasin, imzolangan baytlar
muzlatilsin, va hujjat haqiqiyligini QR orqali tekshirish mumkin bo'lsin.

## Manba

`C:\Users\JONIBEK\Desktop\spravka` loyihasida bu oqim to'liq ishlaydi va sinovdan o'tgan.
Undan quyidagilar olinadi (qayta ixtiro qilinmaydi):

| Spravkadagi manba | Nima beradi |
|---|---|
| `packages/shared/src/ui/eimzo.ts` | E-IMZO websocket klienti (165 qator) |
| `apps/web-rahbar/.../SignDialog.tsx` | 4 bosqichli imzolash dialogi, xato holatlari |
| `apps/web-rahbar/.../route.ts` | prepare/commit/error server oqimi |
| `packages/shared/prisma/schema.prisma` | `CertSignature`, `SignChallenge` modellari |
| `packages/shared/src/ui/CertificateDocument.tsx:279-311` | QR bloki joylashuvi |

## Asosiy qarorlar

Foydalanuvchi tomonidan tasdiqlangan:

1. **Manifest imzolanadi** — 19 ta hujjatga alohida parol emas, bitta parol butun to'plamni qamraydi.
2. **Hujjatlar muzlatiladi** — imzolangandan keyin diskdagi fayl beriladi, qayta chizilmaydi.
3. **QR + INN** hujjat oxirida, spravkadagi joylashuvda.
4. **Ochiq tekshirish sahifasi** backendga qo'shiladi (`/v/<caseId>`), parolsiz.

## Arxitektura

### Imzolash oqimi

```
DIRECTOR bosadi «Imzolash»
   │
   ├─ POST /credit-cases/:id/sign/prepare
   │     19 hujjat render → signed-docs/<caseId>/<key>.pdf
   │     har biriga sha256
   │     manifest = {caseId, contractNumber, signedAt, docs:[{key,file,sha256,bytes}]}
   │     SignChallenge{manifestSha256, userId, expiresAt}
   │     ← {challengeId, manifestBase64}
   │
   ├─ brauzer: loadKey() → E-IMZO o'z parol oynasini ochadi
   │           createPkcs7(manifestBase64, keyId)
   │
   └─ POST /credit-cases/:id/sign/commit {challengeId, pkcs7, signerInfo}
         19 faylni diskdan qayta o'qib sha256 larni hisoblaydi
         manifest qayta quriladi → manifestSha256 challenge bilan mos kelishi shart
         tranzaksiya: CaseSignature + status=FINALIZED + WorkflowEvent + audit
```

**Nega ikki bosqich.** Direktor *baytlarni* imzolaydi, shuning uchun server qaysi baytlarni
bergani aniq bilishi kerak. Bu bo'lmasa klient nimanidir imzolab yuborishi va biz uni arizaga
yozib qo'yishimiz mumkin edi.

**Nega commit da qayta hisoblanadi.** Ikkinchi `prepare` fayllarni almashtirgan bo'lishi mumkin.
Hech kim imzolamagan baytlarga imzo yozilmasligi kerak.

### Manifest formati

Kanonik JSON — kalitlar `DOC_REGISTRY` tartibida, `JSON.stringify` bilan bo'shliqsiz, UTF-8:

```json
{
  "v": 1,
  "caseId": "clx…",
  "contractNumber": "2110 MFL 1416 PS",
  "org": { "name": "МЧЖ «CLEVER…»", "inn": "301456789" },
  "signedAt": "2026-07-21T09:00:00.000Z",
  "docs": [
    { "key": "petition", "file": "petition.pdf", "sha256": "a1b2…", "bytes": 48213 }
  ]
}
```

`signedAt` — `prepare` vaqti. U manifest ichida, ya'ni imzo qamrovida.

### Ma'lumotlar modeli

```prisma
/// Direktorning E-IMZO imzosi — bitta arizaga bitta.
model CaseSignature {
  id             String     @id @default(cuid())
  case           CreditCase @relation(fields: [caseId], references: [id], onDelete: Cascade)
  caseId         String     @unique
  /// base64 PKCS#7/CMS, manifest ichiga biriktirilgan holda.
  pkcs7          String     @db.LongText
  /// Imzolangan manifestning o'zi — nima imzolangani keyin ham ko'rinsin.
  manifest       Json
  manifestSha256 String
  /// Faqat E-IMZO-SERVER haqiqatan tekshirgandagina true. Klient hech qachon o'rnatmaydi.
  verified       Boolean    @default(false)
  verifiedAt     DateTime?
  /// Ishonchsiz, ma'lumot uchun: klient aytgan kalit nomi/aliasi.
  signerInfo     Json?
  signedBy       User       @relation(fields: [signedById], references: [id])
  signedById     String
  createdAt      DateTime   @default(now())
}

/// Render qilingan, lekin hali imzolanmagan to'plam.
model CaseSignChallenge {
  id             String   @id @default(cuid())
  caseId         String
  /// So'ragan direktor. Faqat o'zi yakunlay oladi.
  userId         String
  manifestSha256 String
  expiresAt      DateTime
  createdAt      DateTime @default(now())

  @@index([caseId])
  @@index([expiresAt])
}
```

`CreditCase` ga qo'shiladi: `signedAt DateTime?`, `docsFrozenAt DateTime?`.

TTL: **10 daqiqa** — bitta odam bitta parol kiritadigan vaqt.

### Fayl saqlash

`UPLOAD_DIR/signed-docs/<caseId>/<key>.pdf` — mavjud `StorageService`
(`apps/backend/src/documents/storage.service.ts`) naqshiga ergashadi.

`GET /credit-cases/:id/documents/:key/pdf`:
- ariza imzolangan bo'lsa → diskdagi fayl oqim bilan beriladi
- aks holda → hozirgidek `DOC_REGISTRY[key].build(c)` dan chiziladi

Muvaffaqiyatsiz imzolashda (`sign/error`) fayllar o'chiriladi — imzolanmagan, lekin
rasmiylashtirilgandek ko'rinadigan PDF diskda qolmasin. Ariza allaqachon `FINALIZED` bo'lsa
o'chirilmaydi: u chiqarilgan hujjat.

### QR + INN bloki

Yangi umumiy funksiya `apps/backend/src/output/documents/verification-block.ts`:

```
────────────────────────────────────────────────
                    Ҳужжат ҳақиқийлигини текширинг   ▓▓▓▓▓
                    QR кодни сканерланг              ▓▓▓▓▓   22mm
                    МЧЖ «CLEVER…»  ИНН: 301456789    ▓▓▓▓▓
```

- O'ngga tekislanadi, ustida `0.5pt` ingichka chiziq — spravkadagi joylashuv.
- Matn 8pt, kulrang; QR 22mm, `errorCorrectionLevel: 'Q'` (muhr yoki buklanish qismini yopsa ham
  o'qiladi).
- `qrcode` npm paketi qo'shiladi, PNG data-URL sifatida `pdfmake` ga beriladi.
- **Faqat imzolangan hujjatda chiqadi.** Imzosiz holatda QR hech qayerga olib bormaydi — spravka
  aynan shu sababdan `NEXT_PUBLIC_PUBLIC_URL` yo'q bo'lsa render qilishdan bosh tortadi. Bizda
  ham `PUBLIC_VERIFY_URL` o'rnatilmagan bo'lsa, prod da imzolash **xato beradi**, localhost ga
  ishora qiluvchi QR bosib chiqarilmaydi.

Barcha 19 shablonga qo'shiladi — `DOC_REGISTRY` darajasida o'raladi, har bir shablonni alohida
tahrirlamaslik uchun.

### Ochiq tekshirish sahifasi

`GET /v/:caseId` — autentifikatsiyasiz, backend server-rendered HTML qaytaradi.

Ko'rsatiladi:
- shartnoma raqami, imzo sanasi
- imzolagan tashkilot: nomi + **INN**
- direktor F.I.Sh.
- 19 hujjat ro'yxati, har birining sha256 i
- imzo holati

**Ko'rsatilmaydi:** PINFL, passport, qarz oluvchi F.I.Sh., summa, garov — hech qanday shaxsiy yoki
tijorat ma'lumoti. Sahifa faqat «bu hujjat to'plami shu tashkilot tomonidan imzolangan» degan
faktni tasdiqlaydi.

Ariza bekor qilingan yoki o'chirilgan bo'lsa — tekshirish to'xtaydi.

### UI

`packages/ui/src/components/SignDialog.tsx` — spravkadan ko'chiriladi:

- kalit tanlash ro'yxati (E-IMZO barcha disklardan, fleshkadan ham o'zi topadi)
- 4 bosqichli indikator: *Hujjat tayyorlanmoqda → Parol kutilmoqda → Imzolanmoqda → Saqlanmoqda*
- «Parol kutilmoqda» bosqichida ogohlantirish: E-IMZO parol oynasi **alohida oyna** qilib ochiladi
  va brauzer ortida qolib ketishi mumkin. Spravkada ikkita real urinish aynan shu sababdan
  «Ввод пароля отменен» bilan tugagan.
- ikkita xato holati aniq ajratiladi:
  - `not-running` — E-IMZO ochilmagan. **Foydalanuvchi hal qiladi.**
  - `domain-denied` (-1022) — E-IMZO ishlayapti, lekin domenga NIC dan API-KEY olinmagan.
    **Biz hal qilamiz.** «Qayta tekshirish» tugmasi ataylab yo'q — qayta urinish yordam bermaydi.
- bekor qilish (`Ввод пароля отменен`) xato sifatida qizil ko'rsatilmaydi — bu nosozlik emas.

`CaseView.tsx:359` dagi tugma shu dialogni ochadi.

## Halollik cheklovi

O'zDSt 1092:2009 imzosini **tekshirish** uchun E-IMZO-SERVER va NIC bilan shartnoma kerak —
bizda yo'q. Shuning uchun:

- `CaseSignature.verified` doim `false` bo'lib yoziladi.
- UI imzoga tayanib «tasdiqlangan» demaydi. `docBadgeForStatus` dagi «Tasdiqlangan» — bu
  **workflow holati** (`FINALIZED`), imzo haqiqiyligi haqidagi da'vo emas. Shundayligicha qoladi.
- Imzolash dialogida va tekshirish sahifasida ochiq yoziladi: imzo saqlanadi va uchinchi tomon
  uni tekshira oladi, lekin biz hozircha tekshirmaymiz.

Bu spravkadagi bilan bir xil pozitsiya va ataylab shunday.

## Xavfsizlik

- Kalit ham, parol ham brauzerga ham, serverga ham **tushmaydi**. E-IMZO ular bilan
  foydalanuvchining o'z mashinasida ishlaydi; bizga faqat tayyor PKCS#7 keladi. Bu dizaynning
  xossasi, bizning va'damiz emas.
- `signerInfo` — ishonchsiz kirish. Klient nima desa shuni yozadi; u faqat odam ko'rishi uchun,
  hech narsa hal qilmaydi.
- Challenge faqat uni so'ragan direktorga tegishli va faqat bir marta ishlaydi.
- Har bir urinish — muvaffaqiyatli ham, muvaffaqiyatsiz ham — audit logga tushadi. Aks holda
  «imzolanmayapti» degan direktor va serverda hech qanday iz qolmagan holat yuzaga keladi.

## Sinov

- `manifest.spec.ts` — kanonik JSON barqarorligi, sha256 hisobi, hujjat tartibi
- `sign-flow.spec.ts` — prepare/commit, mos kelmagan sha256 rad etilishi, muddati o'tgan challenge,
  boshqa foydalanuvchining challenge i
- `verification-block.spec.ts` — QR faqat imzolangandan keyin, INN chiqishi, `PUBLIC_VERIFY_URL`
  yo'q bo'lsa prod da rad etish
- `frozen-docs.spec.ts` — imzolangandan keyin diskdagi fayl beriladi, ma'lumot o'zgarsa ham
  bir xil baytlar qaytadi
- Mavjud 302 test yashil qolishi shart

## Bu ish qamroviga kirmaydi

- Imzoni haqiqiy tekshirish (E-IMZO-SERVER, NIC shartnomasi)
- Prod domen uchun API-KEY olish — bugungacha rejim `Режим разработчика` bilan aylanib o'tiladi,
  buning nimani ochib qo'yishi `deploy/README.md` da yoziladi
- Moderator yoki operator imzosi — faqat direktor

## Imzoni qaytarib olish

Qaytarib olinmaydi, va bu yangi cheklov emas: `packages/shared/src/workflow.ts` da `FINALIZED`
dan chiqadigan **birorta ham** o'tish yo'q — na `REOPEN`, na `CANCEL`. Ariza imzolangach yopiladi.

Imzo shu holatni kuchaytiradi, o'zgartirmaydi: imzolangandan keyin hujjatlar diskda muzlatiladi
va qayta chizilmaydi. Xato imzolangan ariza yangi ariza sifatida qayta kiritiladi — bu qog'oz
jarayonining o'zi bilan bir xil.
