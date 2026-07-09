import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@credit-core/api-client';
import {
  SECTOR_RISK, sectorRiskCode, loanTypeFor, originationCalc, ProductType,
  NATIONALITY_OPTIONS, MICRO_THRESHOLD, INSURANCE_COMPANIES, RELATIVE_RELATIONS, ENTREPRENEUR_TYPES,
  INSURANCE_MAX_MONTHS, INSURANCE_GEN_PREFIX, COLLATERAL_COVERAGE_TARGET, LINE_TERM_CAP, insurancePremiumRate,
  monthlyPaymentFor, termCapFor, isTermValid, paymentDayFor, type RepaymentMethod,
  type UpsertCasePayload,
} from '@credit-core/shared';
import { Button, Card, Field, Input } from '../../components/primitives';
import { MoneyInput, DatePicker, PhoneInput, Select } from '../../components/forms';
import { Toggle } from '../../components/Switches';
import { House, Car, Plus, Trash } from '../../lib/icons';
import { formatMoney } from '../../lib/cn';
import { CollateralCard } from '../CaseForm';
import { PassportScan } from './PassportScan';
import { GenDovernostUpload } from './GenDovernost';
import type { OriginationForm } from './useOriginationForm';

const numv = (s: string): number | null => (s === '' ? null : Number(s));
const opt = (vals: string[]) => vals.map((v) => ({ value: v, label: v }));

type Borrower = UpsertCasePayload['borrower'];
type Emp = NonNullable<UpsertCasePayload['employment']>;
type Aff = NonNullable<UpsertCasePayload['affordability']>;
type Line = NonNullable<UpsertCasePayload['creditLine']>;
type Tr = NonNullable<NonNullable<UpsertCasePayload['creditLine']>['tranche']>;
type Ins = NonNullable<NonNullable<UpsertCasePayload['creditLine']>['insurance']>;
type Hist = NonNullable<UpsertCasePayload['creditHistory']>;

