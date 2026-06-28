import React from 'react';
import { cn } from '../lib/cn';
import { CaseStatus, STATUS_LABEL } from '@credit-core/shared';

export function Button({
  className,
  variant = 'primary',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
}) {
  const variants: Record<string, string> = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-soft',
    secondary: 'bg-white text-slate-800 border border-slate-200 hover:bg-slate-50',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
    ghost: 'text-slate-600 hover:bg-slate-100',
  };
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100',
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('block space-y-1.5', className)}>
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-2xl border border-slate-200 bg-white p-6 shadow-sm', className)}
      {...props}
    />
  );
}

const statusStyles: Record<CaseStatus, string> = {
  [CaseStatus.DRAFT]: 'bg-slate-100 text-slate-700',
  [CaseStatus.MODERATION]: 'bg-amber-100 text-amber-800',
  [CaseStatus.DIRECTOR_REVIEW]: 'bg-violet-100 text-violet-800',
  [CaseStatus.ADMIN_FINALIZE]: 'bg-brand-100 text-brand-800',
  [CaseStatus.FINALIZED]: 'bg-emerald-100 text-emerald-800',
  [CaseStatus.REJECTED]: 'bg-rose-100 text-rose-800',
};

export function StatusBadge({ status }: { status: CaseStatus }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-1 text-xs font-medium', statusStyles[status])}>
      {STATUS_LABEL[status]}
    </span>
  );
}
