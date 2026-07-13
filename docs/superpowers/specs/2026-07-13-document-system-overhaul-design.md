# Spec C — Document System Overhaul (14 generated + notary + scanned + accountant)

**Date:** 2026-07-13
**Status:** Design in progress → 2 open items flagged inline (see §11)
**Scope:** The third and largest of three specs (A: wizard fixes — done; B: workflow/permissions; C: this). Rebuild the document system so every dossier document is complete, correct, and printable by role.

**Grounding:** Two workflow analyses back this spec — (1) a deep read of the 8 existing pdfmake templates + data model (current state), and (2) a page-by-page extraction of a real 40-page signed dossier (`joldibayev`, borrower JOLDIBAYEV R.M., 45M so'm) giving the *ideal* filled form for each document. Findings are cited throughout.

---

## 1. Goal

- **Fix** the 8 existing templates — all are currently incomplete ("formalar chala, ko'p qatorlar tushib qolgan") and several have correctness bugs.
- **Add** the missing documents so the generated set is complete.
- **Add** notary variants, mandatory/optional upload slots, and the accountant packet.
- **Extend** the data model so documents render real data (no fabricated placeholders).
- Every document is **viewable + printable** by operator / moderator / director, with correct **stage-gating**.

## 2. The complete document set

### 2a. Generated documents (we build/fix templates)

| # | Document | Current | Action |
|---|---|---|---|
| 1 | Murojaatnoma | `petition.ts` | fix (incomplete) |
| 2 | Bosh kelishuv / RKL Gen | `rkl-gen.ts` | fix (missing clauses, notary block) |
| 3 | Skoring tahlil | `score-report.ts` | **fix — has correctness bug** |
| 4 | Akt soglasovaniya (garov qiymatini kelishish) | `act.ts` | fix (hardcoded act №, no per-collateral value) |
| 5 | Prikaz na sdelku | `prikaz.ts` | fix (wrong № source, Latin date bug) |
| 6 | Shartnoma (dogovor) | `contract.ts` | **fix — only 3 of ~12 articles; float-garbage rates** |
| 8 | Grafik (to'lov jadvali) | NONE | **new** — 30+ row amortization table |
| 9 | Obloshka (muqova) | NONE | **new** — dossier cover sheet |
| 10–12 | **Monitoring aktlari ×3** | NONE | **new** — dates = ariza sanasi, +6 oy, +12 oy |
| 11 | Dalolatnoma (alohida) | NONE | **new** — ⚠️ content pending (see §11) |
| 13 | Cheklist | NONE | **new** — required-docs checklist |
| 14 | Pul o'tkazish arizasi (disbursement) | NONE | **new** — bank requisites |
| — | Buxgalteriya 35/20/15 varaq | NONE | **new** — amount-split sheet |

> **#11 vs #4:** confirmed by the user as **separate** documents (the real bundle's "Далолатнома №1" on p21 is the #4 valuation-agreement act; #11 is a different dalolatnoma whose content still needs a sample — §11).
> **Monitoring:** the earlier "#10 one-off + #12 ×3" collapses to **exactly 3 generated acts**, dated `applicationDate + {0, 6, 12} months`, each filled with case data (garov, borrower, credit) + manual signature/finding lines. They render **consecutively** in the docs UI. One parameterised template, 3 outputs.

### 2b. Uploaded documents (not generated)

| Document | Rule | Stage |
|---|---|---|
| **#7 KATM hisoboti** | **MANDATORY upload by operator** — blocks submit if absent | operator / DRAFT |
| Garov shartnoma (notarial) | optional upload slot | after director approval, end |
| Taqiq kartochka | optional upload slot | after director approval, end |
| Opshiy dela (passport/ID/tex set) | optional upload slot | after director approval, end |
| Sug'urta polisi, Memorial order (bundle extras) | optional supporting uploads | any (out of core scope) |

### 2c. Notary variants (generated, post-approval)

3 notary-formatted renders of existing templates — **not new documents**: Akt soglasovaniya (#4), Prikaz na sdelku (#5), Bosh kelishuv (#2). Same source data + an appended **notary attestation block** (notary name/license, reyestr №, place+date of notarial act, notary signature + seal «М.У.» placeholder) and party passport/PINFL identification. Gated to **after director approval**; rendered on demand.

## 3. Data model changes

Extend `loadCaseForDocs` (`case-document.loader.ts`) — several documents are impossible without these relations:
- `creditLine.tranches.schedule.installments` (Grafik)
- `employment`, `guarantors`, `createdBy` (application, cover, contract)
- `documents` (Cheklist, upload slots)
- `valuationAct` (Akt actNo/actDate/agreedValue/agreedValueWords)

New fields / models:
- **Disbursement bank requisites** (doc #14) — new `DisbursementDto`/fields: `holderName`, `cardNumber` (16), `accountNumber` (Х/Р, 20), `bankMfo` (МФО), `holderInn` (ИНН), `bankName`. Defaulted from borrower **only when the holder is the borrower** (the real bundle's pledgor was a third party — never assume borrower = account holder).
- **`loanPurpose`** field on `CreditCase`/`CreditLine` (application + contract need "kredit maqsadi"; no field today).
- **35/20/15 amounts** — an amount split (kredit summasi / mol-mulk / sug'urta), sourced from the line split (`amountAuto`/`amountPolis`) + insured sum. Confirm exact 3 lines (§11). Likely no new column if derived from existing amounts; add explicit fields only if the split is entered independently.
- **Monitoring** — no heavy new model; the only captured datum is the base date (`applicationDate`), the 3 dates are derived (+0/+6/+12 mo). Manual findings/signature are print-time blanks. (A `MonitoringAct` model can be added later if inspector/findings must be stored.)
- **`amount-in-words`** for the loan — add `principalWords` (or generate at render via `sumToWordsUz`); today only collateral value has a `*Words` field (wrong quantity).

## 4. Shared components (build once, reuse)

The real bundle shows the same blocks repeated verbatim across every document. Model each once:
- **Org/lender requisites block** — CLEVER «PULMAKON», address, Х/Р, МФО (ANORBANK 01183), СТИР, tel, director Б.Исмоилов, license. From `Organization` (extend if fields missing: `inn`, `licenseNo/Date`, `directorFull`, `legalBasis`). Unify the `'МКО'/'ММТ'` fallbacks with `orgHeader`.
- **Borrower block** — one canonical entity (FIO, DOB, passport+issuer+date, PINFL, address, phones).
- **Pledgor block** — collateral owner(s) as a distinct party (`owners[]`: FIO, passport, PINFL, share) — may differ from the borrower.
- **Signature block** = a **role list** (`whoSigns`), not one signer. Patterns seen: lender+borrower; lender+borrower+pledgor; notarial four-party; single credit-manager; single client.
- **Seal placeholder** — round seal overlaps lower-left (lender/director) signature; «М.У.» for notary.
- **Money-in-words** — `sumToWordsUz` used consistently for every amount that has a words line.
- **Status watermark** — apply the existing `watermarkForStatus` to all docs.
- **Cyrillic date formatter** — `dateToUzbekWords`; never emit Latin dates inside a Cyrillic document, never duplicate "yil/йил".

## 5. Cross-cutting fixes (apply to all templates)

1. **No fabricated defaults.** Remove every `term ?? 60`, `rate ?? 55%`, `penalty ?? 105%`, `lineDate ?? today()` (petition/prikaz/protokol/score-report/rkl-gen). Missing → render blank **or** block generation. Fake terms on a legal document are unacceptable.
2. **Round rates** — `Math.round` on all `rate*100`/`penalty*100` (contract.ts:26-27 currently prints `55.00000000000001%`).
3. **Guard empty collateral** — never render a zeroed "TA'MINOT (GAROV)" section (also see Spec A backend guard).
4. **Real economics** — use the actual `interestRate` (director-set), `termMonths`, `lineDate`, `orderNumber`/`lineNumber`; state both term framings where they legitimately differ (contract term vs line term).

## 6. Per-document detail (fixes to the 7 kept templates)

- **#3 Skoring (HIGHEST PRIORITY — correctness bug):** 5 of 7 gate rows are hardcoded to "Талабларга мос келади" regardless of data — a **rejected** case currently prints all gates passing. Replace with real per-gate verdict logic from `affordability` + `creditHistory` + `scoring` fields. Render the loaded-but-unused **20-factor `scoring.factors[]`** table. Fix `VERDICT_LABEL` to the real enum (`APPROVED/REFER_COMMITTEE/BELOW_MIN/FAILED_INCOME/FAILED_PROBLEM_LOANS`). Add case №/PINFL/passport/branch + DTI/credit-history rows. Guard null scoring (don't render "all OK").
- **#6 Shartnoma:** author the missing contractual body (rights/obligations, disbursement & repayment procedure, interest accrual, liability, force-majeure, dispute resolution, validity, copies-count). Add monthlyPayment/paymentDay/maturity + schedule (Grafik) reference rows. Use `_shared.collateralDetails()`. Fill org (inn/address/license) + borrower (address/phone/birth/issuer) blocks. Named+dated signatures with director/legalBasis + seal. Add guarantor + insurance sections. Requisites/seal on the final page (contract spans multiple pages).
- **#1 Murojaatnoma:** drop fabricated fallbacks; add applicant-identity block; replace thin collateral line with `collateralDetails()`; render loanType/lineNumber + insurance detail.
- **#2 Bosh kelishuv:** author missing clauses (2.5-2.7, 3.2-3.3, 5.2/5.4, force-majeure/notices); fix the insurance clause-numbering collision; drive insurance text from `InsurancePolicy`; enrich collateral clauses + owners; fill requisites; add guarantors + notary attestation + watermark.
- **#4 Akt soglasovaniya:** load `ValuationAct`; use real `actNo/actDate/agreedValue/agreedValueWords` (not hardcoded `№1`/today/recomputed total); per-collateral agreed-value rows; de-hardcode city (`branch.region`); enrich collateral tech + all owners; identify parties by passport/PINFL; add notary block. (The excel "Garov" sheet is the collateral register that feeds this act.)
- **#5 Prikaz:** number from `orderNumber/lineNumber` (not contractNumber); Cyrillic date + stop "yil/йил" duplication + no today() fallback; de-hardcode director/org + rate/term; add borrower passport/PINFL/address, collateral agreedValue + owners, legal-basis recital, place of issue, control/execution clause, seal/register/acquaintance rows.
- **#7 Kreditniy zayavka:** **not generated** — replaced by the mandatory KATM upload (§2b). (Keep the existing `credit-application.ts` only if a separate internal application form is still wanted — user chose "upload KATM"; confirm whether to also keep a generated form.)
- **protokol.ts:** not in the 14. Has a bug (prints real-estate rows for AUTO collateral, hardcodes "КЎП ҚАВАТЛИ УЙ"). Default: **drop from the generated set**; if kept, fix the type-branch bug. Confirm.

## 7. New documents (build templates)

- **#8 Grafik** — full per-installment table (seq, due date, opening balance, principal, interest, total, days) + totals row + monthly-payment summary + dual requisites + seal. Data exists (`PaymentSchedule`+`installments`); requires the loader include. The real bundle's grafik had 30 rows, grand total 84,018,829.93.
- **#9 Obloshka** — dossier cover: case №/contract №/status, borrower identity, branch, product/loanType, amount+term+rate, collateral summary + total, open/decision dates, responsible operator (`createdBy`).
- **#10–12 Monitoring ×3** — one parameterised template, `date = applicationDate + {0,6,12} mo`; header + credit + garov + borrower data; manual finding/condition/signature lines. Render consecutively in UI.
- **#11 Dalolatnoma** — ⚠️ content pending sample (§11). Baseline: header + parties + statement-of-fact body + signatures.
- **#13 Cheklist** — required-documents list (define canonically in code) cross-referenced with generated set + uploaded `Document` rows (present/absent + who/when). Include the 3 scanned uploads + notary copies as line items.
- **#14 Disbursement ariza** — beneficiary bank block (holder name, 16-digit card, Х/Р, МФО, holder ИНН, bank name) + amount + amount-in-words + case/contract ref + signature. Requires the new disbursement fields (§3).
- **35/20/15 sheet** — amount split (≈35 mln kredit / 20 mln mol-mulk / rest sug'urta), from the line split + insured sum. Exact lines in §11.

## 8. Accountant packet (Buxgalteriya)

Sent by the **moderator** after approval: (a) the disbursement ariza (#14), (b) the 35/20/15 amount-split sheet. Both viewable/printable; gated to post-approval.

## 9. Stage-gating & permissions

- Main generated docs (1–6, 8, 9, 13): viewable + printable by operator/moderator/director once generatable (not DRAFT — existing rule).
- Monitoring (10–12), notary variants, scanned uploads, accountant packet (14 + 35/20/15): **after director approval** only.
- KATM (#7): mandatory operator upload before submit.
- (Overlaps Spec B — final role/stage matrix reconciled there; this spec assumes the director-approval milestone exists.)

## 10. File map (high level)

- **Backend:** `output/documents/registry.ts` (register the full set + variants), `templates/*.ts` (fix 7, add ~8 new), `case-document.loader.ts` (extend includes + new relations), `pdf.service.ts`/`doc-layout.ts`/`_shared.ts` (shared org/borrower/pledgor/signature/seal/date components), `documents/*` (KATM-mandatory + upload slots), `prisma/schema.prisma` (disbursement fields, loanPurpose, org fields, optional MonitoringAct).
- **Shared:** `dto.ts` (DisbursementDto, loanPurpose, principalWords), `sum-to-words.util.ts` (reuse).
- **Frontend:** `CaseView.tsx` `GeneratedDocsPanel` (list the full set, consecutive monitoring group, notary/upload/accountant sections, per-role print), upload UI for KATM (mandatory) + 3 scanned slots.

## 11. Open items (confirm during review)

1. **#11 Dalolatnoma content** — which dalolatnoma is it (field-inspection / handover / other)? A sample would let me spec it exactly. Until then it's a header+parties+fact-body+signatures skeleton.
2. **35/20/15 exact lines** — confirmed as amounts (not %). Please confirm the exact three: is it `kredit summasi` / `mol-mulk (garov)` / `sug'urta` and are these the same as the Liniya `amountAuto`/`amountPolis`/insured sum, or entered separately on this sheet?
3. **protokol.ts** — drop from the generated set, or keep (bug-fixed)?
4. **credit-application.ts** — since #7 is now an upload, do we also keep a generated internal application form, or remove it?

## 12. Testing

- Skoring renders real per-gate verdicts (a rejected case shows failures, not "all OK"); factor table present.
- No document prints a fabricated term/rate/date; missing data → blank or blocked.
- Rates render rounded (no `55.0000001%`).
- Grafik row count = installment count; totals match.
- Monitoring produces 3 dated acts (+0/+6/+12 mo).
- Disbursement ariza fills beneficiary block from the disbursement fields, not borrower INN when holder ≠ borrower.
- KATM upload is required before submit.
- Every generated doc round-trips view + print for operator/moderator/director per the stage matrix.
- Notary variants only available post-approval and carry the attestation block.

## 13. Out of scope

- Spec B workflow/permissions (director=final, admin invisible, upload-by-all-roles) — separate; this spec assumes the approval milestone.
- Spec A wizard fixes — done.
- Migrating away from pdfmake / DOCX output — PDF only for now.
