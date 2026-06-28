import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileSpreadsheet, Plus, Save, Trash2, House, Car } from '../lib/icons';
import { api } from '@credit-core/api-client';
import { ProductType, type CollateralDto, type UpsertCasePayload } from '@credit-core/shared';
import { Button, Card, Field, Input } from '../components/primitives';
import { cn, formatMoney } from '../lib/cn';

const num = (v: string): number | null => (v === '' ? null : Number(v));

const emptyBorrower = { fullName: '', passportSeries: null, passportNumber: null, pinfl: null, birthDate: null, address: null, phone: null };

function newCollateral(type: ProductType): CollateralDto {
  return { type, agreedValue: null, agreedValueWords: null, owners: [] };
}

const emptyForm: UpsertCasePayload = {
  amount: null,
  termMonths: null,
  borrower: { ...emptyBorrower },
  collaterals: [newCollateral(ProductType.REAL_ESTATE)],
};

export function CaseForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const nav = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<UpsertCasePayload>(emptyForm);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useQuery({
    queryKey: ['case', id],
    enabled: editing,
    queryFn: async () => {
      const c = await api.case(id!);
      setForm({
        amount: c.amount,
        termMonths: c.termMonths,
        borrower: c.borrower ?? { ...emptyBorrower },
        collaterals: c.collaterals.length ? c.collaterals : [newCollateral(ProductType.REAL_ESTATE)],
      });
      return c;
    },
  });

  const setB = (patch: Partial<typeof form.borrower>) => setForm({ ...form, borrower: { ...form.borrower, ...patch } });
  const setCol = (i: number, patch: Partial<CollateralDto>) => {
    const collaterals = form.collaterals.map((c, idx) => (idx === i ? { ...c, ...patch } : c));
    setForm({ ...form, collaterals });
  };
  const addCol = (type: ProductType) => setForm({ ...form, collaterals: [...form.collaterals, newCollateral(type)] });
  const removeCol = (i: number) => setForm({ ...form, collaterals: form.collaterals.filter((_, idx) => idx !== i) });

  const totalCollateral = form.collaterals.reduce((s, c) => s + (c.agreedValue ?? 0), 0);

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

  const onSave = async () => {
    setSaving(true);
    try {
      const saved = editing ? await api.updateCase(id!, form) : await api.createCase(form);
      qc.invalidateQueries({ queryKey: ['cases'] });
      nav(`/cases/${saved.id}`);
    } finally {
      setSaving(false);
    }
  };

  const valid = form.borrower.fullName && form.collaterals.length > 0 &&
    form.collaterals.every((c) => (c.type === ProductType.AUTO ? c.model || c.stateNumber : c.address));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{editing ? 'Arizani tahrirlash' : 'Yangi ariza'}</h1>
          <p className="text-sm text-muted">Qarz oluvchi va garov(lar) — uy-joy va/yoki avtotransport</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <FileSpreadsheet className="h-4 w-4" /> Excel'dan to'ldirish
          </Button>
          <Button onClick={onSave} loading={saving} disabled={!valid}>
            {!saving && <Save className="h-4 w-4" />} Saqlash
          </Button>
        </div>
      </div>

      {warnings.length > 0 && (
        <Card className="border-warning-100 bg-warning-50">
          <p className="text-sm font-medium text-warning-700">Importdan ogohlantirishlar:</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-warning-700">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="space-y-4 lg:col-span-1">
          <h2 className="font-semibold">Kredit</h2>
          <Field label="Summa (so'm)"><Input type="number" value={form.amount ?? ''} onChange={(e) => setForm({ ...form, amount: num(e.target.value) })} /></Field>
          <Field label="Muddat (oy)"><Input type="number" value={form.termMonths ?? ''} onChange={(e) => setForm({ ...form, termMonths: num(e.target.value) })} /></Field>
          <div className="rounded-xl bg-brand-50 p-3 text-sm">
            <p className="text-muted">Jami garov qiymati</p>
            <p className="nums text-lg font-bold text-brand-800">{formatMoney(totalCollateral)}</p>
          </div>
        </Card>

        <Card className="space-y-4 lg:col-span-2">
          <h2 className="font-semibold">Qarz oluvchi</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="F.I.O" required><Input value={form.borrower.fullName} onChange={(e) => setB({ fullName: e.target.value })} /></Field>
            <Field label="PINFL"><Input value={form.borrower.pinfl ?? ''} onChange={(e) => setB({ pinfl: e.target.value })} /></Field>
            <Field label="Pasport seriya"><Input value={form.borrower.passportSeries ?? ''} onChange={(e) => setB({ passportSeries: e.target.value })} /></Field>
            <Field label="Pasport raqami"><Input value={form.borrower.passportNumber ?? ''} onChange={(e) => setB({ passportNumber: e.target.value })} /></Field>
            <Field label="Telefon"><Input value={form.borrower.phone ?? ''} onChange={(e) => setB({ phone: e.target.value })} /></Field>
            <Field label="Manzil"><Input value={form.borrower.address ?? ''} onChange={(e) => setB({ address: e.target.value })} /></Field>
          </div>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Garovlar <span className="text-muted">({form.collaterals.length})</span></h2>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => addCol(ProductType.REAL_ESTATE)}><House className="h-4 w-4" /> Uy-joy</Button>
          <Button variant="secondary" onClick={() => addCol(ProductType.AUTO)}><Car className="h-4 w-4" /> Avto</Button>
        </div>
      </div>

      {form.collaterals.map((c, i) => (
        <CollateralCard key={i} index={i} c={c} onChange={(p) => setCol(i, p)} onRemove={() => removeCol(i)} canRemove={form.collaterals.length > 1} />
      ))}
    </div>
  );
}

