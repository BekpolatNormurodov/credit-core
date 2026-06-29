import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, FileText, ChevronDown, ArrowRight } from '../lib/icons';
import { api } from '@credit-core/api-client';
import { Role, ROLE_LABEL } from '@credit-core/shared';
import { Card, Skeleton } from '../components/primitives';
import { cn } from '../lib/cn';
import { surface } from '../lib/surfaces';

const roleTone: Record<Role, string> = {
  [Role.OPERATOR]: 'bg-brand-600',
  [Role.MODERATOR]: 'bg-warning-600',
  [Role.DIRECTOR]: 'bg-violet-600',
  [Role.ADMIN]: 'bg-gray-800 dark:bg-gray-600',
};
const initials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export function NotificationsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['notifications'], queryFn: () => api.notifications(), refetchInterval: 15_000 });
  const [openId, setOpenId] = useState<string | null>(null);
  const unreadCount = data?.filter((n) => !n.read).length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-700 text-white"><Bell className="h-5 w-5" /></span>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Bildirishnomalar</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Hamkasblardan kelgan xabarlar va fayllar</p>
        </div>
        {unreadCount > 0 && (
          <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700 dark:bg-brand-500/12 dark:text-brand-400">
            {unreadCount} yangi
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
      ) : !data?.length ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-gray-500"><Bell className="h-7 w-7" /></span>
          <p className="text-gray-500 dark:text-gray-400">Hozircha bildirishnoma yo‘q</p>
        </Card>
      ) : (
        <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((n) => {
            const open = openId === n.id;
            return (
              <div
                key={n.id}
                className={cn(surface, 'relative flex flex-col overflow-hidden transition-shadow', open && 'shadow-theme-md', !n.read && 'ring-1 ring-brand-200 dark:ring-brand-500/40')}
              >
                {!n.read && <span className="absolute left-0 top-0 h-full w-1 bg-brand-500" aria-hidden />}
                <button
                  onClick={() => setOpenId(open ? null : n.id)}
                  aria-expanded={open}
                  className="flex items-start gap-3 p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600/30"
                >
                  <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white', roleTone[n.senderRole])}>
                    {initials(n.senderName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-gray-800 dark:text-white">{n.senderName}</p>
                      <span className="ml-auto shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-500/12 dark:text-brand-400">{n.caseNumber}</span>
                      <ChevronDown className={cn('h-4 w-4 shrink-0 text-gray-400 transition-transform', open && 'rotate-180')} />
                    </div>
                    <p className={cn('mt-1 text-sm text-gray-600 dark:text-gray-300', !open && 'line-clamp-2')}>
                      {n.toRole ? <span className="font-medium text-brand-700 dark:text-brand-400">→ {ROLE_LABEL[n.toRole]}: </span> : null}
                      {n.text ?? '—'}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-white/10 dark:text-gray-300">{ROLE_LABEL[n.senderRole]}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{new Date(n.createdAt).toLocaleString('ru-RU')}</span>
                      {n.hasFile && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500 dark:bg-white/10 dark:text-gray-300">
                          <FileText className="h-3.5 w-3.5" /> fayl
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                {open && (
                  <div className="border-t border-gray-100 px-4 py-3 dark:border-gray-800">
                    <Link
                      to={`/cases/${n.caseId}`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-medium text-white outline-none transition hover:bg-brand-800 focus-visible:ring-2 focus-visible:ring-brand-600/30"
                    >
                      Arizani ochish <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
