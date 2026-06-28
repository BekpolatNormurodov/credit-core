import { CheckCircle2, RotateCcw, Send, Flag } from 'lucide-react';
import { ROLE_LABEL, WorkflowDecision, type WorkflowEventDto } from '@credit-core/shared';

const icons: Record<WorkflowDecision, React.ComponentType<{ className?: string }>> = {
  [WorkflowDecision.SUBMIT]: Send,
  [WorkflowDecision.APPROVE]: CheckCircle2,
  [WorkflowDecision.RETURN]: RotateCcw,
  [WorkflowDecision.FINALIZE]: Flag,
};

export function CaseTimeline({ events }: { events: WorkflowEventDto[] }) {
  if (!events.length) return <p className="text-sm text-slate-400">Hali harakatlar yo‘q</p>;
  return (
    <ol className="space-y-4">
      {events.map((e) => {
        const Icon = icons[e.decision];
        return (
          <li key={e.id} className="flex gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium">
                {e.actorName} <span className="text-slate-400">({ROLE_LABEL[e.role]})</span> — {e.decision}
              </p>
              {e.comment && <p className="text-sm text-slate-600">{e.comment}</p>}
              <p className="text-xs text-slate-400">{new Date(e.createdAt).toLocaleString('ru-RU')}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
