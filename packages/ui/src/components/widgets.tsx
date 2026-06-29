import React from 'react';
import { cn } from '../lib/cn';
import { surface, cardPad } from '../lib/surfaces';

/**
 * TailAdmin-style dashboard widgets, themed with credit-core tokens
 * (surface / hairline / ink / muted / brand / success / danger).
 */

type IconCmp = React.ComponentType<{ className?: string }>;

const toneMap = {
  brand: 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400',
  success: 'bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-500',
  warning: 'bg-warning-50 text-warning-600 dark:bg-warning-500/10 dark:text-warning-500',
  danger: 'bg-error-50 text-error-600 dark:bg-error-500/10 dark:text-error-500',
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
    <div className={cn(surface, cardPad, className)}>
      <div className={cn('grid h-11 w-11 place-items-center rounded-xl', toneMap[tone])}>
        <Icon className="h-[22px] w-[22px]" />
      </div>
      <div className="mt-5 flex items-end justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <h4 className="nums mt-1 text-2xl font-bold text-gray-800 dark:text-white">{value}</h4>
        </div>
        {delta !== undefined && (
          <span
            className={cn(
              'flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
              up
                ? 'bg-success-50 text-success-600 dark:bg-success-500/20 dark:text-success-500'
                : 'bg-error-50 text-error-600 dark:bg-error-500/20 dark:text-error-500',
            )}
          >
            <span aria-hidden>{up ? '\u2191' : '\u2193'}</span>
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
    <section className={cn(surface, cardPad, className)}>
      {(title || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h3 className="font-semibold text-gray-800 dark:text-white">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
