import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Bell, FileText } from '../lib/icons';
import { api } from '@credit-core/api-client';
import { ROLE_LABEL } from '@credit-core/shared';
import { Card, Skeleton } from '../components/primitives';
import { cn } from '../lib/cn';

export function NotificationsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['notifications'], queryFn: () => api.notifications(), refetchInterval: 15_000 });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-700 text-white"><Bell className="h-5 w-5" /></span>
        <div>
          <h1 className="text-2xl font-bold">Bildirishnomalar</h1>
          <p className="text-sm text-muted">Hamkasblardan kelgan xabarlar va fayllar</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : !data?.length ? (
        <Card className="py-16 text-center text-slate-400">Hozircha bildirishnoma yo‘q</Card>
      ) : (
        <div className="space-y-2">
          {data.map((n) => (
            <Link key={n.id} to={`/cases/${n.caseId}`}>
              <Card className={cn('flex items-start gap-3 transition hover:border-brand-300', !n.read && 'border-brand-200 bg-brand-50/40')}>
                {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{n.senderName} <span className="font-normal text-slate-400">· {ROLE_LABEL[n.senderRole]}</span></p>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{n.caseNumber}</span>
                  </div>
                  <p className="truncate text-sm text-slate-600">
                    {n.toRole ? <span className="text-brand-700">→ {ROLE_LABEL[n.toRole]}: </span> : null}
                    {n.text ?? ''}
                    {n.hasFile && <span className="ml-1 inline-flex items-center gap-1 text-slate-500"><FileText className="inline h-3.5 w-3.5" /> fayl</span>}
                  </p>
                  <p className="text-xs text-slate-400">{new Date(n.createdAt).toLocaleString('ru-RU')}</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
