import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@credit-core/api-client';
import { CaseStatus, ProductType, type CollateralDto, type UpsertCasePayload } from '@credit-core/shared';
import { Button, Card, Field, Input, StatusBadge, Skeleton } from '../components/primitives';
import { PassportInput, PlateInput, KadastrInput, digitsOnly } from '../components/forms';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import {
  People, House, Car, Bank, IdCard, ShieldCheck, Lock, Search, Plus, Check, Info, ArrowRight, Calendar, Inbox, type IconProps,
} from '../lib/icons';
import { cn } from '../lib/cn';

/**
 * "Hujjatlar tekshirish" — standalone registry-lookup tool. The operator enters a client identifier
 * (PINFL / passport / kadastr № / davlat raqami / STIR) and queries one of five state registries via
 * the e-gov IIP-XAB gateway. The gateway integration is not live yet, so the result card is a
 * SIMULATION ("yaqinda"): fields show "—". "Arizaga qo'shish" carries the entered identifier into a
 * new application (draft) so the borrower/collateral is pre-filled once integration goes live.
 */

type RegKey = 'pop' | 'cad' | 'veh' | 'tax' | 'civ';
type Vals = Record<string, string>;
type Prefill = { borrower?: Partial<UpsertCasePayload['borrower']>; collateral?: { type: ProductType; patch: Partial<CollateralDto> } };

type InputDef = { id: string; label: string; kind: 'pinfl' | 'passport' | 'plate' | 'stir' | 'kadastr' | 'text'; placeholder?: string; hint?: string };
type Reg = {
  key: RegKey;
  code: string;
  name: string;
  sub: string;
  Icon: (p: IconProps) => JSX.Element;
  inputs: InputDef[];
  result: string[];
  canCheck: (v: Vals) => boolean;
  prefill: (v: Vals) => Prefill;
};