/** Step 1 — Qarz oluvchi: identity + demographics. */
export function Step1({ f }: { f: OriginationForm }) {
  const b = f.form.borrower;
  const set = (p: Partial<Borrower>) => f.setBorrower(p);
  return (
    <Card className="space-y-4">
      <h2 className="font-semibold text-gray-800 dark:text-white">Qarz oluvchi</h2>
      <PassportScan onExtract={(x) => {
        const { nationality, ...rest } = x;
        set({ ...rest, ...(nationality ? { citizenship: nationality } : {}) } as Partial<Borrower>);
      }} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="F.I.O" required error={f.attempted ? f.errors.fullName : undefined}><Input value={b.fullName} onChange={(e) => set({ fullName: e.target.value })} /></Field>
        <Field label="PINFL" required error={f.attempted ? f.errors.pinfl : undefined}><Input inputMode="numeric" maxLength={14} value={b.pinfl ?? ''} onChange={(e) => set({ pinfl: e.target.value.replace(/\D/g, '').slice(0, 14) })} /></Field>
        <Field label="INN (STIR)"><Input value={b.inn ?? ''} onChange={(e) => set({ inn: e.target.value })} /></Field>
        <Field label="Pasport seriya" required error={f.attempted ? f.errors.passportSeries : undefined}><Input maxLength={2} value={b.passportSeries ?? ''} onChange={(e) => set({ passportSeries: e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2) })} placeholder="AA" /></Field>
        <Field label="Pasport raqami" required error={f.attempted ? f.errors.passportNumber : undefined}><Input inputMode="numeric" maxLength={7} value={b.passportNumber ?? ''} onChange={(e) => set({ passportNumber: e.target.value.replace(/\D/g, '').slice(0, 7) })} /></Field>
        <Field label="Jinsi"><Select value={(b.gender ?? '') as 'MALE' | 'FEMALE' | ''} onChange={(v) => set({ gender: v })} options={[{ value: 'MALE', label: 'Erkak' }, { value: 'FEMALE', label: 'Ayol' }]} /></Field>
        <Field label="Fuqarolik"><Select searchable value={(b.citizenship ?? '') as string} onChange={(v) => set({ citizenship: v })} options={opt(NATIONALITY_OPTIONS)} /></Field>
        <Field label="Tug‘ilgan joy"><Input value={b.placeOfBirth ?? ''} onChange={(e) => set({ placeOfBirth: e.target.value })} /></Field>
        <Field label="Tug‘ilgan sana"><DatePicker value={b.birthDate ?? null} onChange={(iso) => set({ birthDate: iso })} /></Field>
        <Field label="Avvalgi F.I.O"><Input value={b.previousName ?? ''} onChange={(e) => set({ previousName: e.target.value })} placeholder="yo‘q" /></Field>
        <Field label="Pasport kim bergan"><Input value={b.passportIssuer ?? ''} onChange={(e) => set({ passportIssuer: e.target.value })} /></Field>
        <Field label="Berilgan sana"><DatePicker value={b.passportIssueDate ?? null} onChange={(iso) => set({ passportIssueDate: iso })} /></Field>
        <Field label="Amal qilish muddati"><DatePicker value={b.passportExpiry ?? null} onChange={(iso) => set({ passportExpiry: iso })} /></Field>
        <Field label="Telefon" required error={f.attempted ? f.errors.phone : undefined}><PhoneInput value={b.phone ?? null} onChange={(v) => set({ phone: v })} /></Field>
        <Field label="Oilaviy holat"><Select value={(b.maritalStatus ?? '') as string} onChange={(v) => set({ maritalStatus: v })} options={opt(['турмуш курган', 'ажрашган', 'бўйдоқ', 'бева'])} /></Field>
        <Field label="Oila a'zolari soni"><Input type="number" value={b.familySize ?? ''} onChange={(e) => set({ familySize: numv(e.target.value) })} /></Field>
        <Field label="Bolalar soni"><Input type="number" value={b.childrenCount ?? ''} onChange={(e) => set({ childrenCount: numv(e.target.value) })} /></Field>
        <Field label="Ma'lumoti"><Select value={(b.education ?? '') as string} onChange={(v) => set({ education: v })} options={opt(['олий', 'урта махсус', 'урта'])} /></Field>
        <Field label="Yashash davomiyligi"><Select value={(b.residenceDuration ?? '') as string} onChange={(v) => set({ residenceDuration: v })} options={opt(['до 3 лет', '1-5 лет', '5-10 лет', 'иное'])} /></Field>
        <Field label="Uy egaligi"><Select value={(b.ownsHome ?? '') as string} onChange={(v) => set({ ownsHome: v })} options={opt(['мулкий хукук', 'ижара/ётокхона', 'иш берувчи берган'])} /></Field>
        <Field label="Depozit darajasi"><Select value={(b.depositsBand ?? '') as string} onChange={(v) => set({ depositsBand: v })} options={opt(['мавжуд эмас', '500$ кам', '500-1000$', '1000-3000$', '3000$+'])} /></Field>
      </div>
      <div className="grid gap-4 border-t border-gray-200 pt-4 dark:border-gray-800 sm:grid-cols-2">
        <Field label="Propiska manzili"><Input value={b.regAddress ?? ''} onChange={(e) => set({ regAddress: e.target.value })} /></Field>
        <Field label="Propiska orientiri"><Input value={b.regLandmark ?? ''} onChange={(e) => set({ regLandmark: e.target.value })} /></Field>
        <Field label="Faktik manzil"><Input value={b.actualAddress ?? ''} onChange={(e) => set({ actualAddress: e.target.value })} /></Field>
        <Field label="Faktik orientir"><Input value={b.actualLandmark ?? ''} onChange={(e) => set({ actualLandmark: e.target.value })} /></Field>
      </div>

      <div className="space-y-3 border-t border-gray-200 pt-4 dark:border-gray-800">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-gray-800 dark:text-white">Yaqin kishilar</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Kamida 2 ta (5 tagacha) — munosabat, F.I.O va telefon</p>
          </div>
          <Button variant="secondary" disabled={(b.closeContacts?.length ?? 0) >= 5} onClick={f.addContact}><Plus className="h-4 w-4" /> Qo‘shish</Button>
        </div>
        {(b.closeContacts ?? []).map((c, i) => (
          <div key={i} className="grid items-end gap-3 sm:grid-cols-[1fr_1.4fr_1.2fr_auto]">
            <Field label={i === 0 ? 'Munosabat' : undefined}><Select value={(c.relation ?? '') as string} onChange={(v) => f.setContact(i, { relation: v })} options={opt([...RELATIVE_RELATIONS])} /></Field>
            <Field label={i === 0 ? 'F.I.O' : undefined}><Input value={c.fullName ?? ''} onChange={(e) => f.setContact(i, { fullName: e.target.value })} /></Field>
            <Field label={i === 0 ? 'Telefon' : undefined}><PhoneInput value={c.phone ?? null} onChange={(v) => f.setContact(i, { phone: v })} /></Field>
            <Button variant="ghost" disabled={(b.closeContacts?.length ?? 0) <= 2} onClick={() => f.removeContact(i)} aria-label="O‘chirish"><Trash className="h-4 w-4" /></Button>
          </div>
        ))}
        {f.attempted && f.errors.contacts && <p className="text-xs font-medium text-error-600 dark:text-error-500">{f.errors.contacts}</p>}
      </div>

      <GenDovernostUpload f={f} />
    </Card>
  );
}

