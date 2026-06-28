import React, { useState } from 'react';
import { cn } from '../lib/cn';
import { surface } from '../lib/surfaces';
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
    primary: 'bg-brand-700 text-white hover:bg-brand-800 active:bg-brand-900 focus-visible:ring-brand-600/30',
    secondary: 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100 focus-visible:ring-brand-600/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-white/5',
    accent: 'bg-gray-800 text-white hover:bg-gray-900 focus-visible:ring-gray-700/40 dark:bg-gray-700 dark:hover:bg-gray-600',
    danger: 'bg-error-600 text-white hover:bg-error-700 focus-visible:ring-error-600/40',
    ghost: 'text-gray-600 hover:bg-gray-100 active:bg-gray-200 focus-visible:ring-brand-600/30 dark:text-gray-300 dark:hover:bg-white/5',
  };
  return (
    <button
      className={cn(
        'inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors duration-150',
        'outline-none focus-visible:ring-2 disabled:opacity-50 disabled:pointer-events-none',
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
        'h-11 w-full rounded-lg border border-gray-200 bg-white px-3.5 text-sm text-gray-800 outline-none transition',
        'placeholder:text-gray-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10',
        'dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500',
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
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-gray-400 transition hover:text-gray-700 dark:hover:text-gray-100"
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
  icon: Icon,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('block space-y-1.5', className)}>
      <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {Icon && <Icon className="h-3.5 w-3.5 text-gray-400" />}
        {label}
        {required && <span className="ml-0.5 text-error-600">*</span>}
      </span>
      {children}
      {hint && <span className="block text-xs text-gray-400">{hint}</span>}
    </label>
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(surface, 'p-6', className)} {...props} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-gray-200/70 dark:bg-gray-800', className)} />;
}

const statusStyles: Record<CaseStatus, string> = {
  [CaseStatus.DRAFT]: 'bg-gray-100 text-gray-700 ring-gray-200 dark:bg-white/10 dark:text-gray-200 dark:ring-white/10',
  [CaseStatus.MODERATION]: 'bg-warning-50 text-warning-700 ring-warning-100 dark:bg-warning-600/15 dark:text-warning-400 dark:ring-warning-600/20',
  [CaseStatus.DIRECTOR_REVIEW]: 'bg-violet-50 text-violet-700 ring-violet-100 dark:bg-violet-600/15 dark:text-violet-300 dark:ring-violet-600/20',
  [CaseStatus.ADMIN_FINALIZE]: 'bg-brand-50 text-brand-800 ring-brand-100 dark:bg-brand-500/12 dark:text-brand-400 dark:ring-brand-600/20',
  [CaseStatus.FINALIZED]: 'bg-success-50 text-success-700 ring-success-100 dark:bg-success-600/15 dark:text-success-400 dark:ring-success-600/20',
  [CaseStatus.REJECTED]: 'bg-error-50 text-error-700 ring-error-100 dark:bg-error-600/15 dark:text-error-400 dark:ring-error-600/20',
  [CaseStatus.CANCELLED]: 'bg-gray-100 text-gray-600 ring-gray-200 dark:bg-white/10 dark:text-gray-300 dark:ring-white/10',
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
