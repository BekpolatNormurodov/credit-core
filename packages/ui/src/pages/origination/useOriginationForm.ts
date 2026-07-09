import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@credit-core/api-client';
import {
  ProductType, RepaymentMethod, loanTypeFor, isTermValid, termCapFor, LINE_TERM_CAP,
  type UpsertCasePayload, type CaseSectionKey, type CollateralDto,
} from '@credit-core/shared';

const emptyContact = () => ({ relation: null, fullName: null, phone: null });
// Two close-contact rows are shown by default — both are required (min 2, max 5).
const emptyBorrower = { fullName: '', passportSeries: null, passportNumber: null, pinfl: null, birthDate: null, address: null, phone: null, closeContacts: [emptyContact(), emptyContact()] };
const newCollateral = (type: ProductType): CollateralDto => ({
  type,
  agreedValue: null,
  agreedValueWords: null,
  owners: [],
  ...(type === ProductType.REAL_ESTATE ? { realtyKind: 'APARTMENT' as const } : {}),
});

const emptyForm: UpsertCasePayload = {
  amount: null, termMonths: null, borrower: { ...emptyBorrower }, guarantors: [],
  collaterals: [newCollateral(ProductType.REAL_ESTATE)],
  employment: null, affordability: null, creditLine: null, creditHistory: null,
};

