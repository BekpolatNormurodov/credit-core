import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@credit-core/api-client';
import { STATUS_LABEL, type ReMflContractDto } from '@credit-core/shared';
import { Button, Card, Input } from '../components/primitives';
import { useToast } from '../components/Toast';
import { formatMoney } from '../lib/cn';

/** Qayta MFL — find a repeat client and open a new draft that reuses their MFL identifier. */
export function ReMflPage() {
  const nav = useNavigate();
  const toast = useToast();
  const [term, setTerm] = useState('');
  const [rows, setRows] = useState<ReMflContractDto[]>([]);
  const search = useMutation({
    mutationFn: () => api.searchReMfl(term.trim()),
    onSuccess: (r) => { setRows(r); if (!r.length) toast.info('Topilmadi', 'Mos mijoz yo‘q'); },
    onError: () => toast.error('Xatolik', 'Qidiruv bajarilmadi'),
  });
  const create = useMutation({
    mutationFn: (sourceCaseId: string) => api.createReMfl(sourceCaseId),
    onSuccess: (c) => { toast.success('Yaratildi', 'Qayta MFL arizasi'); nav(`/cases/${c.id}/origination`); },
    onError: () => toast.error('Xatolik', 'Ariza yaratilmadi'),
  });
  const canSearch = term.trim().length >= 2;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Qayta MFL</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Takroriy mijozni qidiring — F.I.O, PINFL, telefon yoki pasport raqami. MFL raqami (yillik+filial) tanlangan shartnomadan saqlanadi.</p>
      </div>
      <Card className="space-y-3">
        <div className="flex gap-2">
          <Input value={term} onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && canSearch) search.mutate(); }} placeholder="Qidiruv…" />
          <Button loading={search.isPending} disabled={!canSearch} onClick={() => search.mutate()}>Qidirish</Button>
        </div>
      </Card>
      {rows.length > 0 && (
        <Card className="space-y-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">Shartnomani tanlang — MFL raqami shundan olinadi</p>
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
