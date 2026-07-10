import { useRef, useState } from 'react';
import { api } from '@credit-core/api-client';
import type { CollateralDto, TexScanResult } from '@credit-core/shared';
import { Button } from '../../components/primitives';
import { useToast } from '../../components/Toast';
import { Car, Upload, Check, RotateCcw } from '../../lib/icons';

type TexPatch = Partial<Pick<CollateralDto,
  'stateNumber' | 'model' | 'color' | 'year' | 'bodyType' | 'bodyNo' | 'chassis' | 'engineNo' | 'techPassportNo' | 'techPassportDate'>>;

const FIELD_LABEL: Record<string, string> = {
  stateNumber: 'Davlat raqami', model: 'Model', color: 'Rangi', ownerName: 'Egasi', address: 'Manzil',
  techPassportDate: 'Berilgan sana', issuer: 'Bergan bo‘lim', year: 'Yili', bodyType: 'Kuzov turi',
  bodyNo: 'Kuzov / VIN', chassis: 'Shassi', engineNo: 'Dvigatel raqami', techPassportNo: 'Guvohnoma seriyasi',
};

/** Tex passport (avto guvohnoma) skaneri — old + orqa rasm → avto garov maydonlarini to‘ldiradi. */
export function TexScan({ onExtract }: { onExtract: (p: TexPatch) => void }) {
  const toast = useToast();
  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TexScanResult | null>(null);

  const run = async () => {
    if (!front || !back) return;
    setBusy(true);
    try { setResult(await api.scanTex(front, back)); }
    catch { toast.error('Skanlanmadi', 'Qayta urinib ko‘ring'); }
    finally { setBusy(false); }
  };

  const apply = () => {
    if (!result) return;
    const f = result.fields;
    const p: TexPatch = {};
    if (f.stateNumber) p.stateNumber = f.stateNumber;
    if (f.model) p.model = f.model;
    if (f.color) p.color = f.color;
    if (f.year != null) p.year = f.year;
    if (f.bodyType) p.bodyType = f.bodyType;
    if (f.bodyNo) p.bodyNo = f.bodyNo;
    if (f.chassis) p.chassis = f.chassis;
    if (f.engineNo) p.engineNo = f.engineNo;
    if (f.techPassportNo) p.techPassportNo = f.techPassportNo;
    if (f.techPassportDate) p.techPassportDate = f.techPassportDate;
    onExtract(p);
    toast.success('Qo‘llandi', 'Tex passport maydonlari');
    setResult(null); setFront(null); setBack(null);
  };

  const slot = (label: string, file: File | null, ref: React.RefObject<HTMLInputElement>, set: (f: File | null) => void) => (
    <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-gray-300 px-3 py-4 text-center text-xs transition hover:border-brand-400 focus-within:ring-2 focus-within:ring-brand-600/30 dark:border-gray-700">
      <Upload className="h-5 w-5 text-gray-400" />
      <span className="font-medium text-gray-700 dark:text-gray-200">{label}</span>
      {file ? <span className="max-w-[140px] truncate text-[11px] text-success-600 dark:text-success-400">{file.name}</span> : <span className="text-[11px] text-gray-400">Rasm tanlang</span>}
      <input ref={ref} type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => { set(e.target.files?.[0] ?? null); e.target.value = ''; }} />
    </label>
  );

  return (
    <div className="space-y-3 rounded-xl border border-brand-100 bg-brand-50/40 p-3 dark:border-brand-500/20 dark:bg-brand-500/5">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white"><Car className="h-4 w-4" /></span>
        <div>
          <h4 className="text-sm font-semibold text-gray-800 dark:text-white">Tex passport skaneri</h4>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">Old + orqa rasm → avto maydonlari avtomatik to‘ladi (tekshirib tasdiqlang)</p>
        </div>
      </div>

      {!result ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            {slot('Old tomon', front, frontRef, setFront)}
            {slot('Orqa tomon', back, backRef, setBack)}
          </div>
          <Button className="w-full" loading={busy} disabled={!front || !back} onClick={run}>
            <Upload className="h-4 w-4" /> Skanerlash
          </Button>
        </>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">Ishonch: <b className={result.confidence >= 60 ? 'text-success-600' : 'text-warning-600'}>{result.confidence}%</b> — maydonlarni tekshiring</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-lg bg-white p-2.5 dark:bg-white/5">
            {result.perField.length === 0 && <p className="col-span-2 text-xs text-error-600">Hech narsa o‘qilmadi — rasmlarni yorug‘/tekis oling</p>}
            {result.perField.map((pf) => (
              <div key={pf.key} className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-gray-400">{FIELD_LABEL[pf.key] ?? pf.key}</p>
                <p className="truncate text-xs font-medium text-gray-800 dark:text-gray-200">{pf.value}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setResult(null)}><RotateCcw className="h-4 w-4" /> Qayta</Button>
            <Button className="flex-1" onClick={apply}><Check className="h-4 w-4" /> Qo‘llash</Button>
          </div>
        </div>
      )}
    </div>
  );
}
