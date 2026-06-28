import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FilePlus2, Inbox, House, Car } from '../lib/icons';
import { api } from '@credit-core/api-client';
import { ProductType, PRODUCT_LABEL, Role } from '@credit-core/shared';
import { useAuth } from '../lib/auth';
import { Button, Card, Skeleton, StatusBadge } from '../components/primitives';
import { formatMoney } from '../lib/cn';

export function Dashboard() {
  const { user } = useAuth();
  const isOperator = user?.role === Role.OPERATOR;
  const { data: cases, isLoading } = useQuery({
    queryKey: ['cases'],
    queryFn: () => api.cases(false),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Arizalar</h1>
          <p className="text-sm text-muted">
            {isOperator ? 'Sizning kredit arizalaringiz' : 'Navbatingizdagi arizalar'}
          </p>
        </div>
        {isOperator && (
          <Link to="/cases/new">
            <Button>
              <FilePlus2 className="h-4 w-4" /> Yangi ariza
            </Button>
          </Link>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-6 w-24" />
            </Card>
          ))}
        </div>
      ) : !cases?.length ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <Inbox className="h-10 w-10 text-slate-300" />
          <p className="text-slate-500">Hozircha ariza yo‘q</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {cases.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <Link to={`/cases/${c.id}`}>
                <Card className="flex items-center justify-between gap-3 transition hover:border-brand-300 hover:shadow-soft">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white ${c.productType === ProductType.AUTO ? 'bg-warning-600' : 'bg-brand-700'}`}>
                      {c.productType === ProductType.AUTO ? <Car className="h-5 w-5" /> : <House className="h-5 w-5" />}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{c.number}</p>
                      <p className="truncate text-sm text-muted">
                        {c.borrowerName ?? '—'} · {PRODUCT_LABEL[c.productType]}
                        {c.branchSymbol ? ` · ${c.branchSymbol}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    <span className="nums hidden text-sm font-semibold text-ink sm:inline">{formatMoney(c.amount)}</span>
                    <StatusBadge status={c.status} />
                  </div>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
