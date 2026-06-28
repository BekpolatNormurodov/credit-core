/**
 * credit-core brand mark — a gradient shield (trust/garov) with a coin + check.
 * Pure SVG, scales with className (h-/w-). Use `withText` for the lockup.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="cc-logo" x1="4" y1="2" x2="36" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38BDF8" />
          <stop offset="1" stopColor="#0369A1" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#cc-logo)" />
      {/* shield */}
      <path
        d="M20 8.5 L28.5 11.7 V19.4 C28.5 25 24.7 28.8 20 30.8 C15.3 28.8 11.5 25 11.5 19.4 V11.7 Z"
        fill="#fff" fillOpacity="0.16" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round"
      />
      {/* check */}
      <path d="M16.2 20.2 L18.9 23 L24 16.8" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ className, subtitle }: { className?: string; subtitle?: string }) {
  return (
    <div className={className}>
      <div className="flex items-center gap-2.5">
        <LogoMark className="h-10 w-10 shrink-0" />
        <div className="leading-tight">
          <p className="text-sm font-bold tracking-tight">credit<span className="text-brand-500">-core</span></p>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}
