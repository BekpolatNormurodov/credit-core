import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Sun, Moon } from '../lib/icons';
import { useTheme } from '../lib/theme';
import { useI18n, type Lang } from '../lib/i18n';
import { cn } from '../lib/cn';

/** Uzbekistan flag — rounded mini SVG. */
export function FlagUZ({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 16" className={className} aria-hidden>
      <defs><clipPath id="uz-r"><rect width="24" height="16" rx="2.5" /></clipPath></defs>
      <g clipPath="url(#uz-r)">
        <rect width="24" height="16" fill="#fff" />
        <rect width="24" height="5" fill="#1eb4e7" />
        <rect y="11" width="24" height="5" fill="#1eb53a" />
        <rect y="5" width="24" height="0.7" fill="#ce1126" />
        <rect y="10.3" width="24" height="0.7" fill="#ce1126" />
        <circle cx="4.6" cy="2.5" r="1.5" fill="#fff" />
        <circle cx="5.2" cy="2.5" r="1.5" fill="#1eb4e7" />
        <g fill="#fff">
          <circle cx="7" cy="1.6" r="0.3" /><circle cx="8.2" cy="1.6" r="0.3" />
          <circle cx="7" cy="2.6" r="0.3" /><circle cx="8.2" cy="2.6" r="0.3" /><circle cx="9.4" cy="2.6" r="0.3" />
        </g>
      </g>
      <rect width="24" height="16" rx="2.5" fill="none" stroke="rgba(0,0,0,.08)" />
    </svg>
  );
}

/** Russia flag — rounded mini SVG. */
export function FlagRU({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 16" className={className} aria-hidden>
      <defs><clipPath id="ru-r"><rect width="24" height="16" rx="2.5" /></clipPath></defs>
      <g clipPath="url(#ru-r)">
        <rect width="24" height="16" fill="#fff" />
        <rect y="5.33" width="24" height="5.33" fill="#0039a6" />
        <rect y="10.66" width="24" height="5.34" fill="#d52b1e" />
      </g>
      <rect width="24" height="16" rx="2.5" fill="none" stroke="rgba(0,0,0,.08)" />
    </svg>
  );
}

const LANGS: { value: Lang; label: string; Flag: (p: { className?: string }) => JSX.Element }[] = [
  { value: 'uz', label: "O'zbekcha", Flag: FlagUZ },
  { value: 'ru', label: 'Русский', Flag: FlagRU },
];

export function LangSwitch() {
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const current = LANGS.find((l) => l.value === lang)!;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        className="flex h-10 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-white/5"
      >
        <current.Flag className="h-3.5 w-5 rounded-[3px]" />
        {lang.toUpperCase()}
        <ChevronDown className={cn('h-3.5 w-3.5 text-gray-400 transition', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.14 }}
            className="absolute right-0 z-50 mt-1.5 w-40 overflow-hidden rounded-xl border border-gray-200 bg-white p-1 shadow-pop dark:border-gray-700 dark:bg-gray-800 dark:ring-1 dark:ring-white/10"
          >
            {LANGS.map((l) => (
              <button
                key={l.value}
                onMouseDown={(e) => { e.preventDefault(); setLang(l.value); setOpen(false); }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/5',
                  l.value === lang && 'bg-brand-50 font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-400',
                )}
              >
                <l.Flag className="h-4 w-6 rounded-[3px]" />
                <span className="flex-1">{l.label}</span>
                {l.value === lang && <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Reusable on/off switch (44px-wide track). */
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30',
        checked ? 'bg-brand-600' : 'bg-gray-200 dark:bg-gray-600',
      )}
    >
      <span className={cn('inline-block h-5 w-5 transform rounded-full bg-white shadow-theme-sm transition-transform', checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
    </button>
  );
}

/** Animated light/dark segmented toggle. */
export function ThemeSwitch() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label="Mavzu"
      className="relative flex h-9 items-center rounded-full border border-gray-200 bg-gray-100 p-0.5 dark:border-gray-700 dark:bg-gray-800"
    >
      {(['light', 'dark'] as const).map((t) => {
        const on = theme === t;
        return (
          <span key={t} className="relative z-10 flex h-7 w-7 items-center justify-center">
            {on && (
              <motion.span
                layoutId="theme-knob"
                transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                className="absolute inset-0 rounded-full bg-white shadow-theme-sm dark:bg-brand-600"
              />
            )}
            <span className={cn('relative z-10', on ? 'text-brand-700 dark:text-white' : 'text-gray-400')}>
              {t === 'light' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </span>
          </span>
        );
      })}
    </button>
  );
}
