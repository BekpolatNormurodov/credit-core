import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FilePlus2, House, Car, Layers, FileCheck2, Banknote } from '../lib/icons';
import { api } from '@credit-core/api-client';
import { ProductType, PRODUCT_LABEL, Role, type CreditCaseListItem } from '@credit-core/shared';
import { useAuth } from '../lib/auth';
import { Button, Card, Skeleton, StatusBadge } from '../components/primitives';
import { DataTable, type Column } from '../components/DataTable';
import { NewCaseModal } from './CaseForm';
import { formatMoney } from '../lib/cn';

function Kpi({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: string }) {
  return (
    <Card className="flex items-center gap-3.5">
      <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}><Icon className="h-5 w-5 text-white" /></span>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
        <p className="nums truncate text-lg font-bold text-ink">{value}</p>
      </div>
    </Card>
  );
}

export function Dashboard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const isOperator = user?.role === Role.OPERATOR;
  const canCreate = user?.role === Role.OPERATOR || user?.role === Role.ADMIN;
  const newOpen = canCreate && params.get('new') === '1';
  const openNew = () => setParams({ new: '1' });
  const closeNew = () => setParams({});
  const { data: cases, isLoading } = useQuery({ queryKey: ['cases'], queryFn: () => api.cases(false) });
  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: () => api.stats() });

  const columns: Column<CreditCaseListItem>[] = [
    {
      key: 'number', header: 'Ariza',
      render: (c) => (
        <div className="flex items-center gap-2.5">
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-white ${c.productType === ProductType.AUTO ? 'bg-warning-600' : 'bg-brand-700'}`}>
            {c.productType === ProductType.AUTO ? <Car className="h-4 w-4" /> : <House className="h-4 w-4" />}
          </span>
          <span className="font-semibold text-ink">{c.number}</span>
        </div>
      ),
    },
    { key: 'borrowerName', header: 'Qarz oluvchi', render: (c) => c.borrowerName ?? '—' },
    { key: 'product', header: 'Mahsulot', render: (c) => PRODUCT_LABEL[c.productType] },
    { key: 'branchSymbol', header: 'Filial', render: (c) => c.branchSymbol ?? '—' },
    { key: 'amount', header: 'Summa', align: 'right', className: 'nums font-medium', render: (c) => formatMoney(c.amount) },
    { key: 'status', header: 'Holat', render: (c) => <StatusBadge status={c.status} /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Arizalar</h1>
          <p className="text-sm text-muted">{isOperator ? 'Sizning kredit arizalaringiz' : 'Navbatingizdagi arizalar'}</p>
        </div>
        {canCreate && (
          <Button onClick={openNew}><FilePlus2 className="h-4 w-4" /> Yangi ariza</Button>
        )}
      </div>

      {canCreate && <NewCaseModal open={newOpen} onClose={closeNew} />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats ? (
          <>
            <Kpi icon={Layers} label="Jami ariza" value={String(stats.totalCases)} tone="bg-brand-600" />
            <Kpi icon={FileCheck2} label="Yakunlangan" value={String(stats.finalizedCount)} tone="bg-success-600" />
            <Kpi icon={Banknote} label="Jami summa" value={formatMoney(stats.totalAmount)} tone="bg-navy-800" />
            <Kpi icon={Banknote} label="Jami KATM" value={formatMoney(stats.totalKatm)} tone="bg-warning-600" />
          </>
        ) : (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[72px]" />)
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-72" />
      ) : (
        <DataTable
          columns={columns}
          rows={cases ?? []}
          searchable
          searchFields={['number', 'borrowerName', 'branchSymbol']}
          onRowClick={(c) => nav(`/cases/${c.id}`)}
          empty="Hozircha ariza yo‘q"
        />
      )}
    </div>
  );
}
