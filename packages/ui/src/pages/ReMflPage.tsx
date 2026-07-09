import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@credit-core/api-client';
import { STATUS_LABEL, type ReMflContractDto } from '@credit-core/shared';
import { Card, Input, Button } from '../components/primitives';
import { useToast } from '../components/Toast';
import { formatMoney } from '../lib/cn';

/** Qayta MFL — find a repeat client (live search) and open a new draft. If the chosen case has a
 *  contract number its MFL identifier is reused; if not, a fresh number is assigned at submit. */
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Qayta MFL</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Takroriy mijozni qidiring — F.I.O, PINFL, telefon yoki pasport raqami. Yozgan sari mos mijozlar chiqadi; MFL raqami bo‘lsa tanlangan shartnomadan saqlanadi, bo‘lmasa yangi raqam beriladi.</p>
      </div>
      <Card className="space-y-2">
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Qidiruv… (F.I.O, PINFL, telefon, pasport)"
          autoFocus
        />
        {enabled && query.isFetching && (
          <p className="text-xs text-gray-400 dark:text-gray-500">Qidirilmoqda…</p>
        )}
        {enabled && !query.isFetching && rows.length === 0 && (
          <p className="text-xs text-gray-400 dark:text-gray-500">Mos mijoz topilmadi</p>
        )}
        {!enabled && (
          <p className="text-xs text-gray-400 dark:text-gray-500">Kamida 2 ta belgi kiriting</p>
        )}
      </Card>
      {rows.length > 0 && (
        <Card className="space-y-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">Mijoz / shartnomani tanlang — raqami bo‘lsa shundan olinadi</p>
          <div className="divide-y divide-gray-100 dark:divide-white/10">
            {rows.map((r) => (
              <div key={r.caseId} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <div className="truncate font-medium text-gray-800 dark:text-white">{r.fullName} · <span className="nums">{r.contractNumber ?? '—'}</span></div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(r.date).toLocaleDateString()} · {STATUS_LABEL[r.status] ?? r.status} · {r.amount != null ? formatMoney(r.amount) : '—'}
                  </div>
                </div>
                <Button variant="secondary" loading={create.isPending} onClick={() => create.mutate(r.caseId)}>Tanlash</Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
