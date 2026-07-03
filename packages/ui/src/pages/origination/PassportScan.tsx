import { useState } from 'react';
import type { PassportScanResult } from '@credit-core/shared';
import { api, getErrorMessage } from '@credit-core/api-client';
import { Upload, Camera, IdCard, CheckCircle2, RotateCcw } from '../../lib/icons';
import { Button, Card, Field, Input } from '../../components/primitives';
import { Select } from '../../components/forms';
import { cn } from '../../lib/cn';

type Fields = PassportScanResult['fields'];

const EMPTY: Fields = {
  fullName: '', passportSeries: '', passportNumber: '',
  birthDate: null, passportExpiry: null, gender: '', pinfl: '',
};

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
}

function tone(c: number) {
  if (c >= 90) return { ring: 'text-success-500', chip: 'bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-500', label: 'Aniq' };
  if (c >= 60) return { ring: 'text-warning-500', chip: 'bg-warning-50 text-warning-600 dark:bg-warning-500/10 dark:text-warning-500', label: 'Tekshiring' };
  return { ring: 'text-error-500', chip: 'bg-error-50 text-error-600 dark:bg-error-500/10 dark:text-error-500', label: 'Qayta oling' };
}

function ConfidenceRing({ value, className }: { value: number; className?: string }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(100, value)) / 100);
  return (
    <div className="relative h-12 w-12 shrink-0">
      <svg viewBox="0 0 48 48" className="h-12 w-12 -rotate-90">
        <circle cx="24" cy="24" r={r} className="stroke-gray-200 dark:stroke-gray-700" strokeWidth="4" fill="none" />
        <circle cx="24" cy="24" r={r} className={cn('transition-all', className)} stroke="currentColor" strokeWidth="4" fill="none" strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-gray-700 dark:text-gray-200">{value}</span>
    </div>
  );
}

function ValidChip({ valid }: { valid?: boolean }) {
  if (valid === undefined) return null;
  return valid ? (
    <span className="rounded-full bg-success-50 px-1.5 py-0.5 text-[10px] font-semibold text-success-600 dark:bg-success-500/10 dark:text-success-500">✓ tekshirildi</span>
  ) : (
    <span className="rounded-full bg-error-50 px-1.5 py-0.5 text-[10px] font-semibold text-error-600 dark:bg-error-500/10 dark:text-error-500">✗ nomuvofiq</span>
  );
}

function FieldWithChip({ label, valid, children }: { label: string; valid?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
        <ValidChip valid={valid} />
      </div>
      {children}
    </div>
  );
}

function ReadonlyRow({ label, value, valid }: { label: string; value: string; valid?: boolean }) {
  return (
    <FieldWithChip label={label} valid={valid}>
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">{value || '—'}</div>
    </FieldWithChip>
  );
}

/** Passport MRZ scanner — prefills the borrower form. Mounted in the origination borrower step. */
export function PassportScan({ onExtract }: { onExtract: (patch: Partial<Fields>) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PassportScanResult | null>(null);
  const [form, setForm] = useState<Fields>(EMPTY);

  const runScan = async (file: File) => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await api.scanPassport(file);
      setResult(r);
      setForm(r.fields);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) runScan(f);
    e.target.value = '';
  };

  const validOf = (key: string) => result?.perField.find((p) => p.key === key)?.valid;

  const confirm = () => {
    const patch: Partial<Fields> = {};
    if (form.fullName) patch.fullName = form.fullName;
    if (form.passportSeries) patch.passportSeries = form.passportSeries;
    if (form.passportNumber) patch.passportNumber = form.passportNumber;
    if (form.birthDate) patch.birthDate = form.birthDate;
    if (form.passportExpiry) patch.passportExpiry = form.passportExpiry;
    if (form.gender) patch.gender = form.gender;
    if (form.pinfl) patch.pinfl = form.pinfl;
    onExtract(patch);
    setResult(null);
  };

  const t = result ? tone(result.confidence) : null;

  return (
    <Card className="space-y-4 border-brand-100 bg-brand-50/40 dark:border-brand-500/20 dark:bg-brand-500/5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white"><IdCard className="h-5 w-5" /></span>
        <div>
          <h3 className="font-semibold text-gray-800 dark:text-white">Passportni skanerlash</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">MRZ (pastdagi 2 qator) o‘qiladi — maydonlar avtomatik to‘ladi</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white outline-none transition hover:bg-brand-700 focus-visible:ring-2 focus-visible:ring-brand-600/30">
          <Upload className="h-4 w-4" /> Rasm yuklash
          <input type="file" accept="image/*" className="hidden" onChange={onFile} />
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 outline-none transition hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-brand-600/30 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 sm:hidden">
          <Camera className="h-4 w-4" /> Kamera
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
        </label>
      </div>

      {busy && (
        <div className="flex items-center gap-3 rounded-lg bg-white/70 px-4 py-3 text-sm text-gray-600 dark:bg-white/5 dark:text-gray-300">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          Skanerlanmoqda…
        </div>
      )}
      {error && <p className="text-sm text-error-600 dark:text-error-500">{error}</p>}

      {result && t && (
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <ConfidenceRing value={result.confidence} className={t.ring} />
            <div>
              <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', t.chip)}>{t.label} · {result.confidence}%</span>
              {result.confidence < 60 && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Yorug‘roq joyda, tekis ushlab, MRZ (pastdagi qatorlar) to‘liq ko‘rinsin — qayta oling.</p>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="F.I.O"><Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></Field>
            <FieldWithChip label="Pasport seriya" valid={validOf('documentNumberCheckDigit')}>
              <Input value={form.passportSeries} onChange={(e) => setForm({ ...form, passportSeries: e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2) })} placeholder="AA" />
            </FieldWithChip>
            <FieldWithChip label="Pasport raqami" valid={validOf('documentNumberCheckDigit')}>
              <Input inputMode="numeric" value={form.passportNumber} onChange={(e) => setForm({ ...form, passportNumber: e.target.value.replace(/\D/g, '').slice(0, 7) })} />
            </FieldWithChip>
            <FieldWithChip label="PINFL" valid={validOf('personalNumberCheckDigit')}>
              <Input inputMode="numeric" value={form.pinfl} onChange={(e) => setForm({ ...form, pinfl: e.target.value.replace(/\D/g, '').slice(0, 14) })} />
            </FieldWithChip>
            <Field label="Jinsi">
              <Select value={form.gender} onChange={(v) => setForm({ ...form, gender: v as Fields['gender'] })} options={[{ value: 'MALE', label: 'Erkak' }, { value: 'FEMALE', label: 'Ayol' }]} />
            </Field>
            <ReadonlyRow label="Tug‘ilgan sana" value={fmtDate(form.birthDate)} valid={validOf('birthDateCheckDigit')} />
            <ReadonlyRow label="Amal qilish muddati" value={fmtDate(form.passportExpiry)} valid={validOf('expirationDateCheckDigit')} />
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={confirm}><CheckCircle2 className="h-4 w-4" /> Formani to‘ldirish</Button>
            <button type="button" onClick={() => setResult(null)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-gray-500 outline-none transition hover:text-gray-700 focus-visible:ring-2 focus-visible:ring-brand-600/30 dark:hover:text-gray-300">
              <RotateCcw className="h-4 w-4" /> Qayta
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
