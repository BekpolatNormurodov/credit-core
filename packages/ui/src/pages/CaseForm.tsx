import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FileSpreadsheet, Plus, Save, Trash2, House, Car, UserAdd, User, IdCard, Hashtag, Phone, Location,
  Money, Clock, People, Percent, Ruler, Tag, Calendar, Palette, Upload, FileText,
} from '../lib/icons';
import { api } from '@credit-core/api-client';
import { ProductType, DocumentType, DOCUMENT_LABEL, type CollateralDto, type GuarantorDto, type UpsertCasePayload } from '@credit-core/shared';
import { Button, Card, Field, Input } from '../components/primitives';
import { MoneyInput, DatePicker, PhoneInput, PassportInput, PlateInput, Select, digitsOnly } from '../components/forms';
import { CAR_MODELS } from '../lib/cars';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { cn, formatMoney } from '../lib/cn';

const num = (v: string): number | null => (v === '' ? null : Number(v));

// A document staged in the form before the case exists; uploaded right after save.
export type StagedDoc = { localId: string; file: File; type: DocumentType; title: string };
// Same, but bound to a collateral by its index (resolved to the real id after save).
export type StagedColDoc = { localId: string; colIndex: number; file: File; type: DocumentType; title: string; description: string };
let docSeq = 0;

const emptyBorrower = { fullName: '', passportSeries: null, passportNumber: null, pinfl: null, birthDate: null, address: null, phone: null };

function newCollateral(type: ProductType): CollateralDto {
  return { type, agreedValue: null, agreedValueWords: null, owners: [] };
}

const emptyForm: UpsertCasePayload = {
  amount: null,
  termMonths: null,
  borrower: { ...emptyBorrower },
  guarantors: [],
  collaterals: [newCollateral(ProductType.REAL_ESTATE)],
};