/** Shared state + autosave for the 5-step origination wizard. */
export function useOriginationForm(id?: string) {
  const qc = useQueryClient();
  const [caseId, setCaseId] = useState<string | undefined>(id);
  const [form, setForm] = useState<UpsertCasePayload>(emptyForm);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [attempted, setAttempted] = useState(false);
  // Auto contract number — assigned on submit, read-only in the wizard (null in DRAFT).
  const [contractNumber, setContractNumber] = useState<string | null>(null);
  const [contractYearlyNo, setContractYearlyNo] = useState<number | null>(null);

  useQuery({
    queryKey: ['case', id], enabled: !!id,
    queryFn: async () => {
      const c = await api.case(id!);
      setContractNumber(c.contractNumber);
      setContractYearlyNo(c.contractYearlyNo);
      // Backfill close-contact rows to the required minimum of 2 for the form.
      const loadedContacts = c.borrower?.closeContacts ?? [];
      const closeContacts = loadedContacts.length >= 2 ? loadedContacts : [...loadedContacts, emptyContact(), emptyContact()].slice(0, Math.max(2, loadedContacts.length));
      setForm({
        amount: c.amount, termMonths: c.termMonths,
        borrower: c.borrower ? { ...c.borrower, closeContacts } : { ...emptyBorrower }, guarantors: c.guarantors,
        collaterals: c.collaterals.length ? c.collaterals : [newCollateral(ProductType.REAL_ESTATE)],
        employment: c.employment, affordability: c.affordability, creditLine: c.creditLine, creditHistory: c.creditHistory,
      });
      setCaseId(c.id);
      return c;
    },
  });

  const patch = (p: Partial<UpsertCasePayload>) => setForm((f) => ({ ...f, ...p }));
  const setBorrower = (b: Partial<UpsertCasePayload['borrower']>) => setForm((f) => ({ ...f, borrower: { ...f.borrower, ...b } }));
  const setCol = (i: number, p: Partial<CollateralDto>) => setForm((f) => ({ ...f, collaterals: f.collaterals.map((c, idx) => (idx === i ? { ...c, ...p } : c)) }));
  const addCol = (type: ProductType) => setForm((f) => ({ ...f, collaterals: [...f.collaterals, newCollateral(type)] }));
  const removeCol = (i: number) => setForm((f) => ({ ...f, collaterals: f.collaterals.filter((_, idx) => idx !== i) }));

  // Close contacts (yaqin kishilar) — min 2, max 5.
  const contacts = () => form.borrower.closeContacts ?? [];
  const setContact = (i: number, p: Partial<{ relation: string | null; fullName: string | null; phone: string | null }>) =>
    setBorrower({ closeContacts: contacts().map((c, idx) => (idx === i ? { ...c, ...p } : c)) });
  const addContact = () => { if (contacts().length < 5) setBorrower({ closeContacts: [...contacts(), emptyContact()] }); };
  const removeContact = (i: number) => { if (contacts().length > 2) setBorrower({ closeContacts: contacts().filter((_, idx) => idx !== i) }); };

  /** Ensure the case exists (create it if not), returning its id — used before uploading documents. */
  const ensureCase = async (): Promise<string | undefined> => {
    if (caseId) return caseId;
    const created = await api.createCase(form);
    setCaseId(created.id);
    qc.invalidateQueries({ queryKey: ['cases'] });
    return created.id;
  };

  // Core required set (confirmed with the operator): identity essentials + line amount/term +
  // tranche schedule/term/principal + at least one valued collateral. Everything else is optional.
  const b = form.borrower;
  const line = form.creditLine;
  const tr = line?.tranche;
  const method = tr?.scheduleType as RepaymentMethod | undefined;
  const amountTotal = line?.amountTotal ?? form.amount ?? null;
  const hasValuedCollateral = form.collaterals.some((c) => (c.agreedValue ?? 0) > 0);
  const validContacts = (b.closeContacts ?? []).filter((c) => c.fullName?.trim() && c.phone?.trim());
  const h = form.creditHistory;
  const katmFilled = !!h
    && h.repaidLoansCount != null && h.activeLoansCount != null && h.overdueSubstandardFlag != null
    && h.otherObligations != null && !!h.loansOver5MFlag && !!h.priorMfiPawnshopFlag
    && h.totalOutstandingDebt != null && h.avgMonthlyPaymentExisting != null;
  const errors = {
    fullName: b.fullName.trim() ? undefined : 'F.I.O majburiy',
    contacts: validContacts.length >= 2 ? undefined : 'Kamida 2 ta yaqin kishi (ism + telefon) majburiy',
    pinfl: (b.pinfl ?? '').length === 14 ? undefined : 'PINFL 14 raqam bo‘lishi kerak',
    passportSeries: (b.passportSeries ?? '').length === 2 ? undefined : 'Seriya majburiy (AA)',
    passportNumber: (b.passportNumber ?? '').length === 7 ? undefined : 'Raqam majburiy (7 raqam)',
    phone: b.phone ? undefined : 'Telefon majburiy',
    amountTotal: amountTotal && amountTotal > 0 ? undefined : 'Jami summa majburiy',
    lineTerm: !line?.termMonths || line.termMonths <= 0
      ? 'Liniya muddati majburiy'
      : line.termMonths > LINE_TERM_CAP
        ? `Liniya muddati ${LINE_TERM_CAP} oydan oshmasligi kerak`
        : undefined,
    collateral: hasValuedCollateral ? undefined : 'Kamida 1 garov (kelishilgan qiymat) majburiy',
    scheduleType: method ? undefined : 'Jadval turini tanlang',
    trancheTerm: !method
      ? 'Avval jadval turini tanlang'
      : isTermValid(method, tr?.termMonths)
        ? undefined
        : `Muddat 1–${termCapFor(method)} oy oralig‘ida`,
    principal: tr?.principal && tr.principal > 0 ? undefined : 'Asosiy summa majburiy',
    katm: katmFilled ? undefined : 'KATM bo‘limi to‘liq to‘ldirilishi shart',
  } as const;
  type ErrKey = keyof typeof errors;
  // Which errors belong to which wizard step (index in OriginationWizard.STEPS).
  const STEP_ERRORS: Record<number, ErrKey[]> = {
    0: ['fullName', 'pinfl', 'passportSeries', 'passportNumber', 'phone', 'contacts'],
    1: [],
    2: ['amountTotal', 'lineTerm', 'collateral'],
    3: ['scheduleType', 'trancheTerm', 'principal'],
    4: ['katm'],
  };
  const stepHasErrors = (s: number) => (STEP_ERRORS[s] ?? []).some((k) => errors[k]);
  // A step is "complete" (green ✓) only when it actually HAS required fields and all are satisfied.
  // Steps with no required fields (employment, KATM) are never "complete" — they aren't green.
  const stepComplete = (s: number) => (STEP_ERRORS[s] ?? []).length > 0 && !stepHasErrors(s);
  const valid = (Object.keys(errors) as ErrKey[]).every((k) => !errors[k]);

  /** Persist one section (autosave). Creates the case first if it doesn't exist yet. */
  const saveSection = async (section: CaseSectionKey) => {
    setSaving(true);
    try {
      // A brand-new case is fully persisted by createCase — no immediate section PATCH needed.
      if (!caseId) {
        const created = await api.createCase(form);
        setCaseId(created.id);
        qc.invalidateQueries({ queryKey: ['cases'] });
        return created;
      }
      const saved = await api.saveCaseSection(caseId, { section, data: form });
      qc.invalidateQueries({ queryKey: ['case', caseId] });
      return saved;
    } finally { setSaving(false); }
  };

  const save = async () => {
    if (!valid) { setAttempted(true); return undefined; }
    setSaving(true);
    try {
      const saved = caseId ? await api.updateCase(caseId, form) : await api.createCase(form);
      setCaseId(saved.id);
      qc.invalidateQueries({ queryKey: ['cases'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      qc.invalidateQueries({ queryKey: ['case', saved.id] });
      return saved;
    } finally { setSaving(false); }
  };

  return {
    form, setForm, patch, setBorrower, setCol, addCol, removeCol,
    setContact, addContact, removeContact,
    step, setStep, saving, attempted, setAttempted, errors, valid, stepHasErrors, stepComplete, saveSection, save,
    caseId, ensureCase, contractNumber, contractYearlyNo,
    loanType: loanTypeFor(amountTotal),
  };
}

export type OriginationForm = ReturnType<typeof useOriginationForm>;
