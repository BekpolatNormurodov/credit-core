import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../lib/cn';
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
    secondary: 'bg-white text-ink border border-hairline hover:bg-slate-50 active:bg-slate-100 focus-visible:ring-brand-200',
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
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
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
        className,
      )}
      {...props}
    />
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
      className={cn('rounded-2xl border border-hairline bg-surface p-6 shadow-card', className)}
      {...props}
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-slate-200/70', className)} />;
}

const statusStyles: Record<CaseStatus, string> = {
  [CaseStatus.DRAFT]: 'bg-slate-100 text-slate-700 ring-slate-200',
  [CaseStatus.MODERATION]: 'bg-warning-50 text-warning-700 ring-warning-100',
  [CaseStatus.DIRECTOR_REVIEW]: 'bg-violet-50 text-violet-700 ring-violet-100',
  [CaseStatus.ADMIN_FINALIZE]: 'bg-brand-50 text-brand-800 ring-brand-100',
  [CaseStatus.FINALIZED]: 'bg-success-50 text-success-700 ring-success-100',
  [CaseStatus.REJECTED]: 'bg-danger-50 text-danger-700 ring-danger-100',
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
