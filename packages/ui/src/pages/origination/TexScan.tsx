import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@credit-core/api-client';
import type { CollateralDto, TexScanResult } from '@credit-core/shared';
import { Button } from '../../components/primitives';
import { useToast } from '../../components/Toast';
import { Car, Upload, Check, RotateCcw, X } from '../../lib/icons';

type TexPatch = Partial<Pick<CollateralDto,
  'stateNumber' | 'model' | 'color' | 'year' | 'bodyType' | 'bodyNo' | 'chassis' | 'engineNo' | 'techPassportNo' | 'techPassportDate'>>;

const FIELD_LABEL: Record<string, string> = {
  stateNumber: 'Davlat raqami', model: 'Model', color: 'Rangi', ownerName: 'Egasi', address: 'Manzil',
  techPassportDate: 'Berilgan sana', issuer: 'Bergan bo‘lim', year: 'Yili', bodyType: 'Kuzov turi',
  bodyNo: 'Kuzov / VIN', chassis: 'Shassi', engineNo: 'Dvigatel raqami', techPassportNo: 'Guvohnoma seriyasi',
};

/** Tex passport (avto guvohnoma) skaneri — old + orqa rasm → avto garov maydonlarini to‘ldiradi. */
export function TexScan({ onExtract, onScanImages }: {
  onExtract: (p: TexPatch) => void;
  /** On "Qo‘llash", the two scanned images are handed off (to save them as collateral media). */
  onScanImages?: (files: File[]) => void | Promise<void>;
}) {
  const toast = useToast();
  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TexScanResult | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  // Object URLs for the thumbnails (images only) — created once per file, revoked on change/unmount.
  const frontUrl = useMemo(() => (front && front.type.startsWith('image/') ? URL.createObjectURL(front) : null), [front]);
  const backUrl = useMemo(() => (back && back.type.startsWith('image/') ? URL.createObjectURL(back) : null), [back]);
  useEffect(() => () => { if (frontUrl) URL.revokeObjectURL(frontUrl); }, [frontUrl]);
  useEffect(() => () => { if (backUrl) URL.revokeObjectURL(backUrl); }, [backUrl]);

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
    // Hand the two scanned images off to be saved as this collateral's media, then clear.
    if (onScanImages && front && back) void onScanImages([front, back]);
    toast.success('Qo‘llandi', 'Tex passport maydonlari');
    setResult(null); setFront(null); setBack(null);
  };

  const slot = (label: string, file: File | null, url: string | null, ref: React.RefObject<HTMLInputElement>, set: (f: File | null) => void) => (
    <div className="relative">
      <input ref={ref} type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => { set(e.target.files?.[0] ?? null); e.target.value = ''; }} />
      {file ? (
        <div className="relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
          <button type="button" onClick={() => url && setLightbox(url)} className="block w-full outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30" aria-label={`${label} — kattalashtirish`}>
            {url
              ? <img src={url} alt={label} className="h-24 w-full object-cover" />
              : <span className="flex h-24 w-full items-center justify-center bg-gray-100 text-[11px] text-gray-500 dark:bg-white/5">PDF</span>}
          </button>
          <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white">{label}</span>
          <button type="button" onClick={() => ref.current?.click()} className="absolute right-1 top-1 rounded bg-white/85 px-1.5 py-0.5 text-[10px] font-medium text-gray-700 shadow-sm transition hover:bg-white">almashtirish</button>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()} className="flex w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-gray-300 px-3 py-6 text-center text-xs outline-none transition hover:border-brand-400 focus-visible:ring-2 focus-visible:ring-brand-600/30 dark:border-gray-700">
          <Upload className="h-5 w-5 text-gray-400" />
          <span className="font-medium text-gray-700 dark:text-gray-200">{label}</span>
          <span className="text-[11px] text-gray-400">Rasm tanlang</span>
        </button>
      )}
    </div>
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
            {slot('Old tomon', front, frontUrl, frontRef, setFront)}
            {slot('Orqa tomon', back, backUrl, backRef, setBack)}
          </div>
          <Button className="w-full" loading={busy} disabled={!front || !back} onClick={run}>
            <Upload className="h-4 w-4" /> Skanerlash
          </Button>
        </>
      ) : (
        <div className="space-y-2">
          {/* Scanned images (both), viewable — like the passport/ID scanner. */}
          <div className="grid grid-cols-2 gap-2">
            {([{ lbl: 'Old', url: frontUrl }, { lbl: 'Orqa', url: backUrl }] as const).map(({ lbl, url }) => url && (
              <button key={lbl} type="button" onClick={() => setLightbox(url)} className="relative block overflow-hidden rounded-lg border border-gray-200 outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30 dark:border-gray-700">
                <img src={url} alt={lbl} className="h-20 w-full object-cover" />
                <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white">{lbl}</span>
              </button>
            ))}
          </div>
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

      {lightbox && (
        <div onClick={() => setLightbox(null)} role="dialog" aria-modal className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-6">
          <img src={lightbox} alt="" className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-2xl" />
          <button type="button" aria-label="Yopish" className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"><X className="h-5 w-5" /></button>
        </div>
      )}
    </div>
  );
}