/** Step 2 — Ish & daromad: employment + actual income/expense. */
export function Step2({ f }: { f: OriginationForm }) {
  const e = f.form.employment ?? ({} as Emp);
  const a = f.form.affordability ?? ({} as Aff);
  const setEmp = (p: Partial<Emp>) => f.patch({ employment: { ...e, ...p } as Emp });
  const setAff = (p: Partial<Aff>) => f.patch({ affordability: { ...a, ...p } as Aff });
  const amountTotal = f.form.creditLine?.amountTotal ?? f.form.amount ?? 0;
  const bigLoan = amountTotal > MICRO_THRESHOLD;
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
        {bigLoan
          ? 'Mikrokredit (100 mln+) — ish staji va daromad ma’lumotlarini to‘ldirish tavsiya etiladi (ixtiyoriy).'
          : 'Mikroqarz (100 mln gacha) — bu bo‘lim shart emas (ixtiyoriy). Xohlasangiz to‘ldiring.'}
      </div>
      {bigLoan && (
        <Card className="space-y-4">
          <h2 className="font-semibold text-gray-800 dark:text-white">Tadbirkorlik guvohnomasi <span className="text-gray-500 dark:text-gray-400">(100 mln+)</span></h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Guvohnoma turi"><Select value={(f.form.borrower.entrepreneurType ?? '') as string} onChange={(v) => f.setBorrower({ entrepreneurType: v })} options={opt([...ENTREPRENEUR_TYPES])} /></Field>
            <Field label="Guvohnoma raqami"><Input value={f.form.borrower.entrepreneurCertNo ?? ''} onChange={(e) => f.setBorrower({ entrepreneurCertNo: e.target.value })} /></Field>
          </div>
        </Card>
      )}
      <Card className="space-y-4">
        <h2 className="font-semibold text-gray-800 dark:text-white">Ish joyi</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ish joyi"><Input value={e.employer ?? ''} onChange={(ev) => setEmp({ employer: ev.target.value })} /></Field>
          <Field label="Ish joyi manzili"><Input value={e.employerAddress ?? ''} onChange={(ev) => setEmp({ employerAddress: ev.target.value })} /></Field>
          <Field label="Soha" className="sm:col-span-2"><Select searchable value={(e.sector ?? '') as string} onChange={(v) => setEmp({ sector: v, sectorRiskCode: sectorRiskCode(v) })} options={SECTOR_RISK.map((s) => ({ value: s.label, label: s.label }))} /></Field>
          <Field label="Lavozim"><Input value={e.position ?? ''} onChange={(ev) => setEmp({ position: ev.target.value })} /></Field>
          <Field label="Ish staji (sana)"><Input value={e.employedSince ?? ''} onChange={(ev) => setEmp({ employedSince: ev.target.value })} placeholder="2024 й." /></Field>
          <Field label="Umumiy staj"><Select value={(e.experienceBand ?? '') as string} onChange={(v) => setEmp({ experienceBand: v })} options={opt(['до 3 лет', '3-5 лет', '5-9 лет', '10 и более'])} /></Field>
        </div>
      </Card>
      <Card className="space-y-4">
        <h2 className="font-semibold text-gray-800 dark:text-white">Daromad va xarajat</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Asosiy daromad"><MoneyInput value={a.mainActivityIncome ?? null} onChange={(v) => setAff({ mainActivityIncome: v })} /></Field>
          <Field label="Qo‘shimcha daromad"><MoneyInput value={a.secondaryIncome ?? null} onChange={(v) => setAff({ secondaryIncome: v })} /></Field>
          <Field label="Oila a'zolari daromadi"><MoneyInput value={a.familyIncome ?? null} onChange={(v) => setAff({ familyIncome: v })} /></Field>
          <Field label="Boshqa daromad"><MoneyInput value={a.otherIncome ?? null} onChange={(v) => setAff({ otherIncome: v })} /></Field>
          <Field label="Kommunal xarajat"><MoneyInput value={a.utilitiesExpense ?? null} onChange={(v) => setAff({ utilitiesExpense: v })} /></Field>
          <Field label="Oilaviy xarajat"><MoneyInput value={a.familyExpense ?? null} onChange={(v) => setAff({ familyExpense: v })} /></Field>
          <Field label="Boshqa xarajat"><MoneyInput value={a.otherExpense ?? null} onChange={(v) => setAff({ otherExpense: v })} /></Field>
          <Field label="Mavjud kredit to‘lovi" hint="KATM o‘rtacha oylik"><MoneyInput value={a.existingCreditBurden ?? null} onChange={(v) => setAff({ existingCreditBurden: v })} /></Field>
        </div>
      </Card>
    </div>
  );
}

