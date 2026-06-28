import React from 'react';
import { cn } from '../lib/cn';

/**
 * TailAdmin-style dashboard widgets, themed with credit-core tokens
 * (surface / hairline / ink / muted / brand / success / danger).
 */

type IconCmp = React.ComponentType<{ className?: string }>;

const toneMap = {
  brand: 'bg-brand-50 text-brand-700 dark:bg-brand-600/15 dark:text-brand-300',
  success: 'bg-success-50 text-success-700 dark:bg-success-600/15 dark:text-success-400',
  warning: 'bg-warning-50 text-warning-700 dark:bg-warning-600/15 dark:text-warning-400',
  danger: 'bg-danger-50 text-danger-700 dark:bg-danger-600/15 dark:text-danger-400',
} as const;

export type MetricTone = keyof typeof toneMap;

export function MetricCard({
  icon: Icon,
  label,
  value,
  delta,
  tone = 'brand',
  className,
}: {
  icon: IconCmp;
  label: string;
  value: React.ReactNode;
  /** percentage change; positive => up/green, negative => down/red. Omit to hide. */
  delta?: number;
  tone?: MetricTone;
  className?: string;
}) {
  const up = (delta ?? 0) >= 0;
  return (
    <div
      className={cn(
        'rounded-2xl border border-hairline bg-surface p-5 shadow-card dark:border-white/10 dark:bg-navy-800 md:p-6',
        className,
      )}
    >
      <div className={cn('flex h-12 w-12 items-center justify-center rounded-xl', toneMap[tone])}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="mt-5 flex items-end justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm text-muted dark:text-slate-400">{label}</p>
          <h4 className="nums mt-1 text-2xl font-bold text-ink dark:text-white">{value}</h4>
        </div>
        {delta !== undefined && (
          <span
            className={cn(
              'flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
              up
                ? 'bg-success-50 text-success-700 dark:bg-success-600/15 dark:text-success-400'
                : 'bg-danger-50 text-danger-700 dark:bg-danger-600/15 dark:text-danger-400',
            )}
          >
            <span aria-hidden>{up ? '↑' : '↓'}</span>
            {Math.abs(delta)}%
          </span>
        )}
      </div>
    </div>
  );
}

export function WidgetCard({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-hairline bg-surface p-5 shadow-card dark:border-white/10 dark:bg-navy-800 md:p-6',
        className,
      )}
    >
      {(title || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h3 className="font-semibold text-ink dark:text-white">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-sm text-muted dark:text-slate-400">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
