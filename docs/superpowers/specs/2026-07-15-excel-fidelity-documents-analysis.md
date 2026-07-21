# Excel-Fidelity — Complete Per-Document Analysis

**Date:** 2026-07-15
**Companion to:** `2026-07-15-excel-fidelity-documents-design.md`

Every registry document analyzed against its reference Excel sheet (auto / kvartira /
hovli workbooks). Status legend: ✅ done · 🔧 rebuild · 🔍 verify+fix.
Foundational fixes (Cyrillic sums via `moneyWithWordsCyr`, Russian-month dates via
`dateToRuCyrillic`/`shortDate`, 1.15 line-height, «PULMAKON», `collateralBlock`/value
tables, `partyRequisites`) apply to **all** unless noted.

---

### 1. grafik — Тўлов жадвали ✅ DONE (`4eb439b`)
Compact table (№, санаси dd.mm.yyyy, қолдиқ, асосий/фоизлар*/Жами*), no days/no "so'm",
ИТОГО, 2.4 footnote, two-party requisites + signature. Matches Excel.

### 2. creditApplication — Микроқарз олиш учун АРИЗА ✅ DONE (`69b98a5`)
Full prose form; Cyrillic-word terms; full auto/realty collateral paragraph; polis line
auto-hidden; KATM consent; signature. Matches Excel.

### 3. prikaz — Приказ на сделку 🔧 REBUILD
**Excel:** org header → "…йилдаги №… БУЙРУҒИ" → intro (director orders) → 5 numbered
conditions (shakl / limit-in-words / term / rate+105% / таъминот) → **collateral value
table** (auto: `autoValueTable`+`autoFootnotes`; realty: `realtyValueTable`) → director
signature. **Current:** thin 3-line list, Latin sums. **Action:** rebuild body using the
`_collateral` helpers; Cyrillic sums/dates; `sectionTitle` not needed (numbered lines).

### 4. petition — Ходатайство / МУРОЖААТНОМА 🔧 REBUILD (your "5 bob")
**Excel:** header (CLEVER director) → "Микромолия линиясини очиш тўғрисида / МУРОЖААТНОМА"
→ intro → **5 numbered conditions** (identical shape to prikaz) → insurance-polis line →
"{NAME} қуйидагилардан хабардор қилинган ва розилигини билдирган:" + 4 consent bullets →
"Мурожаатнома санаси: {date}й." → "{NAME} имзо ___". **Current:** thinner form.
**Action:** rebuild with the 5 conditions + collateral (prose) + consent bullets.

### 5. contract — договор узб / Микроқарз шартномаси 🔍 VERIFY+FIX (your items 1-3)
Reference-built already. **Fixes:** fill the **3.1** collateral clause from `collateralBlock`
(currently thin); add the missing **signature spots at 4.x/§7**; **section headings** via
`sectionTitle` (centered, bigger); **final requisites centered** (`partyRequisites` centered);
Cyrillic sums/dates throughout; «PULMAKON» in the parties clause.

### 6. rklGen — РКЛ Ген / Бош келишув 🔍 VERIFY+FIX
Near-complete (7 numbered chapters, all clauses). **Fixes:** «PULMAKON» Савдо белгиси in the
opening parties clause; Cyrillic sums (`moneyWithWordsCyr`) + dates (`dateToRuCyrillic`);
**centered chapter headings** (`sectionTitle`); requisites via `partyRequisites`; title №
from `contractNumber`.

### 7. act — Акт согласования / Далолатнома 🔧 REBUILD
**Excel:** title "…ҚИЙМАТИНИ КЕЛИШИШ ДАЛОЛАТНОМАСИ №" → intro clause → **two valuation tables**
(declared, then agreed value) via `realtyValueTable`/`autoValueTable` + footnotes → agreed-value
prose → 1-/2-/3-тарафдан signatures. **Current:** prose only, no tables, Latin.
**Action:** rebuild with the two tables + Cyrillic.

### 8. obloshka — обложка 🔧 REBUILD (cover page)
**Excel:** org name top → **big centered borrower name** → "№… СОНЛИ … БОШ КЕЛИШУВ" →
Фоиз ставкаси / муддати / линия миқдори → city + date footer. **Current:** thin key-value
table. **Action:** full cover-page rebuild.

### 9. cheklist — перечень 🔧 REBUILD
**Excel:** title "МФЛ бўйича хужжатлар кетма кетлиги" → table (№ т/р | Хужжат номланиши |
Экз сони | Варок) with the **fixed 16-row** document list → "Кредит менежери имзоси: ___".
**Current:** different layout. **Action:** rebuild as the static 16-row checklist table.

### 10-12. monitoring1/2/3 — Акт мониторинга 🔧 REBUILD
**Excel:** "Фуқаро {NAME} билан имзоланган {date}йилдаги №… Бош келишувга асосан … гаровга
кўйилган мол мулкнинг текширув ДАЛОЛАТНОМАСИ" → city+date → inspector clause → **collateral
table** (auto+realty) + footnotes → "келишилган гаров қиймати {sum-in-words}" → "…визуал
текшириши … қониқорли …" → director / Қарздор signatures. Periods 0 / +6 / +12 oy (already
day-clamped). **Action:** rebuild body with `collateralBlock` + Cyrillic; keep period offset.