/** Step 3 — Liniya & garov & sug‘urta. */
export function Step3({ f }: { f: OriginationForm }) {
  const { data: cfg } = useQuery({ queryKey: ['app-config'], queryFn: () => api.getConfig() });
  const minRate = cfg?.minRate ?? 0.55;
  const l = f.form.creditLine ?? ({} as Line);
  const ins = l.insurance ?? ({} as Ins);
  const setLine = (p: Partial<Line>) => {
    const merged = { ...l, ...p } as Line;
    // Only recompute the total when a split field changed — never wipe a loaded amountTotal.
    const recompute = 'amountAuto' in p || 'amountPolis' in p;
    const amountTotal = recompute ? ((merged.amountAuto ?? 0) + (merged.amountPolis ?? 0) || null) : (merged.amountTotal ?? null);
    // The insurance-backed portion (amountPolis) IS the loan-under-policy; keep them in lockstep so
    // the insured sum (×1.3) and the flat-bracket premium always track the split.
    const insurance = 'amountPolis' in p
      ? ({ ...(merged.insurance ?? {}), loanUnderPolicy: merged.amountPolis ?? null } as Ins)
      : merged.insurance;
    f.patch({ creditLine: { ...merged, amountTotal, insurance, loanType: loanTypeFor(amountTotal), penaltyRate: merged.penaltyRate ?? 1.05 } });
  };
  const setIns = (p: Partial<Ins>) => setLine({ insurance: { ...ins, ...p } as Ins });
  const collateralTotal = f.form.collaterals.reduce((s, c) => s + (c.agreedValue ?? 0), 0);
  // Premium is a FLAT rate by term bracket (≤2 yil → 2%, 2–4 yil → 4%) of the insured sum — derived,
  // not entered. Term capped at 48 months (4 years) for the effective bracket.
  const policyMonths = Math.min(ins.policyTermMonths ?? 0, INSURANCE_MAX_MONTHS) || null;
  const bracketRate = insurancePremiumRate(policyMonths);
  const calc = originationCalc({ loanUnderPolicy: ins.loanUnderPolicy, policyTermMonths: policyMonths });
  const termTooLong = (ins.policyTermMonths ?? 0) > INSURANCE_MAX_MONTHS;
  const amountTotal = l.amountTotal ?? null;
  const amountAuto = l.amountAuto ?? null;
  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 dark:text-white">Kredit liniyasi (РКЛ)</h2>
          <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">
            {loanTypeFor(amountTotal) === 'MICROCREDIT' ? 'Mikrokredit' : 'Mikroqarz'}
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Liniya № (РКЛ)" hint="avto — submit'da"><Input readOnly value={f.contractYearlyNo != null ? String(f.contractYearlyNo) : '—'} className="nums bg-gray-50 dark:bg-white/5" /></Field>
          <Field label="Summa — avto/ko‘chmas"><MoneyInput value={l.amountAuto ?? null} onChange={(v) => setLine({ amountAuto: v })} /></Field>
          <Field label="Summa — polis"><MoneyInput value={l.amountPolis ?? null} onChange={(v) => setLine({ amountPolis: v })} /></Field>
          <Field label="Jami summa" required hint="auto = avto + polis" error={f.attempted ? f.errors.amountTotal : undefined}><Input readOnly value={amountTotal != null ? formatMoney(amountTotal) : '—'} className="nums bg-gray-50 dark:bg-white/5" /></Field>
          <Field label="Liniya muddati (oy)" required hint={`max ${LINE_TERM_CAP} oy (bosh kelishuv)`} error={(l.termMonths ?? 0) > LINE_TERM_CAP ? `Liniya muddati ${LINE_TERM_CAP} oydan oshmasligi kerak` : f.attempted ? f.errors.lineTerm : undefined}><Input type="number" min={1} max={LINE_TERM_CAP} value={l.termMonths ?? ''} onChange={(e) => setLine({ termMonths: numv(e.target.value) })} /></Field>
          <Field label="Liniya sanasi"><DatePicker value={l.lineDate ?? null} onChange={(iso) => setLine({ lineDate: iso })} /></Field>
          <Field label="Yillik foiz" hint="admin belgilaydi"><Input readOnly value={`${Math.round((l.interestRate ?? minRate) * 100)}%`} className="nums bg-gray-50 dark:bg-white/5" /></Field>
          <Field label="Jarima foizi"><Input readOnly value={`${Math.round((l.penaltyRate ?? 1.05) * 100)}%`} className="nums bg-gray-50 dark:bg-white/5" /></Field>
          <Field label="Shartnoma raqami" hint="avto — moderatorga yuborilganda"><Input readOnly value={f.contractNumber ?? '—'} className="nums bg-gray-50 dark:bg-white/5" /></Field>
        </div>
      </Card>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 dark:text-white">Garovlar <span className="text-gray-500 dark:text-gray-400">({f.form.collaterals.length})</span></h2>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => f.addCol(ProductType.REAL_ESTATE)}><House className="h-4 w-4" /> Uy-joy</Button>
            <Button variant="secondary" onClick={() => f.addCol(ProductType.AUTO)}><Car className="h-4 w-4" /> Avto</Button>
          </div>
        </div>
        <div className="space-y-4">
          {f.form.collaterals.map((c, i) => (
            <CollateralCard key={i} index={i} c={c} onChange={(p) => f.setCol(i, p)} onRemove={() => f.removeCol(i)} canRemove={f.form.collaterals.length > 1}
              docs={[]} onAddDocs={() => undefined} onRemoveDoc={() => undefined} onSetDocField={() => undefined} />
          ))}
        </div>
        {f.attempted && f.errors.collateral && (
          <p className="mt-2 text-xs font-medium text-error-600 dark:text-error-500">{f.errors.collateral}</p>
        )}
      </div>

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 dark:text-white">Sug‘urta polisi <span className="text-gray-500 dark:text-gray-400">(polis qismi ×130%; ≤2 yil 2% / 2–4 yil 4%; max 4 yil)</span></h2>
          <Toggle checked={ins.insured ?? false} onChange={(v) => setIns(v ? { insured: v, loanUnderPolicy: l.amountPolis ?? ins.loanUnderPolicy ?? null } : { insured: v })} label="Sug‘urtalangan" />
        </div>
        {ins.insured && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Kompaniya"><Select value={(ins.company ?? '') as string} onChange={(v) => setIns({ company: v })} options={opt([...INSURANCE_COMPANIES])} /></Field>
            <Field label="Sug‘urta raqami (gen)" hint="polisdan oldin"><Input value={ins.genAgreementNo ?? ''} onChange={(e) => setIns({ genAgreementNo: e.target.value })} placeholder={INSURANCE_GEN_PREFIX} /></Field>
            <Field label="Polis №"><Input value={ins.policyNo ?? ''} onChange={(e) => setIns({ policyNo: e.target.value })} /></Field>
            <Field label="Polis sanasi"><DatePicker value={ins.policyIssueDate ?? null} onChange={(iso) => setIns({ policyIssueDate: iso })} /></Field>
            <Field label="Polis muddati (oy)" hint="max 48 oy (4 yil)" error={termTooLong ? 'Sug‘urta muddati 48 oydan oshmaydi' : undefined}><Input type="number" min={1} max={INSURANCE_MAX_MONTHS} value={ins.policyTermMonths ?? ''} onChange={(e) => setIns({ policyTermMonths: numv(e.target.value) })} /></Field>
            <Field label="Polis ostidagi kredit" hint="= polis summasi"><Input readOnly value={ins.loanUnderPolicy != null ? formatMoney(ins.loanUnderPolicy) : '—'} className="nums bg-gray-50 dark:bg-white/5" /></Field>
            <Field label="Sug‘urta stavkasi" hint="muddatga qarab"><Input readOnly value={bracketRate ? `${(bracketRate * 100).toFixed(0)}%` : '—'} className="bg-gray-50 dark:bg-white/5" /></Field>
            <Field label="Sug‘urta summasi" hint="polis ×130%"><Input readOnly value={formatMoney(calc.insuredSum)} className="nums bg-gray-50 dark:bg-white/5" /></Field>
            <Field label="Sug‘urta puli" hint="summa × bracket"><Input readOnly value={formatMoney(calc.premium)} className="nums bg-gray-50 dark:bg-white/5" /></Field>
          </div>
        )}
      </Card>
      {(amountAuto || amountTotal) != null && (
        <div className="space-y-1 text-sm text-gray-500 dark:text-gray-400">
          {amountAuto != null && amountAuto > 0 && (
            <p>Garov qoplami (mol-mulk qismi): <b className={`nums ${collateralTotal >= amountAuto * COLLATERAL_COVERAGE_TARGET ? 'text-gray-800 dark:text-white' : 'text-error-600 dark:text-error-500'}`}>{((collateralTotal / amountAuto) * 100).toFixed(0)}%</b> (maqsad ≥ 140%)</p>
          )}
          {(l.amountPolis ?? 0) > 0 && (
            <p>Sug‘urta qoplami (polis qismi): <b className="nums text-gray-800 dark:text-white">130%</b> → sug‘urta summasi {formatMoney(calc.insuredSum)}</p>
          )}
        </div>
      )}
    </div>
  );
}

