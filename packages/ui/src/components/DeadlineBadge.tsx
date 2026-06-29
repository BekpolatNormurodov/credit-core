import { useEffect, useState } from 'react';
import { Clock, Pause } from '../lib/icons';
import { cn } from '../lib/cn';

/** Human "X kun Y soat" from a positive ms span (down to minutes). */
function humanizeSpan(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days} kun ${hours} soat`;
  if (hours > 0) return `${hours} soat ${minutes} daq`;
  return `${minutes} daq`;
}

/**
 * SLA countdown chip for a step deadline.
 *  - normal: neutral "… qoldi"
 *  - < ~1 kun: warning amber
 *  - overdue: error red "Muddati o'tgan · …"
 * `compact` hides the chip entirely while the deadline is comfortably in the future
 * (used in dense tables — only surfaces when soon/overdue).
 */
export function DeadlineBadge({
  deadlineAt,
  paused = false,
  pauseUntil = null,
  compact = false,
  className,
}: {
  deadlineAt: string | null;
  paused?: boolean;
  /** Auto-resume moment for the active pause — shown as a countdown on the chip. */
  pauseUntil?: string | null;
  compact?: boolean;
  className?: string;
}) {
  // Re-render each minute so the countdown stays live.
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  if (paused) {
    const remain = pauseUntil ? new Date(pauseUntil).getTime() - Date.now() : null;
    const label = remain != null && remain > 0 ? `Pauza · ${humanizeSpan(remain)} qoldi` : 'Pauza';
    const title = pauseUntil
      ? `Pauzada — avtomatik davom etadi: ${new Date(pauseUntil).toLocaleString('ru-RU')}`
      : 'Ariza pauzada — muddat to‘xtatilgan';
    return (
      <span
        title={title}
        className={cn('inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-white/10 dark:text-gray-300', className)}
      >
        <Pause className="h-3.5 w-3.5" /> {label}
      </span>
    );
  }

  if (!deadlineAt) return null;
  const diff = new Date(deadlineAt).getTime() - Date.now();
  const overdue = diff < 0;
  const soon = !overdue && diff < 24 * 60 * 60 * 1000; // under ~1 day left

  if (compact && !overdue && !soon) return null;

  const tone = overdue
    ? 'bg-error-50 text-error-600 dark:bg-error-500/10 dark:text-error-500'
    : soon
      ? 'bg-warning-50 text-warning-600 dark:bg-warning-500/10 dark:text-warning-500'
      : 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300';

  const label = overdue
    ? compact
      ? 'Muddati o‘tgan'
      : `Muddati o‘tgan · ${humanizeSpan(-diff)}`
    : `${humanizeSpan(diff)} qoldi`;

  return (
    <span
      title={overdue ? 'Bosqich muddati o‘tib ketgan' : 'Bosqich tugashiga qolgan vaqt'}
      className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', tone, className)}
    >
      <Clock className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}