### 13. protokol — Протокол 🔧 REBUILD (**Latin**, unlike the rest)
**Excel:** "«CLEVER…» MChJ Kredit qo'mitasining yig'ilishi" → "{no} protokolidan ko'chirma"
→ city+date → "KUN TARTIBI:" → "Birinchi masala yuzasidan: … menejeri {NAME}ga {sum}
({words}) so'm … muddati {term} ({words}) oyga … yillik {rate} ({words}) foiz …" →
"Mikroqarz ta'minoti:" + collateral → "QAROR QILADI:" → 6 numbered resolutions incl. the
**garov table** (Nomi | Kadastr | Yashash | Umumiy | Kelishilgan qiymat) + footnotes.
**Action:** rebuild in Latin per the sheet (Cyrillic sums stay Cyrillic in the words, as the
Excel mixes them).

### 14. scoreReport — Score отчет 🔧 REBUILD
**Excel:** header table (Ф.И.Ш / Манзил / Фаолият тури / Кредит тури / лимит-in-words /
муддат / фоиз) → "Скоринг натижаси:" **6 gate rows with standardized verdict phrases**
("Талабларга мос келади" / "Кредит қўмитаси қарорига хавола" / "Талабларга мос келмайди") →
"Скоринг балл {n}" → highlighted "ХУЛОСА {verdict}" → "Кредит менежери имзоси ___".
**Current:** shows computed numbers, extra omillar table, title "НАТИЖАЛАРИ".
**Action:** map stored `ScoringResult` gate results → the standard phrases; title
"НАТИЖА**Д**АЛАРИ"; drop the omillar table; Cyrillic лимит.

### 15. disbursement — Пул ўтказиш аризаси 🔍 VERIFY+FIX
Our own (card transfer request). **Fixes:** Cyrillic sums (`moneyWithWordsCyr`), 1.15
line-height, `DOC_DEFAULT_STYLE`. Already carries full card requisites.

### 16. accountantSplit — Mablag' taqsimoti 🔍 VERIFY+FIX
Our own. **Fixes:** Cyrillic sums, typography defaults. Collateral-aware label already done.

### 17-19. actNotary / prikazNotary / rklGenNotary 🔍 INHERIT
Rebuilt automatically when their base templates (act/prikaz/rklGen) are rebuilt — they call
the same builder with `notary=true` + the notary block. Re-verify after each base rebuild.

---

## STATUS — all documents rebuilt (2026-07-15)

Every document below is rebuilt against its sheet and verified by rendering the PDF and reading it.
Backend suite: **47 suites / 300 tests green** (run with `--runInBand`; the passport OCR spec is
flaky under parallel workers on this machine, not a code fault).

**Objective parity audit** (`excel-parity.spec`, gated on `EXCEL_PARITY=1`): every boilerplate
phrase from each sheet is searched for in the generated document — **156/198 matched**. The
remaining 42 are accounted for, not defects:
- each workbook carries the *other* collateral type's block unfilled (the AUTO book has an empty
  real-estate table and vice-versa) — correctly absent from the matching variant;
- the sample's own names/addresses differ from the fixture;
- the scoring sheet parks its dropdown option lists in helper columns (only the selected verdict prints).

Real divergences the audit caught and that are now fixed: the Микроқарз/Микрокредит product word,
the Russian repayment line in the application, the petition's insurance line, the auto header
asterisks, the sheet's own "стоимонсть" spelling, and the protokol's аннуитетный/дифференцированный
repayment method.

**Known judgement call:** the property workbooks' contract is internally inconsistent (45 cells say
микроқарз, 78 say микрокредит). We print the dominant, consistent wording for the product rather
than reproducing the mixture.

## Execution order (dependency-first)
1. ✅ Foundation · ✅ grafik · ✅ creditApplication
2. **prikaz** → **act** → **obloshka** → **cheklist** (collateral-table + layout heavy; helpers ready)
3. **petition** → **protokol** → **monitoring1/2/3** (prose + tables)
4. **scoreReport** (verdict mapping)
5. **contract** (3.1 fill, signatures, centered requisites) → **rklGen** (trademark, headings)
6. **disbursement** + **accountantSplit** (typography/Cyrillic) → notary variants re-verify

## Verification (per document)
Render via `render-harness` (RENDER_PDFS=1) for auto+kvartira+hovli → open the PDF → diff
cell-by-cell against the Excel sheet → per-template `*.spec.ts` (labels, collateral variant,
sum-in-words, no NaN/GMT, null-safety). Backend suite + 4 web typechecks green before commit.
**No document marked done until it visually matches its Excel sheet.**

## Data notes
All fields exist (schema + wizard). Loader now includes `employment`. `Organization.tradeMark`
= «PULMAKON» (seed backfills). Scoring renders stored `ScoringResult` (no engine). Real org
values (CLEVER, Б.Исмоилов, ANORBANK) are seeded; fixture mirrors them for realistic renders.