/** Step 4 — Transh. */
export function Step4({ f }: { f: OriginationForm }) {
  const { data: cfg } = useQuery({ queryKey: ['app-config'], queryFn: () => api.getConfig() });
  const l = f.form.creditLine ?? ({} as Line);
  const t = l.tranche ?? ({} as Tr);
  const setTr = (p: Partial<Tr>) => f.patch({ creditLine: { ...l, tranche: { ...t, ...p } as Tr } });
  const method = (t.scheduleType || undefined) as RepaymentMethod | undefined;
  const rate = l.interestRate ?? cfg?.minRate ?? 0.55;
  // Oylik to'lov is derived (annuitet PMT / differensial 1-oy) and locked — never typed by hand.
  const monthly = monthlyPaymentFor(method, t.principal, t.termMonths, rate);
  useEffect(() => {
    if ((t.monthlyPayment ?? null) !== (monthly ?? null)) setTr({ monthlyPayment: monthly });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthly]);
  // To'lov kuni is derived from the application date: the day-of-month, capped at 15.
  const paymentDay = paymentDayFor(t.applicationDate);
  useEffect(() => {
    if ((t.paymentDay ?? null) !== (paymentDay ?? null)) setTr({ paymentDay });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentDay]);
  // A term over the method's cap is a hard rule — surface it live, not only after a submit attempt.
  const capExceeded = !!method && !!t.termMonths && !isTermValid(method, t.termMonths);
  const cap = method ? termCapFor(method) : null;
  return (
    <Card className="space-y-4">
      <h2 className="font-semibold text-gray-800 dark:text-white">Transh (drawdown)</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Transh №"><Input type="number" value={t.trancheNo ?? ''} onChange={(e) => setTr({ trancheNo: numv(e.target.value) })} placeholder="1" /></Field>
        <Field label="Ariza №"><Input value={t.applicationNo ?? ''} onChange={(e) => setTr({ applicationNo: e.target.value })} /></Field>
        <Field label="Ariza sanasi"><DatePicker value={t.applicationDate ?? null} onChange={(iso) => setTr({ applicationDate: iso })} /></Field>
        <Field label="Asosiy summa" required error={f.attempted ? f.errors.principal : undefined}><MoneyInput value={t.principal ?? null} onChange={(v) => setTr({ principal: v })} /></Field>
        <Field label="Jadval turi" required error={f.attempted ? f.errors.scheduleType : undefined}><Select value={(t.scheduleType ?? '') as 'ANNUITY' | 'DIFFERENTIATED' | ''} onChange={(v) => setTr({ scheduleType: v })} options={[{ value: 'ANNUITY', label: 'Annuitet (max 30 oy)' }, { value: 'DIFFERENTIATED', label: 'Differensial (max 48 oy)' }]} /></Field>
        <Field label="Muddat (oy)" required hint={cap ? `max ${cap} oy` : 'avval jadval turini tanlang'} error={capExceeded ? `Muddat 1–${cap} oy oralig‘ida` : f.attempted ? f.errors.trancheTerm : undefined}>
          <Input type="number" min={1} max={cap ?? undefined} value={t.termMonths ?? ''} onChange={(e) => setTr({ termMonths: numv(e.target.value) })} />
        </Field>
        <Field label="Oylik to‘lov" hint="auto — jadval turi bo‘yicha"><Input readOnly value={monthly != null ? formatMoney(monthly) : '—'} className="nums bg-gray-50 dark:bg-white/5" /></Field>
        <Field label="To‘lov kuni" hint="auto — ariza sanasidan, max 15"><Input readOnly value={paymentDay != null ? `Har oyning ${paymentDay}-kuni` : '—'} className="bg-gray-50 dark:bg-white/5" /></Field>
        <Field label="Sug‘urta to‘lovi"><MoneyInput value={t.insurancePayment ?? null} onChange={(v) => setTr({ insurancePayment: v })} /></Field>
      </div>
    </Card>
  );
}

