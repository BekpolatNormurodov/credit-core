import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, Info } from 'lucide-react';
import { api } from '@credit-core/api-client';
import { Card } from '../components/primitives';

export function AdminPage() {
  const { data: branches } = useQuery({ queryKey: ['branches'], queryFn: () => api.branches() });
  const [katm] = useState<{ message: string } | null>(null);
  useQuery({ queryKey: ['katm-status'], queryFn: () => api.katmStatus() });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Boshqaruv</h1>

      <Card>
        <h2 className="mb-3 flex items-center gap-2 font-semibold"><Building2 className="h-4 w-4" /> Filiallar</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {branches?.map((b) => (
            <div key={b.id} className="rounded-xl border border-slate-100 px-3 py-2">
              <p className="font-medium">{b.name} <span className="text-slate-400">({b.symbol})</span></p>
              <p className="text-xs text-slate-400">{b.region ?? '—'}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="border-dashed">
        <h2 className="mb-1 flex items-center gap-2 font-semibold">
          <Info className="h-4 w-4" /> KATM integratsiyasi
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Tez kunda</span>
        </h2>
        <p className="text-sm text-slate-500">{katm?.message ?? 'KATM hisobotlari tez kunda ulanadi.'}</p>
      </Card>
    </div>
  );
}
