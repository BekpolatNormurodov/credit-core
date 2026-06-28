# credit-core

Garov (collateral) kredit ishlari tizimi — **4 web (rol bo'yicha) + 1 backend**, bitta monorepo.
Oqim: **Operator → Moderator → [Zam ixtiyoriy] → Director → Admin**. Mahsulot: uy-joy (ko'chmas mulk).

## Struktura
- `apps/backend` — NestJS + Prisma + MySQL
- `apps/web-operator|web-moderator|web-director|web-admin` — React + Vite + Tailwind
- `packages/shared` — umumiy enum/tip + workflow qoidalari
- `packages/ui` — umumiy komponentlar + `RoleApp` (shadcn-uslub + Framer Motion)
- `packages/api-client` — tiplangan API klient
- `deploy/` + `docker-compose.yml` — nginx + subdomenlar (prod)

## Lokal ishga tushirish (Docker'siz, lokal MySQL80)
```bash
cp .env.example apps/backend/.env      # DATABASE_URL ni MySQL parolingiz bilan to'g'rilang
npm install
npm run build -w @credit-core/shared   # backend uchun shared dist
npm run db:generate                    # prisma client
npm run db:migrate                     # jadvallarni yaratadi (MySQL'da credit_core bazasi)
npm run db:seed                        # 4 rol useri + "BR" filiali
npm run dev                            # backend + 4 web (concurrently)
```

Portlar: backend `3000`, operator `5173`, moderator `5174`, director `5175`, admin `5176`.

## Seed loginlar (parol: `parol123`)
`operator`, `moderator`, `director`, `admin`

## Oqim
1. **Operator** (5173): qo'lda forma yoki **Excel import** → hujjat yuklash → Yuborish.
2. **Moderator** (5174): Tasdiqlash / Qaytarish.
3. **Director** (5175): yakuniy hujjat yuklash → Tasdiqlash.
4. **Admin** (5176): KATM narx → PDF (Akt) generatsiya → Excel eksport → Yakunlash.

KATM integratsiyasi — hozir UI placeholder ("tez kunda").
