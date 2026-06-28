import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronDown, ArrowRight } from '../lib/icons';
import { Input } from './primitives';
import { cn } from '../lib/cn';

/** Anchored popover rendered in a portal (never clipped by overflow/modals). */
function Popover({
  anchorRef, open, onClose, width, children,
}: {
  anchorRef: React.RefObject<HTMLElement>;
  open: boolean;
  onClose: () => void;
  width?: number;
  children: React.ReactNode;
}) {
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; width: number; openUp: boolean } | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    const place = () => {
      const r = anchorRef.current!.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom;
      const openUp = spaceBelow < 280 && r.top > spaceBelow;
      setPos({ left: r.left, top: openUp ? r.top : r.bottom, width: width ?? r.width, openUp });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => { window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place); };
  }, [open, anchorRef, width]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popRef.current && !popRef.current.contains(t) && anchorRef.current && !anchorRef.current.contains(t)) onClose();
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open, onClose, anchorRef]);

  if (!open || !pos) return null;
  return createPortal(
    <div
      ref={popRef}
      style={{ position: 'fixed', left: pos.left, top: pos.top, width: pos.width, transform: pos.openUp ? 'translateY(-100%)' : undefined }}
      className="z-[200]"
    >
      <div className="my-1 rounded-xl border border-gray-200 bg-white p-1 shadow-pop dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100">
        {children}
      </div>
    </div>,
    document.body,
  );
}

const fieldBase =
  'flex w-full items-center rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 outline-none transition focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 min-h-[44px]';

/** Money input — masks the value with thousand separators as you type. */
export function MoneyInput({
  value, onChange, placeholder, suffix = "so'm",
}: { value: number | null; onChange: (n: number | null) => void; placeholder?: string; suffix?: string }) {
  const display = value == null ? '' : new Intl.NumberFormat('ru-RU').format(value);
  return (
    <div className={cn(fieldBase, 'pr-2')}>
      <input
        inputMode="numeric"
        value={display}
        placeholder={placeholder ?? '0'}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d]/g, '');
          onChange(raw === '' ? null : Number(raw));
        }}
        className="nums w-full bg-transparent outline-none placeholder:text-slate-400"
      />
      <span className="ml-2 shrink-0 text-xs font-medium text-muted">{suffix}</span>
    </div>
  );
}

/** O'zbek telefon raqami maskasi: +998 XX XXX XX XX (9 ta milliy raqam). */
export function formatUzPhone(raw: string): string {
  let d = (raw ?? '').replace(/\D/g, '');
  if (d.startsWith('998')) d = d.slice(3);
  d = d.slice(0, 9);
  if (!d) return '';
  let out = '+998';
  if (d.length > 0) out += ' ' + d.slice(0, 2);
  if (d.length > 2) out += ' ' + d.slice(2, 5);
  if (d.length > 5) out += ' ' + d.slice(5, 7);
  if (d.length > 7) out += ' ' + d.slice(7, 9);
  return out;
}

export function PhoneInput({
  value, onChange, placeholder = '+998 90 123 45 67',
}: { value: string | null; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <Input
      inputMode="tel"
      value={value ?? ''}
      placeholder={placeholder}
      maxLength={17}
      onChange={(e) => onChange(formatUzPhone(e.target.value))}
    />
  );
}

/** Pasport: 2 ta harf + 7 ta raqam (masalan AA1234567). */
export function formatPassport(raw: string): string {
  const v = (raw ?? '').toUpperCase();
  const letters = (v.match(/[A-Z]/g) ?? []).slice(0, 2).join('');
  const digits = (v.match(/[0-9]/g) ?? []).slice(0, 7).join('');
  return letters + digits;
}

export function PassportInput({
  value, onChange, placeholder = 'AA1234567',
}: { value: string | null; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <Input
      value={value ?? ''}
      placeholder={placeholder}
      maxLength={9}
      autoCapitalize="characters"
      onChange={(e) => onChange(formatPassport(e.target.value))}
    />
  );
}

