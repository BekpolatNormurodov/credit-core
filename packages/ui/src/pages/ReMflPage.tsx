import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@credit-core/api-client';
import { type ReMflContractDto } from '@credit-core/shared';
import { Card, Input, Button, StatusBadge, Skeleton } from '../components/primitives';
import { useToast } from '../components/Toast';
import { Search, Calendar, Money, ArrowRight, User } from '../lib/icons';
import { formatMoney } from '../lib/cn';

/** Two uppercase initials from a full name, for the result avatar. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '—';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

/** Qayta MFL — live-search a repeat client and open a new draft. If the chosen case has a contract
 *  number its MFL identifier is reused; if not, a fresh number is assigned at submit. */
export function ReMflPage() {
  const nav = useNavigate();
  const toast = useToast();
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');

  // Live "as-you-type" search: debounce the input 300ms so we query while typing, not per keystroke.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(term.trim()), 300);
    return () => clearTimeout(id);
  }, [term]);

  const enabled = debounced.length >= 2;
  const query = useQuery({
    queryKey: ['reMfl', debounced],
    queryFn: () => api.searchReMfl(debounced),
    enabled,
  });
  const rows: ReMflContractDto[] = query.data ?? [];

  const create = useMutation({
    mutationFn: (sourceCaseId: string) => api.createReMfl(sourceCaseId),
    onSuccess: (c) => { toast.success('Yaratildi', 'Qayta MFL arizasi'); nav(`/cases/${c.id}/origination`); },
    onError: () => toast.error('Xatolik', 'Ariza yaratilmadi'),
  });
  const [picked, setPicked] = useState<string | null>(null);

  return (
    /*
      Full width and left-aligned, like every other page in the app. This one was centred in a
      max-w-3xl column, which on a wide screen left the heading floating in the middle of the page
      with an empty half beside it — and made it the only screen that did not line up with the
      sidebar.
    */
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Qayta MFL</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Takroriy mijozni toping — yozgan sari chiqadi.
        </p>
      </div>

      <Card className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="F.I.O, PINFL, telefon yoki pasport…"
            className="pl-11"
            autoFocus
          />
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {!enabled
            ? 'Kamida 2 ta belgi kiriting'
            : query.isFetching
              ? 'Qidirilmoqda…'
              : `${rows.length} ta mos mijoz${rows.length ? '' : ' topilmadi'}`}
        </p>
      </Card>

      {enabled && query.isFetching && rows.length === 0 && (
        <Card className="space-y-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
        </Card>
      )}

      {enabled && !query.isFetching && rows.length === 0 && (
        <Card className="flex flex-col items-center gap-2 py-10 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-gray-100 text-gray-400 dark:bg-white/5">
            <User className="h-6 w-6" />
          </span>
          <p className="font-medium text-gray-700 dark:text-gray-200">Mos mijoz topilmadi</p>
          <p className="text-sm text-gray-400 dark:text-gray-500">Boshqacha yozib ko‘ring — ism, PINFL yoki telefon.</p>
        </Card>
      )}

      {rows.length > 0 && (
        <div className="space-y-2.5">
          {rows.map((r) => (
            <button
              key={r.caseId}
              type="button"
              disabled={create.isPending}
              onClick={() => { setPicked(r.caseId); create.mutate(r.caseId); }}
              className="group flex w-full items-center gap-3.5 rounded-2xl border border-gray-200 bg-white p-3.5 text-left outline-none transition hover:border-brand-300 hover:shadow-pop focus-visible:ring-2 focus-visible:ring-brand-600/30 disabled:opacity-60 dark:border-gray-800 dark:bg-white/5 dark:hover:border-brand-500/40"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-bold text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">
                {initials(r.fullName)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-semibold text-gray-800 dark:text-white">{r.fullName}</span>
                  {r.contractNumber ? (
                    <span className="nums rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-600 dark:bg-white/10 dark:text-gray-300">{r.contractNumber}</span>
                  ) : (
                    <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">Raqamsiz</span>
                  )}
                  <StatusBadge status={r.status} />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                  <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {new Date(r.date).toLocaleDateString()}</span>
                  {r.amount != null && <span className="inline-flex items-center gap-1"><Money className="h-3.5 w-3.5" /> {formatMoney(r.amount)}</span>}
                </div>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition group-hover:bg-brand-700">
                {create.isPending && picked === r.caseId ? '…' : <>Tanlash <ArrowRight className="h-4 w-4" /></>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