/** Shared form state + handlers used by both the edit page and the new-application modal. */
export function useCaseForm(id?: string) {
  const editing = Boolean(id);
  const qc = useQueryClient();
  const [form, setForm] = useState<UpsertCasePayload>(emptyForm);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [docs, setDocs] = useState<StagedDoc[]>([]);
  const [colDocs, setColDocs] = useState<StagedColDoc[]>([]);

  const addDocs = (files: FileList | File[] | null, type: DocumentType) => {
    if (!files) return;
    const list = Array.from(files).map((file) => ({
      localId: `d${docSeq++}`,
      file,
      type,
      title: type === DocumentType.PASSPORT ? 'Pasport' : '',
    }));
    setDocs((prev) => [...prev, ...list]);
  };
  const removeDoc = (localId: string) => setDocs((prev) => prev.filter((d) => d.localId !== localId));
  const setDocTitle = (localId: string, title: string) => setDocs((prev) => prev.map((d) => (d.localId === localId ? { ...d, title } : d)));

  // Per-collateral staged attachments (image/file + name + free text), bound by collateral index.
  const addColDocs = (colIndex: number, files: FileList | File[] | null) => {
    if (!files) return;
    const list = Array.from(files).map((file) => ({
      localId: `c${docSeq++}`,
      colIndex,
      file,
      type: file.type.startsWith('image/') ? DocumentType.COLLATERAL_PHOTO : DocumentType.OTHER,
      title: '',
      description: '',
    }));
    setColDocs((prev) => [...prev, ...list]);
  };
  const removeColDoc = (localId: string) => setColDocs((prev) => prev.filter((d) => d.localId !== localId));
  const setColDocField = (localId: string, patch: Partial<Pick<StagedColDoc, 'title' | 'description'>>) =>
    setColDocs((prev) => prev.map((d) => (d.localId === localId ? { ...d, ...patch } : d)));

  useQuery({
    queryKey: ['case', id],
    enabled: editing,
    queryFn: async () => {
      const c = await api.case(id!);
      setForm({
        amount: c.amount,
        termMonths: c.termMonths,
        borrower: c.borrower ?? { ...emptyBorrower },
        guarantors: c.guarantors ?? [],
        collaterals: c.collaterals.length ? c.collaterals : [newCollateral(ProductType.REAL_ESTATE)],
      });
      return c;
    },
  });

  const setB = (patch: Partial<UpsertCasePayload['borrower']>) => setForm((f) => ({ ...f, borrower: { ...f.borrower, ...patch } }));
  const setCol = (i: number, patch: Partial<CollateralDto>) => setForm((f) => ({ ...f, collaterals: f.collaterals.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) }));
  const addCol = (type: ProductType) => setForm((f) => ({ ...f, collaterals: [...f.collaterals, newCollateral(type)] }));
  const removeCol = (i: number) => {
    setForm((f) => ({ ...f, collaterals: f.collaterals.filter((_, idx) => idx !== i) }));
    // Drop staged attachments for the removed collateral and reindex the rest.
    setColDocs((prev) => prev.filter((d) => d.colIndex !== i).map((d) => (d.colIndex > i ? { ...d, colIndex: d.colIndex - 1 } : d)));
  };
  const addGuarantor = () => setForm((f) => ({ ...f, guarantors: [...f.guarantors, { fullName: '', passportSeries: null, passportNumber: null, pinfl: null, phone: null, relation: null }] }));
  const setG = (i: number, patch: Partial<GuarantorDto>) => setForm((f) => ({ ...f, guarantors: f.guarantors.map((g, idx) => (idx === i ? { ...g, ...patch } : g)) }));
  const removeG = (i: number) => setForm((f) => ({ ...f, guarantors: f.guarantors.filter((_, idx) => idx !== i) }));

  const onImport = async (file: File) => {
    const parsed = await api.parseExcel(file);
    setForm((f) => ({
      ...f,
      amount: parsed.amount ?? f.amount,
      borrower: { ...f.borrower, ...parsed.borrower } as typeof f.borrower,
      collaterals: [{ ...newCollateral(ProductType.REAL_ESTATE), ...parsed.collateral } as CollateralDto, ...f.collaterals.slice(1)],
    }));
    setWarnings(parsed.warnings);
  };

  const [attempted, setAttempted] = useState(false);

  // Required-field errors (shown only after a save attempt — inline-validation).
  const colError = (c: CollateralDto): string | undefined =>
    c.type === ProductType.AUTO
      ? c.model || c.stateNumber ? undefined : 'Model yoki davlat raqamini kiriting'
      : c.address ? undefined : 'Manzilni kiriting';
  const errors = {
    fullName: form.borrower.fullName.trim() ? undefined : 'Qarz oluvchi F.I.O majburiy',
    collaterals: form.collaterals.map(colError),
  };
  const valid = !errors.fullName && form.collaterals.length > 0 && errors.collaterals.every((e) => !e);

  const save = async () => {
    if (!valid) { setAttempted(true); return undefined; }
    setSaving(true);
    try {
      const saved = editing ? await api.updateCase(id!, form) : await api.createCase(form);
      // Upload any documents staged in the form (borrower passport + extras).
      for (const d of docs) {
        await api.uploadDocument(saved.id, d.type, d.file, { title: d.title || undefined });
      }
      // Upload per-collateral attachments, mapping the form index to the saved collateral id.
      for (const d of colDocs) {
        const collateralId = saved.collaterals[d.colIndex]?.id;
        await api.uploadDocument(saved.id, d.type, d.file, {
          collateralId,
          title: d.title || undefined,
          description: d.description || undefined,
        });
      }
      if (docs.length) setDocs([]);
      if (colDocs.length) setColDocs([]);
      qc.invalidateQueries({ queryKey: ['cases'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      qc.invalidateQueries({ queryKey: ['case', saved.id] });
      return saved;
    } finally {
      setSaving(false);
    }
  };

  return { editing, form, setForm, setB, setCol, addCol, removeCol, addGuarantor, setG, removeG, onImport, warnings, valid, errors, attempted, saving, save, docs, addDocs, removeDoc, setDocTitle, colDocs, addColDocs, removeColDoc, setColDocField };
}

type FormApi = ReturnType<typeof useCaseForm>;

/** Presentational form body (no page chrome) — reused in page and modal. */
export function CaseFormFields({ f, showImport = true }: { f: FormApi; showImport?: boolean }) {
  const { form, setForm, setB, setCol, addCol, removeCol, addGuarantor, setG, removeG, onImport, warnings, errors, attempted, docs, addDocs, removeDoc, setDocTitle, colDocs, addColDocs, removeColDoc, setColDocField } = f;
  const fileRef = useRef<HTMLInputElement>(null);
  const passportRef = useRef<HTMLInputElement>(null);
  const extraRef = useRef<HTMLInputElement>(null);
  const totalCollateral = form.collaterals.reduce((s, c) => s + (c.agreedValue ?? 0), 0);

  return (
    <div className="space-y-6">
      {showImport && (
        <div className="flex justify-end">
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <FileSpreadsheet className="h-4 w-4" /> Excel'dan to'ldirish
          </Button>
        </div>
      )}

      {warnings.length > 0 && (
        <Card className="border-warning-100 bg-warning-50 dark:border-warning-600/20 dark:bg-warning-600/10">
          <p className="text-sm font-medium text-warning-700 dark:text-warning-400">Importdan ogohlantirishlar:</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-warning-700 dark:text-warning-400">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="space-y-4 lg:col-span-1">
          <h2 className="flex items-center gap-2 font-semibold text-gray-800 dark:text-white"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400"><Money className="h-4 w-4" /></span>Kredit</h2>
          <Field label="Summa" icon={Money}><MoneyInput value={form.amount} onChange={(v) => setForm((s) => ({ ...s, amount: v }))} /></Field>
          <Field label="Muddat (oy)" icon={Clock}><Input type="number" value={form.termMonths ?? ''} onChange={(e) => setForm((s) => ({ ...s, termMonths: num(e.target.value) }))} /></Field>
          <div className="rounded-lg bg-brand-50 p-3 text-sm dark:bg-brand-500/10">
            <p className="text-gray-500 dark:text-gray-400">Jami garov qiymati</p>
            <p className="nums text-lg font-bold text-brand-800 dark:text-brand-400">{formatMoney(totalCollateral)}</p>
          </div>
        </Card>

        <Card className="space-y-4 lg:col-span-2">
          <h2 className="flex items-center gap-2 font-semibold text-gray-800 dark:text-white"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400"><User className="h-4 w-4" /></span>Qarz oluvchi</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="F.I.O" required icon={User} error={attempted ? errors.fullName : undefined}><Input value={form.borrower.fullName} onChange={(e) => setB({ fullName: e.target.value })} /></Field>
            <Field label="PINFL" icon={Hashtag} hint="14 ta raqam"><Input inputMode="numeric" maxLength={14} value={form.borrower.pinfl ?? ''} onChange={(e) => setB({ pinfl: digitsOnly(e.target.value, 14) })} placeholder="12345678901234" /></Field>
            <Field label="Pasport seriya" icon={IdCard}><Input maxLength={2} value={form.borrower.passportSeries ?? ''} onChange={(e) => setB({ passportSeries: e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2) })} placeholder="AA" /></Field>
            <Field label="Pasport raqami" icon={IdCard}><Input inputMode="numeric" maxLength={7} value={form.borrower.passportNumber ?? ''} onChange={(e) => setB({ passportNumber: digitsOnly(e.target.value, 7) })} placeholder="1234567" /></Field>
            <Field label="Telefon" icon={Phone}><PhoneInput value={form.borrower.phone ?? null} onChange={(v) => setB({ phone: v })} /></Field>
            <Field label="Manzil" icon={Location}><Input value={form.borrower.address ?? ''} onChange={(e) => setB({ address: e.target.value })} /></Field>
          </div>

          {/* Borrower passport + extra documents (uploaded right after the case is saved) */}
          <div className="space-y-2 border-t border-gray-200 pt-4 dark:border-gray-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-white"><IdCard className="h-4 w-4 text-gray-400" /> Hujjatlar</h3>
              <div className="flex gap-2">
                <input ref={passportRef} type="file" accept="image/*,.pdf" multiple className="hidden" onChange={(e) => { addDocs(e.target.files, DocumentType.PASSPORT); e.target.value = ''; }} />
                <input ref={extraRef} type="file" multiple className="hidden" onChange={(e) => { addDocs(e.target.files, DocumentType.OTHER); e.target.value = ''; }} />
                <Button variant="secondary" onClick={() => passportRef.current?.click()}><IdCard className="h-4 w-4" /> Pasport</Button>
                <Button variant="secondary" onClick={() => extraRef.current?.click()}><Upload className="h-4 w-4" /> Qo'shimcha</Button>
              </div>
            </div>
            {docs.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">Qarz oluvchi pasporti va qo'shimcha hujjatlarni biriktiring (ixtiyoriy).</p>
            ) : (
              <ul className="space-y-2">
                {docs.map((d) => (
                  <li key={d.localId} className="rounded-lg border border-gray-200 px-3 py-2.5 dark:border-gray-800">
                    <div className="flex items-center gap-2">
                      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white', d.type === DocumentType.PASSPORT ? 'bg-brand-700' : 'bg-gray-400 dark:bg-gray-600')}>
                        {d.type === DocumentType.PASSPORT ? <IdCard className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                      </span>
                      <Input className="flex-1" value={d.title} onChange={(e) => setDocTitle(d.localId, e.target.value)} placeholder={DOCUMENT_LABEL[d.type] + ' nomi'} />
                      <Button variant="ghost" aria-label="Hujjatni o'chirish" className="shrink-0 px-2 text-error-600 dark:text-error-500" onClick={() => removeDoc(d.localId)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                    <p className="mt-1 truncate pl-11 text-[11px] text-gray-500 dark:text-gray-400">{DOCUMENT_LABEL[d.type]} · {d.file.name}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold text-gray-800 dark:text-white"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-success-50 text-success-700 dark:bg-success-600/20 dark:text-success-400"><People className="h-4 w-4" /></span>Kafillar <span className="text-gray-500 dark:text-gray-400">({form.guarantors.length})</span></h2>
          <Button variant="secondary" onClick={addGuarantor}><UserAdd className="h-4 w-4" /> Kafil qo'shish</Button>
        </div>
        {form.guarantors.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-gray-200 py-8 text-center dark:border-gray-800">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-gray-500"><People className="h-5 w-5" /></span>
            <p className="text-sm text-gray-500 dark:text-gray-400">Kafil biriktirilmagan (ixtiyoriy, bir nechta bo'lishi mumkin)</p>
          </div>
        )}
        <div className="space-y-3">
          {form.guarantors.map((g, i) => (
            <div key={i} className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
              <div className="mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-white">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-success-600 text-xs font-bold text-white">{i + 1}</span>
                  Kafil {i + 1}
                </span>
                <Button variant="ghost" aria-label="Kafilni o'chirish" className="px-2 text-error-600 dark:text-error-500" onClick={() => removeG(i)}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="F.I.O" icon={User}><Input placeholder="To'liq ism" value={g.fullName} onChange={(e) => setG(i, { fullName: e.target.value })} /></Field>
                <Field label="PINFL" icon={Hashtag}><Input inputMode="numeric" maxLength={14} placeholder="14 ta raqam" value={g.pinfl ?? ''} onChange={(e) => setG(i, { pinfl: digitsOnly(e.target.value, 14) })} /></Field>
                <Field label="Pasport" icon={IdCard}><PassportInput value={g.passportNumber ?? null} onChange={(v) => setG(i, { passportNumber: v })} /></Field>
                <Field label="Munosabati" icon={People}><Input placeholder="aka, ota, do'st…" value={g.relation ?? ''} onChange={(e) => setG(i, { relation: e.target.value })} /></Field>
                <Field label="Telefon" icon={Phone}><PhoneInput value={g.phone ?? null} onChange={(v) => setG(i, { phone: v })} /></Field>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800 dark:text-white">Garovlar <span className="text-gray-500 dark:text-gray-400">({form.collaterals.length})</span></h2>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => addCol(ProductType.REAL_ESTATE)}><House className="h-4 w-4" /> Uy-joy</Button>
          <Button variant="secondary" onClick={() => addCol(ProductType.AUTO)}><Car className="h-4 w-4" /> Avto</Button>
        </div>
      </div>

      {form.collaterals.map((c, i) => (
        <CollateralCard
          key={i}
          index={i}
          c={c}
          error={attempted ? errors.collaterals[i] : undefined}
          onChange={(p) => setCol(i, p)}
          onRemove={() => removeCol(i)}
          canRemove={form.collaterals.length > 1}
          docs={colDocs.filter((d) => d.colIndex === i)}
          onAddDocs={(files) => addColDocs(i, files)}
          onRemoveDoc={removeColDoc}
          onSetDocField={setColDocField}
        />
      ))}
    </div>
  );
}

/** Full-page editor (used by the /cases/:id/edit route). */
export function CaseForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const f = useCaseForm(id);

  const onSave = async () => {
    const saved = await f.save();
    if (!saved) { toast.error('Tekshirib chiqing', 'Majburiy maydonlar to‘ldirilmagan'); return; }
    toast.success(f.editing ? 'Ariza yangilandi' : 'Ariza yaratildi', saved.number);
    nav(`/cases/${saved.id}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">{f.editing ? 'Arizani tahrirlash' : 'Yangi ariza'}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Qarz oluvchi va garov(lar) — uy-joy va/yoki avtotransport</p>
        </div>
        <Button onClick={onSave} loading={f.saving}>
          {!f.saving && <Save className="h-4 w-4" />} Saqlash
        </Button>
      </div>
      <CaseFormFields f={f} />
    </div>
  );
}

/** New-application modal (operator dashboard). */
export function NewCaseModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  // Lazy import to keep Modal in the same chunk
  const f = useCaseForm(undefined);
  const nav = useNavigate();
  const toast = useToast();

  const onSave = async () => {
    const saved = await f.save();
    if (!saved) { toast.error('Tekshirib chiqing', 'Majburiy maydonlar to‘ldirilmagan'); return; }
    toast.success('Ariza yaratildi', saved.number);
    onClose();
    nav(`/cases/${saved.id}`);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="full"
      title="Yangi ariza"
      description="Qarz oluvchi va garov(lar) — uy-joy va/yoki avtotransport"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Bekor qilish</Button>
          <Button onClick={onSave} loading={f.saving}>
            {!f.saving && <Save className="h-4 w-4" />} Saqlash
          </Button>
        </>
      }
    >
      {/* Full-bleed the modal body to the page canvas so the gray-900 form Cards
          read as raised (the modal panel itself is the lighter elevated layer). */}
      <div className="-mx-6 -my-5 min-h-full bg-canvas px-6 py-5 dark:bg-gray-950">
        <CaseFormFields f={f} />
      </div>
    </Modal>
  );
}

export function CollateralCard({ index, c, error, onChange, onRemove, canRemove, docs, onAddDocs, onRemoveDoc, onSetDocField }: {
  index: number; c: CollateralDto; error?: string; onChange: (p: Partial<CollateralDto>) => void; onRemove: () => void; canRemove: boolean;
  docs: StagedColDoc[]; onAddDocs: (files: FileList | File[] | null) => void; onRemoveDoc: (localId: string) => void;
  onSetDocField: (localId: string, patch: Partial<Pick<StagedColDoc, 'title' | 'description'>>) => void;
}) {
  const isAuto = c.type === ProductType.AUTO;
  const setOwners = (owners: CollateralDto['owners']) => onChange({ owners });
  const docRef = useRef<HTMLInputElement>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg text-white', isAuto ? 'bg-warning-600' : 'bg-brand-700')}>
            {isAuto ? <Car className="h-4 w-4" /> : <House className="h-4 w-4" />}
          </span>
          <h3 className="font-semibold text-gray-800 dark:text-white">Garov {index + 1} — {isAuto ? 'Avtotransport' : 'Uy-joy'}</h3>
        </div>
        {canRemove && <Button variant="ghost" onClick={onRemove}><Trash2 className="h-4 w-4" /> O'chirish</Button>}
      </div>

      {isAuto ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Model (markasi)" required icon={Car} error={error}>
            <Select<string> value={c.model ?? ''} onChange={(v) => onChange({ model: v })} searchable placeholder="— mashinani tanlang —"
              options={CAR_MODELS.map((m) => ({ value: m, label: m }))} />
          </Field>
          <Field label="Davlat raqami" icon={Hashtag}><PlateInput value={c.stateNumber ?? null} onChange={(v) => onChange({ stateNumber: v })} /></Field>
          <Field label="Tex passport (AAS №)" icon={IdCard}><Input value={c.techPassportNo ?? ''} onChange={(e) => onChange({ techPassportNo: e.target.value })} /></Field>
          <Field label="Kuzov turi" icon={Car}><Input value={c.bodyType ?? ''} onChange={(e) => onChange({ bodyType: e.target.value })} placeholder="YENGIL SEDAN" /></Field>
          <Field label="Kuzov №" icon={Hashtag}><Input value={c.bodyNo ?? ''} onChange={(e) => onChange({ bodyNo: e.target.value })} /></Field>
          <Field label="Dvigatel №" icon={Hashtag}><Input value={c.engineNo ?? ''} onChange={(e) => onChange({ engineNo: e.target.value })} /></Field>
          <Field label="Shassi" icon={Hashtag}><Input value={c.chassis ?? ''} onChange={(e) => onChange({ chassis: e.target.value })} /></Field>
          <Field label="Rang" icon={Palette}><Input value={c.color ?? ''} onChange={(e) => onChange({ color: e.target.value })} /></Field>
          <Field label="Yil" icon={Calendar}><Input type="number" value={c.year ?? ''} onChange={(e) => onChange({ year: num(e.target.value) })} /></Field>
          <Field label="Probeg (km)" icon={Clock}><Input type="number" value={c.mileage ?? ''} onChange={(e) => onChange({ mileage: num(e.target.value) })} /></Field>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Manzil" required className="sm:col-span-2" icon={Location} error={error}><Input value={c.address ?? ''} onChange={(e) => onChange({ address: e.target.value })} /></Field>
          <Field label="Reestr №" icon={Hashtag}><Input value={c.registryNo ?? ''} onChange={(e) => onChange({ registryNo: e.target.value })} /></Field>
          <Field label="Kadastr №" icon={Hashtag}><Input value={c.cadastreNo ?? ''} onChange={(e) => onChange({ cadastreNo: e.target.value })} /></Field>
          <Field label="Mulk turi" icon={House}><Input value={c.propertyType ?? ''} onChange={(e) => onChange({ propertyType: e.target.value })} /></Field>
          <Field label="Ko'chirma sanasi" icon={Calendar}><DatePicker value={c.registrationDate ?? null} onChange={(iso) => onChange({ registrationDate: iso })} /></Field>
          <Field label="Umumiy maydon (m²)" icon={Ruler}><Input type="number" value={c.totalAreaM2 ?? ''} onChange={(e) => onChange({ totalAreaM2: num(e.target.value) })} /></Field>
          <Field label="Yashash maydoni (m²)" icon={Ruler}><Input type="number" value={c.livingAreaM2 ?? ''} onChange={(e) => onChange({ livingAreaM2: num(e.target.value) })} /></Field>
          <Field label="Xonalar nomi" icon={Tag}><Input value={c.roomNames ?? ''} onChange={(e) => onChange({ roomNames: e.target.value })} /></Field>
          <Field label="Xonalar soni" icon={Hashtag}><Input type="number" value={c.roomCount ?? ''} onChange={(e) => onChange({ roomCount: num(e.target.value) })} /></Field>
        </div>
      )}

      <div className="grid gap-4 border-t border-gray-200 pt-4 dark:border-gray-800 sm:grid-cols-2">
        <Field label="Kelishilgan garov qiymati" icon={Money}><MoneyInput value={c.agreedValue ?? null} onChange={(v) => onChange({ agreedValue: v })} /></Field>
        <Field label="Qiymat (prописью)" icon={Tag}><Input value={c.agreedValueWords ?? ''} onChange={(e) => onChange({ agreedValueWords: e.target.value })} /></Field>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-800 dark:text-white">Egalik huquqi (3 shaxsgacha)</h4>
          <Button variant="secondary" onClick={() => c.owners.length < 3 && setOwners([...c.owners, { fullName: '', passportSeries: null, passportNumber: null, pinfl: null, sharePercent: null }])}>
            <Plus className="h-4 w-4" /> Egasi
          </Button>
        </div>
        {c.owners.map((o, idx) => (
          <div key={idx} className="grid gap-2 rounded-lg border border-gray-200 p-2 dark:border-gray-800 sm:grid-cols-4">
            <Input placeholder="F.I.O" value={o.fullName} onChange={(e) => { const owners = [...c.owners]; owners[idx] = { ...o, fullName: e.target.value }; setOwners(owners); }} />
            <PassportInput value={o.passportNumber ?? null} onChange={(v) => { const owners = [...c.owners]; owners[idx] = { ...o, passportNumber: v }; setOwners(owners); }} />
            <Input placeholder="Ulush %" type="number" min={0} max={100} value={o.sharePercent ?? ''} onChange={(e) => { const owners = [...c.owners]; owners[idx] = { ...o, sharePercent: Math.min(100, Number(digitsOnly(e.target.value, 3)) || 0) || null }; setOwners(owners); }} />
            <Button variant="ghost" aria-label="Egasini o'chirish" onClick={() => setOwners(c.owners.filter((_, x) => x !== idx))}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </div>

      {/* Qo'shimcha: rasm/fayl biriktirish + izoh matn (har bir garovga) */}
      <div className="space-y-3 border-t border-gray-200 pt-4 dark:border-gray-800">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-white"><FileText className="h-4 w-4 text-gray-400" /> Qo'shimcha rasm va izohlar</h4>
        <input ref={docRef} type="file" accept="image/*,.pdf,.doc,.docx" multiple className="hidden" onChange={(e) => { onAddDocs(e.target.files); e.target.value = ''; }} />
        <button
          type="button"
          onClick={() => docRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); onAddDocs(e.dataTransfer.files); }}
          className="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/60 px-4 py-6 text-center outline-none transition hover:border-brand-400 hover:bg-brand-50/50 focus-visible:ring-2 focus-visible:ring-brand-600/30 dark:border-gray-700 dark:bg-white/5 dark:hover:border-brand-500"
        >
          <Upload className="h-6 w-6 text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Rasm yoki hujjat tashlang, yoki tanlang</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">JPG, PNG, PDF, DOC · har biriga nom va izoh yozish mumkin</span>
        </button>
        {docs.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {docs.map((d) => {
              const isImg = d.file.type.startsWith('image/');
              const url = isImg ? URL.createObjectURL(d.file) : null;
              return (
                <div key={d.localId} className="flex gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                  {isImg && url ? (
                    <button type="button" onClick={() => setLightbox(url)} className="shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30" aria-label="Rasmni kattalashtirish">
                      <img src={url} alt={d.file.name} className="h-16 w-16 rounded-lg object-cover" />
                    </button>
                  ) : (
                    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-400 dark:bg-white/10 dark:text-gray-500"><FileText className="h-6 w-6" /></span>
                  )}
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Input value={d.title} onChange={(e) => onSetDocField(d.localId, { title: e.target.value })} placeholder="Nomi (masalan: Old tomondan)" />
                    <Input value={d.description} onChange={(e) => onSetDocField(d.localId, { description: e.target.value })} placeholder="Izoh matni (ixtiyoriy)" />
                    <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">{d.file.name}</p>
                  </div>
                  <Button variant="ghost" aria-label="Hujjatni o'chirish" className="shrink-0 px-2 text-error-600 dark:text-error-500" onClick={() => onRemoveDoc(d.localId)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {lightbox && (
        <div onClick={() => setLightbox(null)} role="dialog" aria-modal className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
          <img src={lightbox} alt="" className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-2xl" />
        </div>
      )}
    </Card>
  );
}