/** Faqat raqam, berilgan uzunlikgacha (PINFL=14, pasport raqami=7, ...). */
export function digitsOnly(raw: string, max: number): string {
  return (raw ?? '').replace(/\D/g, '').slice(0, max);
}

/**
 * O'zbekiston davlat raqami maskasi.
 *  - shaxsiy:    01 A 123 BC  (hudud + harf + 3 raqam + 2 harf)
 *  - tijorat:    01 123 ABC   (hudud + 3 raqam + 3 harf)
 */
export function formatPlate(raw: string): string {
  const v = (raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  const region = v.slice(0, 2);
  const rest = v.slice(2);
  if (!region) return '';
  if (!rest) return region;
  if (/^[A-Z]/.test(rest)) {
    return [region, rest.slice(0, 1), rest.slice(1, 4), rest.slice(4, 6)].filter(Boolean).join(' ');
  }
  return [region, rest.slice(0, 3), rest.slice(3, 6)].filter(Boolean).join(' ');
}

export function PlateInput({
  value, onChange, placeholder = '01 A 123 BC',
}: { value: string | null; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <Input
      value={value ?? ''}
      placeholder={placeholder}
      maxLength={12}
      autoCapitalize="characters"
      onChange={(e) => onChange(formatPlate(e.target.value))}
    />
  );
}

export interface Option<T extends string> { value: T; label: string; icon?: React.ComponentType<{ className?: string }> }

/** Custom styled dropdown (replaces the unstyled native <select>); portal-based menu. */
export function Select<T extends string>({
  value, onChange, options, placeholder = 'Tanlang', searchable = false,
}: { value: T | ''; onChange: (v: T) => void; options: Option<T>[]; placeholder?: string; searchable?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const btnRef = useRef<HTMLButtonElement>(null);
  const sel = options.find((o) => o.value === value);
  // Preserve arbitrary values (e.g. imported/edited free text) that aren't in the list.
  const display = sel ? sel.label : value ? String(value) : '';
  const filtered = q ? options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())) : options;
  const close = () => { setOpen(false); setQ(''); };
  return (
    <>
      <button ref={btnRef} type="button" onClick={() => setOpen((o) => !o)} className={cn(fieldBase, 'justify-between text-left')}>
        <span className={cn('flex items-center gap-2 truncate', !display && 'text-slate-400')}>
          {sel?.icon && <sel.icon className="h-4 w-4" />}
          {display || placeholder}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-slate-400 transition', open && 'rotate-180')} />
      </button>
      <Popover anchorRef={btnRef} open={open} onClose={close}>
        {searchable && (
          <div className="mb-1 border-b border-hairline px-2 pb-1.5 dark:border-white/10">
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Qidirish…"
              className="w-full bg-transparent px-1 py-1.5 text-sm outline-none placeholder:text-slate-400 dark:text-slate-100" />
          </div>
        )}
        <div className="max-h-60 overflow-auto">
          {filtered.length === 0 && <p className="px-3 py-2 text-sm text-slate-400">Topilmadi</p>}
          {filtered.map((o) => (
            <button key={o.value} type="button" onClick={() => { onChange(o.value); close(); }}
              className={cn('flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-brand-50 dark:hover:bg-white/5', o.value === value && 'bg-brand-50 font-medium text-brand-700 dark:bg-brand-600/15 dark:text-brand-300')}>
              {o.icon && <o.icon className="h-4 w-4" />}
              {o.label}
            </button>
          ))}
        </div>
      </Popover>
    </>
  );
}

