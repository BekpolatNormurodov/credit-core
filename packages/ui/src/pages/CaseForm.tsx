import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileSpreadsheet, Plus, Save, Trash2, Upload } from 'lucide-react';
import { api } from '@credit-core/api-client';
import type { UpsertRealEstateCasePayload } from '@credit-core/shared';
import { Button, Card, Field, Input } from '../components/primitives';

const empty: UpsertRealEstateCasePayload = {
  amount: null,
  termMonths: null,
  borrower: { fullName: '', passportSeries: null, passportNumber: null, pinfl: null, birthDate: null, address: null, phone: null },
  realEstate: {
    address: '', registryNo: null, propertyType: null, cadastreNo: null, registrationDate: null,
    totalAreaM2: null, livingAreaM2: null, roomNames: null, roomCount: null,
    agreedValue: null, agreedValueWords: null, owners: [],
  },
};

const num = (v: string): number | null => (v === '' ? null : Number(v));

export function CaseForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const nav = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<UpsertRealEstateCasePayload>(empty);
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
        borrower: c.borrower ?? empty.borrower,
        realEstate: c.realEstate ?? empty.realEstate,
      });
      return c;
    },
  });

  const re = form.realEstate;
  const setRe = (patch: Partial<typeof re>) => setForm({ ...form, realEstate: { ...re, ...patch } });
  const setB = (patch: Partial<typeof form.borrower>) =>
    setForm({ ...form, borrower: { ...form.borrower, ...patch } });

  const onImport = async (file: File) => {
    const parsed = await api.parseExcel(file);
    setForm((f) => ({
      ...f,
      amount: parsed.amount ?? f.amount,
      borrower: { ...f.borrower, ...parsed.borrower } as typeof f.borrower,
      realEstate: { ...f.realEstate, ...parsed.realEstate, owners: f.realEstate.owners } as typeof f.realEstate,
    }));
    setWarnings(parsed.warnings);
  };

  const onSave = async () => {
    setSaving(true);
    try {
      const saved = editing
        ? await api.updateRealEstate(id!, form)
        : await api.createRealEstate(form);
      qc.invalidateQueries({ queryKey: ['cases'] });
      nav(`/cases/${saved.id}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{editing ? 'Ishni tahrirlash' : 'Yangi ish (uy-joy)'}</h1>
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])}
          />
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <FileSpreadsheet className="h-4 w-4" /> Excel'dan import
          </Button>
          <Button onClick={onSave} disabled={saving || !form.borrower.fullName || !re.address}>
            <Save className="h-4 w-4" /> {saving ? 'Saqlanmoqda…' : 'Saqlash'}
          </Button>
        </div>
      </div>

      {warnings.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <p className="text-sm font-medium text-amber-800">Importdan ogohlantirishlar:</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-amber-700">
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </Card>
      )}

      <Card className="space-y-4">
        <h2 className="font-semibold">Kredit</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Summa (so'm)">
            <Input type="number" value={form.amount ?? ''} onChange={(e) => setForm({ ...form, amount: num(e.target.value) })} />
          </Field>
          <Field label="Muddat (oy)">
            <Input type="number" value={form.termMonths ?? ''} onChange={(e) => setForm({ ...form, termMonths: num(e.target.value) })} />
          </Field>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold">Qarz oluvchi (profil)</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="F.I.O"><Input value={form.borrower.fullName} onChange={(e) => setB({ fullName: e.target.value })} /></Field>
          <Field label="PINFL"><Input value={form.borrower.pinfl ?? ''} onChange={(e) => setB({ pinfl: e.target.value })} /></Field>
          <Field label="Pasport seriya"><Input value={form.borrower.passportSeries ?? ''} onChange={(e) => setB({ passportSeries: e.target.value })} /></Field>
          <Field label="Pasport raqami"><Input value={form.borrower.passportNumber ?? ''} onChange={(e) => setB({ passportNumber: e.target.value })} /></Field>
          <Field label="Telefon"><Input value={form.borrower.phone ?? ''} onChange={(e) => setB({ phone: e.target.value })} /></Field>
          <Field label="Manzil"><Input value={form.borrower.address ?? ''} onChange={(e) => setB({ address: e.target.value })} /></Field>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold">Garov — uy-joy (ko‘chmas mulk)</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Manzil" className="sm:col-span-2"><Input value={re.address} onChange={(e) => setRe({ address: e.target.value })} /></Field>
          <Field label="Reestr №"><Input value={re.registryNo ?? ''} onChange={(e) => setRe({ registryNo: e.target.value })} /></Field>
          <Field label="Kadastr №"><Input value={re.cadastreNo ?? ''} onChange={(e) => setRe({ cadastreNo: e.target.value })} /></Field>
          <Field label="Mulk turi"><Input value={re.propertyType ?? ''} onChange={(e) => setRe({ propertyType: e.target.value })} /></Field>
          <Field label="Ko‘chirma sanasi"><Input type="date" value={re.registrationDate?.slice(0, 10) ?? ''} onChange={(e) => setRe({ registrationDate: e.target.value || null })} /></Field>
          <Field label="Umumiy maydon (m²)"><Input type="number" value={re.totalAreaM2 ?? ''} onChange={(e) => setRe({ totalAreaM2: num(e.target.value) })} /></Field>
          <Field label="Yashash maydoni (m²)"><Input type="number" value={re.livingAreaM2 ?? ''} onChange={(e) => setRe({ livingAreaM2: num(e.target.value) })} /></Field>
          <Field label="Xonalar nomi"><Input value={re.roomNames ?? ''} onChange={(e) => setRe({ roomNames: e.target.value })} /></Field>
          <Field label="Xonalar soni"><Input type="number" value={re.roomCount ?? ''} onChange={(e) => setRe({ roomCount: num(e.target.value) })} /></Field>
          <Field label="Kelishilgan garov qiymati"><Input type="number" value={re.agreedValue ?? ''} onChange={(e) => setRe({ agreedValue: num(e.target.value) })} /></Field>
          <Field label="Qiymat (prописью)" className="sm:col-span-2"><Input value={re.agreedValueWords ?? ''} onChange={(e) => setRe({ agreedValueWords: e.target.value })} /></Field>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Egalik huquqi (3 shaxsgacha)</h3>
            <Button
              variant="secondary"
              onClick={() => re.owners.length < 3 && setRe({ owners: [...re.owners, { fullName: '', passportSeries: null, passportNumber: null, pinfl: null, sharePercent: null }] })}
            >
              <Plus className="h-4 w-4" /> Egasi qo‘shish
            </Button>
          </div>
          {re.owners.map((o, idx) => (
            <div key={idx} className="grid gap-3 rounded-xl border border-slate-100 p-3 sm:grid-cols-4">
              <Input placeholder="F.I.O" value={o.fullName} onChange={(e) => { const owners = [...re.owners]; owners[idx] = { ...o, fullName: e.target.value }; setRe({ owners }); }} />
              <Input placeholder="Pasport" value={o.passportNumber ?? ''} onChange={(e) => { const owners = [...re.owners]; owners[idx] = { ...o, passportNumber: e.target.value }; setRe({ owners }); }} />
              <Input placeholder="Ulush %" type="number" value={o.sharePercent ?? ''} onChange={(e) => { const owners = [...re.owners]; owners[idx] = { ...o, sharePercent: num(e.target.value) }; setRe({ owners }); }} />
              <Button variant="ghost" onClick={() => setRe({ owners: re.owners.filter((_, i) => i !== idx) })}>
                <Trash2 className="h-4 w-4" /> O‘chirish
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <p className="flex items-center gap-2 text-sm text-slate-400">
        <Upload className="h-4 w-4" /> Hujjatlarni saqlagandan so‘ng ish sahifasida yuklaysiz.
      </p>
    </div>
  );
}
