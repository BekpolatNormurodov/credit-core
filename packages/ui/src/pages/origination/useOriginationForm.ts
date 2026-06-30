import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@credit-core/api-client';
import {
  ProductType, RepaymentMethod, loanTypeFor, isTermValid,
  type UpsertCasePayload, type CaseSectionKey, type CollateralDto,
} from '@credit-core/shared';

const emptyBorrower = { fullName: '', passportSeries: null, passportNumber: null, pinfl: null, birthDate: null, address: null, phone: null };
const newCollateral = (type: ProductType): CollateralDto => ({ type, agreedValue: null, agreedValueWords: null, owners: [] });

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

  useQuery({
    queryKey: ['case', id], enabled: !!id,
    queryFn: async () => {
      const c = await api.case(id!);
      setForm({
        amount: c.amount, termMonths: c.termMonths,
        borrower: c.borrower ?? { ...emptyBorrower }, guarantors: c.guarantors,
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

  const termCapOk = () => {
    const m = form.creditLine?.tranche?.scheduleType as RepaymentMethod | undefined;
    const t = form.creditLine?.tranche?.termMonths;
    return !m || !t || isTermValid(m, t);
  };
  const errors = {
    fullName: form.borrower.fullName.trim() ? undefined : 'F.I.O majburiy',
    termCap: termCapOk() ? undefined : 'Bu jadval turi uchun muddat oshib ketgan',
  };
  const valid = !errors.fullName && !!form.collaterals.length && !errors.termCap;

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
    step, setStep, saving, attempted, errors, valid, saveSection, save,
    loanType: loanTypeFor(form.creditLine?.amountTotal ?? form.amount),
  };
}

export type OriginationForm = ReturnType<typeof useOriginationForm>;