/** Multi-select with checkboxes + chips (portal menu). */
export function MultiSelect<T extends string>({
  value, onChange, options, placeholder = 'Tanlang', empty = 'Variant yo‘q',
}: { value: T[]; onChange: (v: T[]) => void; options: Option<T>[]; placeholder?: string; empty?: string }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const toggle = (v: T) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  const selected = options.filter((o) => value.includes(o.value));
  return (
    <>
      <button ref={btnRef} type="button" onClick={() => setOpen((o) => !o)} className={cn(fieldBase, 'min-h-[42px] justify-between text-left')}>
        <span className="flex flex-wrap items-center gap-1.5">
          {selected.length === 0 && <span className="text-slate-400">{placeholder}</span>}
          {selected.map((o) => (
            <span key={o.value} className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-1.5 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-600/15 dark:text-brand-300">
              {o.label}
              <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); toggle(o.value); }} className="text-brand-500 hover:text-danger-600">✕</span>
            </span>
          ))}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-slate-400 transition', open && 'rotate-180')} />
      </button>
      <Popover anchorRef={btnRef} open={open} onClose={() => setOpen(false)}>
        <div className="max-h-60 overflow-auto">
          {options.length === 0 && <p className="px-3 py-2 text-sm text-slate-400">{empty}</p>}
          {options.map((o) => {
            const on = value.includes(o.value);
            return (
              <button key={o.value} type="button" onClick={() => toggle(o.value)}
                className={cn('flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-brand-50 dark:hover:bg-white/5', on && 'font-medium text-brand-700 dark:text-brand-300')}>
                <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border', on ? 'border-brand-600 bg-brand-600 text-white' : 'border-hairline dark:border-white/20')}>
                  {on && <span className="text-[10px] leading-none">✓</span>}
                </span>
                {o.label}
              </button>
            );
          })}
        </div>
      </Popover>
    </>
  );
}

const MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
const WD = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];

/** Custom date picker with a calendar popover (portal-based, replaces native date input). */
export function DatePicker({ value, onChange, placeholder = 'kk.oo.yyyy' }: { value: string | null; onChange: (iso: string | null) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const sel = value ? new Date(value) : null;
  const [view, setView] = useState(() => (sel ? new Date(sel.getFullYear(), sel.getMonth(), 1) : new Date(2026, 5, 1)));

  const y = view.getFullYear(), m = view.getMonth();
  const firstDow = (new Date(y, m, 1).getDay() + 6) % 7; // Monday-first
  const days = new Date(y, m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const fmt = (d: Date) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;

  return (
    <>
      <button ref={btnRef} type="button" onClick={() => setOpen((o) => !o)} className={cn(fieldBase, 'justify-between text-left')}>
        <span className={cn('nums', !sel && 'text-slate-400')}>{sel ? fmt(sel) : placeholder}</span>
        <Calendar className="h-4 w-4 shrink-0 text-slate-400" />
      </button>
      <Popover anchorRef={btnRef} open={open} onClose={() => setOpen(false)} width={288}>
        <div className="p-2">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-white/10" onClick={() => setView(new Date(y, m - 1, 1))}><ArrowRight className="h-4 w-4 rotate-180" /></button>
            <span className="text-sm font-semibold">{MONTHS[m]} {y}</span>
            <button type="button" className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-white/10" onClick={() => setView(new Date(y, m + 1, 1))}><ArrowRight className="h-4 w-4" /></button>
          </div>
          <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-medium text-slate-400">{WD.map((w) => <span key={w}>{w}</span>)}</div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((d, i) => {
              if (d == null) return <span key={i} />;
              const date = new Date(y, m, d);
              const active = sel && date.toDateString() === sel.toDateString();
              return (
                <button key={i} type="button"
                  onClick={() => { onChange(date.toISOString()); setOpen(false); }}
                  className={cn('nums h-8 rounded-lg text-sm transition hover:bg-brand-50 dark:hover:bg-white/10', active && 'bg-brand-600 font-semibold text-white hover:bg-brand-700')}>
                  {d}
                </button>
              );
            })}
          </div>
          {value && <button type="button" className="mt-2 w-full text-xs text-muted hover:text-danger-600" onClick={() => { onChange(null); setOpen(false); }}>Tozalash</button>}
        </div>
      </Popover>
    </>
  );
}
