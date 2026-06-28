import React, { useState } from 'react';
import { cn } from '../lib/cn';
import { Eye, EyeOff } from '../lib/icons';
import { CaseStatus, STATUS_LABEL } from '@credit-core/shared';

export function Button({
  className,
  variant = 'primary',
  loading = false,
  children,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost';
  loading?: boolean;
}) {
  const variants: Record<string, string> = {
    primary: 'bg-brand-700 text-white hover:bg-brand-800 active:bg-brand-900 shadow-soft focus-visible:ring-brand-300',
    secondary: 'bg-white text-ink border border-hairline hover:bg-slate-50 active:bg-slate-100 focus-visible:ring-brand-200 dark:bg-navy-800 dark:text-slate-100 dark:border-white/10 dark:hover:bg-navy-700',
    accent: 'bg-navy-800 text-white hover:bg-navy-700 focus-visible:ring-navy-700/40',
    danger: 'bg-danger-600 text-white hover:bg-danger-700 focus-visible:ring-danger-600/40',
    ghost: 'text-muted hover:bg-slate-100 active:bg-slate-200 focus-visible:ring-brand-200',
  };
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors duration-150',
        'outline-none focus-visible:ring-4 disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full rounded-xl border border-hairline bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition',
        'placeholder:text-slate-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-100',
        'dark:bg-navy-800 dark:border-white/10 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-brand-900',
        className,
      )}
      {...props}
    />
  );
}

export function PasswordInput({ className, ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input type={show ? 'text' : 'password'} className={cn('pr-10', className)} {...props} />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Parolni yashirish' : 'Parolni ko‘rsatish'}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 transition hover:text-ink dark:hover:text-slate-100"
      >
        {show ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
      </button>
    </div>
  );
}

export function Field({
  label,
  required,
  hint,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('block space-y-1.5', className)}>
      <span className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
        {required && <span className="ml-0.5 text-danger-600">*</span>}
      </span>
      {children}
      {hint && <span className="block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-2xl border border-hairline bg-surface p-6 shadow-card dark:bg-navy-800 dark:border-white/10', className)}
      {...props}
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-slate-200/70', className)} />;
}

const statusStyles: Record<CaseStatus, string> = {
  [CaseStatus.DRAFT]: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-white/10 dark:text-slate-200 dark:ring-white/10',
  [CaseStatus.MODERATION]: 'bg-warning-50 text-warning-700 ring-warning-100 dark:bg-warning-600/15 dark:text-warning-400 dark:ring-warning-600/20',
  [CaseStatus.DIRECTOR_REVIEW]: 'bg-violet-50 text-violet-700 ring-violet-100 dark:bg-violet-600/15 dark:text-violet-300 dark:ring-violet-600/20',
  [CaseStatus.ADMIN_FINALIZE]: 'bg-brand-50 text-brand-800 ring-brand-100 dark:bg-brand-600/15 dark:text-brand-300 dark:ring-brand-600/20',
  [CaseStatus.FINALIZED]: 'bg-success-50 text-success-700 ring-success-100 dark:bg-success-600/15 dark:text-success-400 dark:ring-success-600/20',
  [CaseStatus.REJECTED]: 'bg-danger-50 text-danger-700 ring-danger-100 dark:bg-danger-600/15 dark:text-danger-400 dark:ring-danger-600/20',
};

export function StatusBadge({ status }: { status: CaseStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
        statusStyles[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