function CollateralCard({ index, c, onChange, onRemove, canRemove }: {
  index: number; c: CollateralDto; onChange: (p: Partial<CollateralDto>) => void; onRemove: () => void; canRemove: boolean;
}) {
  const isAuto = c.type === ProductType.AUTO;
  const setOwners = (owners: CollateralDto['owners']) => onChange({ owners });

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg text-white', isAuto ? 'bg-warning-600' : 'bg-brand-700')}>
            {isAuto ? <Car className="h-4 w-4" /> : <House className="h-4 w-4" />}
          </span>
          <h3 className="font-semibold">Garov {index + 1} — {isAuto ? 'Avtotransport' : 'Uy-joy'}</h3>
        </div>
        {canRemove && <Button variant="ghost" onClick={onRemove}><Trash2 className="h-4 w-4" /> O'chirish</Button>}
      </div>

      {isAuto ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Model (markasi)" required><Input value={c.model ?? ''} onChange={(e) => onChange({ model: e.target.value })} placeholder="CHEVROLET MONZA" /></Field>
          <Field label="Davlat raqami"><Input value={c.stateNumber ?? ''} onChange={(e) => onChange({ stateNumber: e.target.value })} placeholder="10O011OD" /></Field>
          <Field label="Tex passport (AAS №)"><Input value={c.techPassportNo ?? ''} onChange={(e) => onChange({ techPassportNo: e.target.value })} /></Field>
          <Field label="Kuzov turi"><Input value={c.bodyType ?? ''} onChange={(e) => onChange({ bodyType: e.target.value })} placeholder="YENGIL SEDAN" /></Field>
          <Field label="Kuzov №"><Input value={c.bodyNo ?? ''} onChange={(e) => onChange({ bodyNo: e.target.value })} /></Field>
          <Field label="Dvigatel №"><Input value={c.engineNo ?? ''} onChange={(e) => onChange({ engineNo: e.target.value })} /></Field>
          <Field label="Shassi"><Input value={c.chassis ?? ''} onChange={(e) => onChange({ chassis: e.target.value })} /></Field>
          <Field label="Rang"><Input value={c.color ?? ''} onChange={(e) => onChange({ color: e.target.value })} /></Field>
          <Field label="Yil"><Input type="number" value={c.year ?? ''} onChange={(e) => onChange({ year: num(e.target.value) })} /></Field>
          <Field label="Probeg (km)"><Input type="number" value={c.mileage ?? ''} onChange={(e) => onChange({ mileage: num(e.target.value) })} /></Field>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Manzil" required className="sm:col-span-2"><Input value={c.address ?? ''} onChange={(e) => onChange({ address: e.target.value })} /></Field>
          <Field label="Reestr №"><Input value={c.registryNo ?? ''} onChange={(e) => onChange({ registryNo: e.target.value })} /></Field>
          <Field label="Kadastr №"><Input value={c.cadastreNo ?? ''} onChange={(e) => onChange({ cadastreNo: e.target.value })} /></Field>
          <Field label="Mulk turi"><Input value={c.propertyType ?? ''} onChange={(e) => onChange({ propertyType: e.target.value })} /></Field>
          <Field label="Ko'chirma sanasi"><Input type="date" value={c.registrationDate?.slice(0, 10) ?? ''} onChange={(e) => onChange({ registrationDate: e.target.value || null })} /></Field>
          <Field label="Umumiy maydon (m²)"><Input type="number" value={c.totalAreaM2 ?? ''} onChange={(e) => onChange({ totalAreaM2: num(e.target.value) })} /></Field>
          <Field label="Yashash maydoni (m²)"><Input type="number" value={c.livingAreaM2 ?? ''} onChange={(e) => onChange({ livingAreaM2: num(e.target.value) })} /></Field>
          <Field label="Xonalar nomi"><Input value={c.roomNames ?? ''} onChange={(e) => onChange({ roomNames: e.target.value })} /></Field>
          <Field label="Xonalar soni"><Input type="number" value={c.roomCount ?? ''} onChange={(e) => onChange({ roomCount: num(e.target.value) })} /></Field>
        </div>
      )}

      <div className="grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
        <Field label="Kelishilgan garov qiymati"><Input type="number" value={c.agreedValue ?? ''} onChange={(e) => onChange({ agreedValue: num(e.target.value) })} /></Field>
        <Field label="Qiymat (prописью)"><Input value={c.agreedValueWords ?? ''} onChange={(e) => onChange({ agreedValueWords: e.target.value })} /></Field>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">Egalik huquqi (3 shaxsgacha)</h4>
          <Button variant="secondary" onClick={() => c.owners.length < 3 && setOwners([...c.owners, { fullName: '', passportSeries: null, passportNumber: null, pinfl: null, sharePercent: null }])}>
            <Plus className="h-4 w-4" /> Egasi
          </Button>
        </div>
        {c.owners.map((o, idx) => (
          <div key={idx} className="grid gap-2 rounded-xl border border-slate-100 p-2 sm:grid-cols-4">
            <Input placeholder="F.I.O" value={o.fullName} onChange={(e) => { const owners = [...c.owners]; owners[idx] = { ...o, fullName: e.target.value }; setOwners(owners); }} />
            <Input placeholder="Pasport" value={o.passportNumber ?? ''} onChange={(e) => { const owners = [...c.owners]; owners[idx] = { ...o, passportNumber: e.target.value }; setOwners(owners); }} />
            <Input placeholder="Ulush %" type="number" value={o.sharePercent ?? ''} onChange={(e) => { const owners = [...c.owners]; owners[idx] = { ...o, sharePercent: num(e.target.value) }; setOwners(owners); }} />
            <Button variant="ghost" onClick={() => setOwners(c.owners.filter((_, x) => x !== idx))}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </div>
    </Card>
  );
}
