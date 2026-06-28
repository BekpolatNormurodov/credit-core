import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Messages, House, Car } from '../lib/icons';
import { api } from '@credit-core/api-client';
import { ProductType } from '@credit-core/shared';
import { Card, Skeleton } from '../components/primitives';
import { CaseChat } from '../components/CaseChat';
import { cn } from '../lib/cn';

export function ChatsPage() {
  const { data: cases, isLoading } = useQuery({ queryKey: ['cases'], queryFn: () => api.cases(false) });
  const { data: unread } = useQuery({ queryKey: ['unread-by-case'], queryFn: () => api.unreadByCase(), refetchInterval: 15_000 });
  const [active, setActive] = useState<string | null>(null);
  const selected = cases?.find((c) => c.id === active) ?? cases?.[0];
  const unreadFor = (id: string) => unread?.find((u) => u.caseId === id)?.count ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-700 text-white"><Messages className="h-5 w-5" /></span>
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Chatlar</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Ariza bo‘yicha hamkasblar bilan muloqot</p>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-96" />
      ) : !cases?.length ? (
        <Card className="py-16 text-center text-gray-500 dark:text-gray-400">Ariza yo‘q</Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="space-y-1 p-2 lg:col-span-1">
            {cases.map((c) => {
              const on = (selected?.id ?? '') === c.id;
              const n = unreadFor(c.id);
              return (
                <button key={c.id} onClick={() => setActive(c.id)}
                  className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30', on ? 'bg-brand-50 dark:bg-brand-500/12' : 'hover:bg-gray-50 dark:hover:bg-white/5')}>
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white ${c.productType === ProductType.AUTO ? 'bg-warning-600' : 'bg-brand-700'}`}>
                    {c.productType === ProductType.AUTO ? <Car className="h-4 w-4" /> : <House className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-sm font-semibold', on ? 'text-brand-700 dark:text-brand-400' : 'text-gray-800 dark:text-gray-100')}>{c.number}</span>
                    <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{c.borrowerName ?? '—'}</span>
                  </span>
                  {n > 0 && !on && (
                    <span className="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[11px] font-semibold text-white">{n > 99 ? '99+' : n}</span>
                  )}
                </button>
              );
            })}
          </Card>
          <Card className="lg:col-span-2">
            {selected ? (
              <>
                <div className="mb-3 border-b border-gray-200 pb-3 dark:border-gray-800">
                  <p className="font-semibold text-gray-800 dark:text-white">{selected.number}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{selected.borrowerName ?? '—'}</p>
                </div>
                <CaseChat key={selected.id} caseId={selected.id} />
              </>
            ) : (
              <p className="py-16 text-center text-gray-500 dark:text-gray-400">Arizani tanlang</p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