// Per-registry accent — literal Tailwind classes (JIT can't see templated names).
const TONE: Record<RegKey, { icon: string; tabOn: string }> = {
  pop: { icon: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400', tabOn: 'border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-300' },
  cad: { icon: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400', tabOn: 'border-violet-400 bg-violet-50 text-violet-700 dark:border-violet-500/40 dark:bg-violet-500/10 dark:text-violet-300' },
  veh: { icon: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400', tabOn: 'border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300' },
  tax: { icon: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400', tabOn: 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300' },
  civ: { icon: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400', tabOn: 'border-rose-400 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300' },
};

/** Split a scanned passport "AA1234567" into { series, number }. */
const splitPassport = (raw: string) => {
  const v = (raw ?? '').toUpperCase();
  return {
    series: (v.match(/[A-Z]/g) ?? []).slice(0, 2).join(''),
    number: (v.match(/\d/g) ?? []).slice(0, 7).join(''),
  };
};

const REGISTRIES: Reg[] = [
  {
    key: 'pop', code: 'Reyestr · aholi', name: 'Aholi davlat reyestri', sub: 'Shaxsga oid ma’lumotlar', Icon: People,
    inputs: [
      { id: 'pinfl', label: 'PINFL', kind: 'pinfl', hint: '14 raqam' },
      { id: 'passport', label: 'Pasport', kind: 'passport' },
    ],
    result: ['F.I.Sh.', 'Tug’ilgan sana', 'Tug’ilgan joy', 'Jinsi', 'Fuqaroligi', 'Pasport / ID karta', 'Manzil'],
    canCheck: (v) => digitsOnly(v.pinfl ?? '', 14).length === 14 || (v.passport ?? '').length === 9,
    prefill: (v) => {
      const b: Partial<UpsertCasePayload['borrower']> = {};
      const pinfl = digitsOnly(v.pinfl ?? '', 14);
      if (pinfl.length === 14) b.pinfl = pinfl;
      const { series, number } = splitPassport(v.passport ?? '');
      if (series.length === 2) b.passportSeries = series;
      if (number.length === 7) b.passportNumber = number;
      return { borrower: b };
    },
  },
  {
    key: 'cad', code: 'Reyestr · kadastr', name: 'Kadastr agentligi', sub: 'Ko’chmas mulk obyektlari', Icon: House,
    inputs: [{ id: 'kadastr', label: 'Kadastr raqami', kind: 'kadastr' }],
    result: ['Obyekt turi', 'Manzil', 'Maydon (m²)', 'Holati', 'Kadastr raqami'],
    canCheck: (v) => (v.kadastr ?? '').replace(/\D/g, '').length >= 12,
    prefill: (v) => ({ collateral: { type: ProductType.REAL_ESTATE, patch: { cadastreNo: (v.kadastr ?? '').trim() } } }),
  },
  {
    key: 'veh', code: 'Reyestr · YHXX', name: 'YHXX', sub: 'Transport vositalari', Icon: Car,
    inputs: [{ id: 'plate', label: 'Davlat raqami', kind: 'plate' }],
    result: ['Marka', 'Model', 'Ishlab chiqarilgan yili', 'Kuzov / VIN', 'Davlat raqami'],
    canCheck: (v) => (v.plate ?? '').replace(/[^A-Z0-9]/g, '').length >= 6,
    prefill: (v) => ({ collateral: { type: ProductType.AUTO, patch: { stateNumber: (v.plate ?? '').replace(/\s/g, '') } } }),
  },
  {
    key: 'tax', code: 'Reyestr · soliq', name: 'Soliq qo’mitasi', sub: 'Biznes va soliq ma’lumotlari', Icon: Bank,
    inputs: [{ id: 'stir', label: 'STIR', kind: 'stir', hint: '9 raqam' }],
    result: ['STIR', 'Tashkiliy shakl (YATT / MCHJ)', 'Faoliyat turi', 'Soliq holati'],
    canCheck: (v) => digitsOnly(v.stir ?? '', 9).length === 9,
    prefill: (v) => ({ borrower: { inn: digitsOnly(v.stir ?? '', 9) } }),
  },
  {
    key: 'civ', code: 'Reyestr · FHDYO', name: 'FHDYO', sub: 'Fuqarolik holati dalolatnomalari', Icon: IdCard,
    inputs: [{ id: 'pinfl', label: 'PINFL', kind: 'pinfl', hint: '14 raqam' }],
    result: ['Oilaviy holat', 'Nikoh', 'Bolalar', 'Vafot holati'],
    canCheck: (v) => digitsOnly(v.pinfl ?? '', 14).length === 14,
    prefill: (v) => ({ borrower: { pinfl: digitsOnly(v.pinfl ?? '', 14) } }),
  },
];

function QueryInput({ inp, value, onChange }: { inp: InputDef; value: string; onChange: (v: string) => void }) {
  switch (inp.kind) {
    case 'pinfl': return <Input className="nums" inputMode="numeric" maxLength={14} value={value} onChange={(e) => onChange(digitsOnly(e.target.value, 14))} placeholder={inp.placeholder ?? '14 raqam'} />;
    case 'stir': return <Input className="nums" inputMode="numeric" maxLength={9} value={value} onChange={(e) => onChange(digitsOnly(e.target.value, 9))} placeholder={inp.placeholder ?? '9 raqam'} />;
    case 'passport': return <PassportInput value={value} onChange={onChange} />;
    case 'plate': return <PlateInput value={value} onChange={onChange} />;
    case 'kadastr': return <KadastrInput value={value} onChange={onChange} />;
    default: return <Input className="nums" value={value} onChange={(e) => onChange(e.target.value)} placeholder={inp.placeholder} />;
  }
}

/** The entered identifier, echoed back in the result so the "document" reads as a reply to the query. */
const queryLabel = (reg: Reg, v: Vals): string => reg.inputs.map((i) => (v[i.id] ?? '').trim()).filter(Boolean).join(' · ');

/** Loading placeholder — a shimmer skeleton in the result's shape, with a "querying the gateway" note.
 *  Progressive-loading: shows structure instead of a blank wait; `.skeleton` freezes under reduced-motion. */
function ResultSkeleton({ reg }: { reg: Reg }) {
  return (
    <div className="mt-5 cc-rise rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-white/5">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="skeleton h-9 w-9 rounded-lg" />
        <div className="flex-1 space-y-1.5"><span className="skeleton block h-3 w-28 rounded" /><span className="skeleton block h-2.5 w-20 rounded" /></div>
      </div>
      <div className="space-y-2 rounded-lg bg-gray-50 px-3 py-2.5 dark:bg-white/5">
        {reg.result.map((_, i) => <span key={i} className="skeleton block h-3 w-full rounded" />)}
      </div>
      <p className="mt-3 flex items-center gap-2 text-[11px] text-gray-400 dark:text-gray-500">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
        IIP / XAB shlyuziga so&apos;rov yuborilmoqda&hellip;
      </p>
    </div>
  );
}

/** The "document" a registry returns — a simulation card (fields "—"), a divider, a "yaqinda" note. */
function ResultCard({ reg, query, onAdd }: { reg: Reg; query: string; onAdd: () => void }) {
  const tone = TONE[reg.key];
  return (
    <div className="mt-5 cc-rise rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-white/5">
      <div className="mb-3 flex items-center gap-2.5">
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', tone.icon)}><reg.Icon className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 dark:text-white">
            Reyestr javobi
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-success-600 text-white"><Check className="h-3 w-3" /></span>
          </p>
          <p className="truncate text-[11px] text-gray-400 dark:text-gray-500">{reg.name}{query && <> &middot; <span className="nums">{query}</span></>}</p>
        </div>
      </div>
      <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-white/5">
        {reg.result.map((label) => (
          <div key={label} className="flex items-center justify-between gap-2 py-0.5">
            <span className="text-[11px] text-gray-500 dark:text-gray-400">{label}</span>
            <span className="nums text-xs font-medium text-gray-400 dark:text-gray-500">&mdash;</span>
          </div>
        ))}
      </div>
      {/* "---" divider, then the "yaqinda" note + the add-to-application action. */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-gray-200 pt-3 dark:border-gray-700">
        <p className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500">
          <Info className="h-3.5 w-3.5" />
          Real ma&apos;lumot IIP / XAB orqali &middot;
          <span className="rounded bg-amber-50 px-1 font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">yaqinda</span>
        </p>
        <Button variant="primary" onClick={onAdd}><Plus className="h-4 w-4" /> Arizaga qo&apos;shish</Button>
      </div>
    </div>
  );
}

/** "Arizaga qo'shish" target picker — create a new ariza, or search an existing DRAFT and add the
 *  queried identifier to it. Both carry the prefill via router state (applied by useOriginationForm). */
function AddToArizaModal({ open, onClose, prefill, regName }: { open: boolean; onClose: () => void; prefill: Prefill; regName: string }) {
  const nav = useNavigate();
  const toast = useToast();
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => { const t = setTimeout(() => setDebounced(term.trim()), 300); return () => clearTimeout(t); }, [term]);
  const enabled = debounced.length >= 2;
  const q = useQuery({ queryKey: ['draft-search', debounced], queryFn: () => api.searchCases(debounced), enabled });
  // Only DRAFTs are editable in origination — a submitted case can't take new data here.
  const drafts = (q.data ?? []).filter((c) => c.status === CaseStatus.DRAFT);
  const goNew = () => { nav('/cases/new', { state: { prefill } }); toast.success('Yangi ariza', `${regName} ma’lumoti bilan`); };
  const goDraft = (id: string) => { nav(`/cases/${id}/origination`, { state: { prefill } }); toast.success('Qoralamaga qo’shildi', `${regName} ma’lumoti o’tkazildi`); };

  return (
    <Modal open={open} onClose={onClose} title="Arizaga qo'shish" description={`${regName} ma'lumoti qayerga qo'shilsin?`} size="md">
      <div className="space-y-4">
        <Button variant="primary" className="w-full" onClick={goNew}><Plus className="h-4 w-4" /> Yangi ariza yaratish</Button>
        <div className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
          <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />yoki mavjud qoralamaga<span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Qoralama: F.I.O, PINFL, raqam…" className="pl-11" autoFocus />
        </div>
        {!enabled && <p className="text-xs text-gray-400 dark:text-gray-500">Qoralamani qidirish uchun kamida 2 ta belgi kiriting.</p>}
        {enabled && q.isFetching && <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>}
        {enabled && !q.isFetching && drafts.length === 0 && (
          <div className="flex flex-col items-center gap-1.5 py-6 text-center">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-gray-100 text-gray-400 dark:bg-white/5"><Inbox className="h-5 w-5" /></span>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Qoralama topilmadi</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">Yangi ariza yarating yoki boshqacha qidiring.</p>
          </div>
        )}
        {drafts.length > 0 && (
          <div className="space-y-2">
            {drafts.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => goDraft(c.id)}
                className="group flex w-full cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 text-left transition hover:border-brand-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30 dark:border-gray-800 dark:bg-white/5 dark:hover:border-brand-500/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-semibold text-gray-800 dark:text-white">{c.borrowerName || 'Nomsiz qoralama'}</span>
                    <span className="nums rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-600 dark:bg-white/10 dark:text-gray-300">{c.contractNumber ?? c.number}</span>
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400"><Calendar className="h-3.5 w-3.5" /> {new Date(c.updatedAt).toLocaleDateString()}</p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition group-hover:bg-brand-700">Qo&apos;shish <ArrowRight className="h-4 w-4" /></span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

type Status = 'idle' | 'loading' | 'done';
const isRegKey = (k: string | null): k is RegKey => !!k && REGISTRIES.some((r) => r.key === k);

export function DocCheckPage() {
  const [params, setParams] = useSearchParams();
  const [addOpen, setAddOpen] = useState(false);
  // Active registry lives in the URL (?reg=veh) — deep-linkable and the browser Back button works.
  const active: RegKey = isRegKey(params.get('reg')) ? (params.get('reg') as RegKey) : 'pop';
  const setActive = (k: RegKey) => setParams((p) => { const n = new URLSearchParams(p); n.set('reg', k); return n; }, { replace: true });

  const [inputs, setInputs] = useState<Record<RegKey, Vals>>({ pop: {}, cad: {}, veh: {}, tax: {}, civ: {} });
  const [status, setStatus] = useState<Record<RegKey, Status>>({ pop: 'idle', cad: 'idle', veh: 'idle', tax: 'idle', civ: 'idle' });
  const timers = useRef<Partial<Record<RegKey, ReturnType<typeof setTimeout>>>>({});
  useEffect(() => () => { Object.values(timers.current).forEach((t) => t && clearTimeout(t)); }, []);

  const reg = REGISTRIES.find((r) => r.key === active)!;
  const vals = inputs[active];
  // Editing the identifier invalidates a shown result — reset to idle so it must be re-checked.
  const setVal = (id: string, v: string) => {
    setInputs((s) => ({ ...s, [active]: { ...s[active], [id]: v } }));
    setStatus((s) => (s[active] === 'idle' ? s : { ...s, [active]: 'idle' }));
  };
  // Simulate the gateway round-trip: loading feedback → result. Real IIP/XAB latency will replace this.
  const check = () => {
    const key = active;
    if (timers.current[key]) clearTimeout(timers.current[key]);
    setStatus((s) => ({ ...s, [key]: 'loading' }));
    timers.current[key] = setTimeout(() => setStatus((s) => ({ ...s, [key]: 'done' })), 700);
  };
  const addToApplication = () => setAddOpen(true);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Hujjatlar tekshirish</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Mijoz identifikatori (PINFL, pasport, kadastr &#8470;, davlat raqami yoki STIR) asosida davlat reyestrlaridan ma&apos;lumot olinadi.
        </p>
      </div>

      {/* Secure-channel banner — IIP/XAB gateway, encrypted transport. */}
      <Card className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400"><ShieldCheck className="h-6 w-6" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-800 dark:text-white">Elektron hukumat &middot; IIP / XAB shlyuzi</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Almashinuv shifrlangan kanal orqali &mdash; ma&apos;lumotlar MKO tomonda saqlanmaydi.</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {['HTTPS', 'VPN', 'TLS', 'Raqamli sertifikat'].map((c) => (
            <span key={c} className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-600 dark:border-gray-700 dark:bg-white/5 dark:text-gray-300">
              <Lock className="h-3 w-3 text-gray-400" />{c}
            </span>
          ))}
        </div>
      </Card>

      <Card className="space-y-5">
        {/* One tab per registry — an ARIA tablist so keyboard/screen-reader users get proper semantics. */}
        <ol role="tablist" aria-label="Davlat reyestrlari" className="flex flex-wrap gap-2">
          {REGISTRIES.map((r) => {
            const cur = active === r.key;
            return (
              <li key={r.key} role="presentation">
                <button
                  type="button"
                  role="tab"
                  id={`reg-tab-${r.key}`}
                  aria-selected={cur}
                  aria-controls="reg-panel"
                  onClick={() => setActive(r.key)}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30',
                    cur ? cn('ring-2 ring-brand-500/20', TONE[r.key].tabOn) : 'border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-white/5',
                  )}
                >
                  <span className={cn('flex h-5 w-5 items-center justify-center rounded-md', TONE[r.key].icon)}><r.Icon className="h-3.5 w-3.5" /></span>
                  {r.name}
                </button>
              </li>
            );
          })}
        </ol>

        {/* Active registry: header + query form + check. */}
        <div id="reg-panel" role="tabpanel" aria-labelledby={`reg-tab-${active}`}>
          <div className="mb-4 flex items-start gap-3">
            <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', TONE[active].icon)}><reg.Icon className="h-6 w-6" /></span>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">{reg.code}</p>
              <p className="text-base font-semibold text-gray-800 dark:text-white">{reg.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{reg.sub}</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {reg.inputs.map((inp) => (
              <Field key={inp.id} label={inp.label} hint={inp.hint}>
                <QueryInput inp={inp} value={vals[inp.id] ?? ''} onChange={(v) => setVal(inp.id, v)} />
              </Field>
            ))}
          </div>
          <div className="mt-4">
            <Button variant="secondary" onClick={check} loading={status[active] === 'loading'} disabled={!reg.canCheck(vals)}>
              <Search className="h-4 w-4" /> Tekshirish
            </Button>
          </div>

          {/* Result region — announced to screen readers when it appears (aria-live). */}
          <div role="region" aria-live="polite" aria-label="Reyestr javobi">
            {status[active] === 'idle' && (
              <div className="mt-5 flex items-center gap-3 rounded-xl border border-dashed border-gray-200 bg-gray-50/60 px-4 py-6 text-sm text-gray-400 dark:border-gray-700 dark:bg-white/5 dark:text-gray-500">
                <Search className="h-5 w-5 shrink-0" />
                <span>Identifikatorni kiriting va <b className="font-medium text-gray-600 dark:text-gray-300">Tekshirish</b> tugmasini bosing &mdash; reyestr javobi shu yerda ko&apos;rinadi.</span>
              </div>
            )}
            {status[active] === 'loading' && <ResultSkeleton reg={reg} />}
            {status[active] === 'done' && <ResultCard reg={reg} query={queryLabel(reg, vals)} onAdd={addToApplication} />}
          </div>
        </div>
      </Card>

      <AddToArizaModal open={addOpen} onClose={() => setAddOpen(false)} prefill={reg.prefill(vals)} regName={reg.name} />
    </div>
  );
}