/** Step 5 — KATM (credit history). */
export function Step5({ f }: { f: OriginationForm }) {
  const h = f.form.creditHistory ?? ({} as Hist);
  const set = (p: Partial<Hist>) => f.patch({ creditHistory: { ...h, ...p } as Hist });
  return (
    <Card className="space-y-4">
      <h2 className="font-semibold text-gray-800 dark:text-white">KATM — kredit tarixi</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="To‘langan kreditlar soni"><Input type="number" value={h.repaidLoansCount ?? ''} onChange={(e) => set({ repaidLoansCount: numv(e.target.value) })} /></Field>
        <Field label="Aktiv kreditlar soni"><Input type="number" value={h.activeLoansCount ?? ''} onChange={(e) => set({ activeLoansCount: numv(e.target.value) })} /></Field>
        <Field label="Muddati o‘tgan (0/1)"><Input type="number" value={h.overdueSubstandardFlag ?? ''} onChange={(e) => set({ overdueSubstandardFlag: numv(e.target.value) })} /></Field>
        <Field label="Boshqa majburiyatlar"><Input type="number" value={h.otherObligations ?? ''} onChange={(e) => set({ otherObligations: numv(e.target.value) })} /></Field>
        <Field label="5 mln+ kredit"><Select value={(h.loansOver5MFlag ?? '') as string} onChange={(v) => set({ loansOver5MFlag: v })} options={opt(['Мавжуд', 'Мавжуд эмас'])} /></Field>
        <Field label="MKO/lombard tarixi"><Select value={(h.priorMfiPawnshopFlag ?? '') as string} onChange={(v) => set({ priorMfiPawnshopFlag: v })} options={opt(['Мавжуд', 'Мавжуд эмас'])} /></Field>
        <Field label="Jami qarz"><MoneyInput value={h.totalOutstandingDebt ?? null} onChange={(v) => set({ totalOutstandingDebt: v })} /></Field>
        <Field label="O‘rtacha oylik to‘lov"><MoneyInput value={h.avgMonthlyPaymentExisting ?? null} onChange={(v) => set({ avgMonthlyPaymentExisting: v })} /></Field>
        <Field label="Komitet protokoli"><Input value={h.committeeProtocolRef ?? ''} onChange={(e) => set({ committeeProtocolRef: e.target.value })} /></Field>
        <Field label="Komitet qarori sanasi"><DatePicker value={h.committeeDecisionDate ?? null} onChange={(iso) => set({ committeeDecisionDate: iso })} /></Field>
      </div>
    </Card>
  );
}
