import { ArrowRight, CheckCircle2, Clock, Flag, RotateCcw, Send, X } from '../lib/icons';
import {
  CaseStatus, ROLE_LABEL, STATUS_LABEL, WorkflowDecision, type WorkflowEventDto,
} from '@credit-core/shared';
import { cn } from '../lib/cn';

type Tone = 'brand' | 'success' | 'warning' | 'error';

const icons: Record<WorkflowDecision, React.ComponentType<{ className?: string }>> = {
  [WorkflowDecision.SUBMIT]: Send,
  [WorkflowDecision.APPROVE]: CheckCircle2,
  [WorkflowDecision.RETURN]: RotateCcw,
  [WorkflowDecision.FINALIZE]: Flag,
  [WorkflowDecision.CANCEL]: X,
  [WorkflowDecision.REOPEN]: RotateCcw,
};

const decisionTone: Record<WorkflowDecision, Tone> = {
  [WorkflowDecision.SUBMIT]: 'brand',
  [WorkflowDecision.APPROVE]: 'success',
  [WorkflowDecision.RETURN]: 'warning',
  [WorkflowDecision.FINALIZE]: 'brand',
  [WorkflowDecision.CANCEL]: 'error',
  [WorkflowDecision.REOPEN]: 'warning',
};

/** Tone → soft chip/node classes (light + dark pairs). */
const toneSoft: Record<Tone, string> = {
  brand: 'bg-brand-50 text-brand-700 dark:bg-brand-500/12 dark:text-brand-400',
  success: 'bg-success-50 text-success-600 dark:bg-success-500/12 dark:text-success-500',
  warning: 'bg-warning-50 text-warning-600 dark:bg-warning-500/12 dark:text-warning-500',
  error: 'bg-error-50 text-error-600 dark:bg-error-500/12 dark:text-error-500',
};

const decisionPast: Record<WorkflowDecision, string> = {
  [WorkflowDecision.SUBMIT]: 'Yuborildi',
  [WorkflowDecision.APPROVE]: 'Tasdiqlandi',
  [WorkflowDecision.RETURN]: 'Qaytarildi',
  [WorkflowDecision.FINALIZE]: 'Yakunlandi',
  [WorkflowDecision.CANCEL]: 'Bekor qilindi',
  [WorkflowDecision.REOPEN]: 'Qayta to‘ldirishga qaytarildi',
};

/** Status → tiny dot color for the from→to transition row. */
const statusDot: Record<CaseStatus, string> = {
  [CaseStatus.DRAFT]: 'bg-gray-400',
  [CaseStatus.MODERATION]: 'bg-warning-500',
  [CaseStatus.DIRECTOR_REVIEW]: 'bg-violet-500',
  [CaseStatus.ADMIN_FINALIZE]: 'bg-brand-500',
  [CaseStatus.FINALIZED]: 'bg-success-500',
  [CaseStatus.REJECTED]: 'bg-error-500',
  [CaseStatus.CANCELLED]: 'bg-gray-400',
};

/** Compact Uzbek relative time ("5 daqiqa oldin"), falling back to a date for old events. */
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'hozir';
  if (min < 60) return `${min} daqiqa oldin`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} soat oldin`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} kun oldin`;
  return new Date(iso).toLocaleDateString('ru-RU');
}

function StatusPill({ status, strong }: { status: CaseStatus; strong?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5', strong ? 'font-medium text-gray-700 dark:text-gray-200' : 'text-gray-500 dark:text-gray-400')}>
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', statusDot[status])} />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function CaseTimeline({ events }: { events: WorkflowEventDto[] }) {
  if (!events.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-gray-500">
          <Clock className="h-5 w-5" />
        </span>
        <p className="text-sm text-gray-500 dark:text-gray-400">Hali harakatlar yo‘q</p>
      </div>
    );
  }

  return (
    <ol className="relative">
      {events.map((e, i) => {
        const Icon = icons[e.decision];
        const tone = decisionTone[e.decision];
        const isLast = i === events.length - 1;
        return (
          <li key={e.id} className="relative flex gap-4 pb-6 last:pb-0">
            {/* Rail node + continuous connector */}
            <div className="flex flex-col items-center">
              <span className={cn('z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full ring-4 ring-white dark:ring-gray-900', toneSoft[tone])}>
                <Icon className="h-4 w-4" />
              </span>
              {!isLast && <span aria-hidden="true" className="mt-1 w-px flex-1 bg-gray-200 dark:bg-gray-800" />}
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1 pb-0.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-semibold text-gray-800 dark:text-white">{e.actorName}</span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-white/10 dark:text-gray-300">{ROLE_LABEL[e.role]}</span>
                <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', toneSoft[tone])}>{decisionPast[e.decision]}</span>
                <time
                  dateTime={e.createdAt}
                  title={new Date(e.createdAt).toLocaleString('ru-RU')}
                  className="ml-auto shrink-0 text-xs text-gray-400 dark:text-gray-500"
                >
                  {relativeTime(e.createdAt)}
                </time>
              </div>

              {e.fromStatus && (
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  <StatusPill status={e.fromStatus} />
                  <ArrowRight className="h-3.5 w-3.5 text-gray-300 dark:text-gray-600" />
                  <StatusPill status={e.toStatus} strong />
                </div>
              )}

              {e.comment && (
                <p className="mt-2 rounded-lg border-l-2 border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:border-gray-700 dark:bg-white/5 dark:text-gray-300">
                  {e.comment}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
