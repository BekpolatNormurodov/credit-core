import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@credit-core/api-client';
import type { CollateralDto, TexScanResult } from '@credit-core/shared';
import { Button } from '../../components/primitives';
import { useToast } from '../../components/Toast';
import { Car, Upload, Check, RotateCcw, X, Warning } from '../../lib/icons';
import { CAR_MODELS } from '../../lib/cars';
import { matchCarColor, colorHex } from '../../lib/colors';

/** Snap an OCR'd model ("DAMAS", "CHEVROLET SPARK") to the closest known model in the dropdown list,
 *  so the required Model field lands on a valid, canonical value. Null when nothing overlaps. */
function matchCarModel(ocr: string): string | null {
  const words = new Set(ocr.toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length >= 3));
  if (!words.size) return null;
  let best: { model: string; score: number } | null = null;
  for (const model of CAR_MODELS) {
    const score = model.toUpperCase().split(/\s+/).filter((w) => w.length >= 3 && words.has(w)).length;
    if (score > 0 && (!best || score > best.score)) best = { model, score };
  }
  return best?.model ?? null;
}

type TexPatch = Partial<Pick<CollateralDto,
  'stateNumber' | 'model' | 'color' | 'year' | 'bodyType' | 'bodyNo' | 'chassis' | 'engineNo' | 'techPassportNo' | 'techPassportDate'>>;

const FIELD_LABEL: Record<string, string> = {
  stateNumber: 'Davlat raqami', model: 'Model', color: 'Rangi', ownerName: 'Egasi', address: 'Manzil',
  techPassportDate: 'Berilgan sana', issuer: 'Bergan bo‘lim', year: 'Yili', bodyType: 'Kuzov turi',
  bodyNo: 'Kuzov / VIN', chassis: 'Shassi', engineNo: 'Dvigatel raqami', techPassportNo: 'Guvohnoma seriyasi',
  regNumber: 'Ro‘yxat raqami', fullWeight: 'To‘la vazn', unladenWeight: 'Bo‘sh vazn', fuelType: 'Yoqilg‘i turi',
};

// The fields that are actually written to the collateral (and worth reviewing) — owner/address/issuer
// are read from the certificate but not collateral fields, so they're kept out of the result card.
const APPLIED_KEYS = new Set(['stateNumber', 'model', 'color', 'year', 'bodyType', 'bodyNo', 'chassis', 'engineNo', 'techPassportNo', 'techPassportDate']);

/** Scanner state kept across step/page navigation (lost only on a full reload). So an operator who
 *  uploads + scans, jumps to another wizard step, and comes back finds the images + result still there.
 *  Keyed per collateral; images are File objects held in memory (no storage size limit). */
type TexScanState = { front: File | null; back: File | null; result: TexScanResult | null };
const texScanStore = new Map<string, TexScanState>();

/** Tex passport (avto guvohnoma) skaneri — old + orqa rasm → avto garov maydonlarini to‘ldiradi. */
export function TexScan({ storeKey, onExtract, onScanImages }: {
  /** Stable key (per collateral) — when set, the uploaded images + result survive step/page switches. */
  storeKey?: string;
  onExtract: (p: TexPatch) => void;
  /** On "Qo‘llash", the two scanned images are handed off (to save them as collateral media). */
  onScanImages?: (files: File[]) => void | Promise<void>;
}) {
  const toast = useToast();
  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);
  // Hydrate once from the store (lazy initializers run only on mount) so a remount restores the scan.
  const [front, setFront] = useState<File | null>(() => (storeKey ? texScanStore.get(storeKey)?.front ?? null : null));
  const [back, setBack] = useState<File | null>(() => (storeKey ? texScanStore.get(storeKey)?.back ?? null : null));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TexScanResult | null>(() => (storeKey ? texScanStore.get(storeKey)?.result ?? null : null));
  const [lightbox, setLightbox] = useState<string | null>(null);

  // Mirror the scanner state into the store on every change, so jumping between steps/pages and back
  // restores the uploaded images and the scan result instead of resetting to empty.
  useEffect(() => {
    if (storeKey) texScanStore.set(storeKey, { front, back, result });
  }, [storeKey, front, back, result]);

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
    // Model: snap to a known model, else keep the (already gated, clean) OCR value — a new model that
    // isn't in the list still fills the free-text dropdown.
    if (f.model) p.model = matchCarModel(f.model) ?? f.model;
    // Snap the OCR colour to a canonical car colour ("OQ BELIY" → "Oq"); keep free text if unknown.
    if (f.color) p.color = matchCarColor(f.color) ?? f.color;
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
          {result.confidence < 60 && (
            <p className="flex items-start gap-1.5 rounded-lg bg-warning-50 px-2.5 py-1.5 text-[11px] text-warning-700 dark:bg-warning-500/10 dark:text-warning-400">
              <Warning className="mt-px h-3.5 w-3.5 shrink-0" />
              Rasm qiya yoki xira bo‘lishi mumkin. Old va orqa tomonni <b>tekis</b>, <b>to‘g‘ri</b> va <b>yorug‘</b> joyda, kadrni to‘ldirib qayta oling.
            </p>
          )}
          {/* Applied collateral fields first, then the informational ones (owner / address / issuer). */}
          {(() => {
            const applied = result.perField.filter((pf) => APPLIED_KEYS.has(pf.key));
            const info = result.perField.filter((pf) => !APPLIED_KEYS.has(pf.key));
            const cell = (pf: { key: string; value: string }) => {
              // Show the same canonical values that "Qo'llash" applies: full model ("SPARK" → "Chevrolet
              // Spark") and canonical colour ("OQ BELIY" → "Oq") + a swatch. So the review matches the form.
              const isColor = pf.key === 'color';
              const value = pf.key === 'model'
                ? (matchCarModel(pf.value) ?? pf.value)
                : isColor ? (matchCarColor(pf.value) ?? pf.value) : pf.value;
              const hex = isColor ? colorHex(value) : undefined;
              return (
                <div key={pf.key} className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-gray-400">{FIELD_LABEL[pf.key] ?? pf.key}</p>
                  <p className="flex items-center gap-1.5 text-xs font-medium text-gray-800 dark:text-gray-200">
                    {hex && <span className="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/15 dark:ring-white/25" style={{ backgroundColor: hex }} />}
                    <span className="truncate">{value}</span>
                  </p>
                </div>
              );
            };
            return (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-lg bg-white p-2.5 dark:bg-white/5">
                  {applied.length === 0 && <p className="col-span-2 text-xs text-error-600">Hech narsa aniq o‘qilmadi — rasmlarni yorug‘/tekis oling</p>}
                  {applied.map(cell)}
                </div>
                {info.length > 0 && (
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-lg border border-dashed border-gray-200 p-2.5 dark:border-gray-700">
                    {info.map(cell)}
                  </div>
                )}
              </div>
            );
          })()}
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
