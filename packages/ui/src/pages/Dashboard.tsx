import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FilePlus2, Inbox } from 'lucide-react';
import { api } from '@credit-core/api-client';
import { PRODUCT_LABEL, Role } from '@credit-core/shared';
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
          <h1 className="text-2xl font-bold">Ishlar ro‘yxati</h1>
          <p className="text-sm text-slate-500">
            {isOperator ? 'Sizning kredit ishlaringiz' : 'Sizning navbatingizdagi ishlar'}
          </p>
        </div>
        {isOperator && (
          <Link to="/cases/new">
            <Button>
              <FilePlus2 className="h-4 w-4" /> Yangi ish
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
          <p className="text-slate-500">Hozircha ishlar yo‘q</p>
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
                <Card className="flex items-center justify-between transition hover:border-brand-300 hover:shadow-soft">
                  <div>
                    <p className="font-semibold">{c.number}</p>
                    <p className="text-sm text-slate-500">
                      {c.borrowerName ?? '—'} • {PRODUCT_LABEL[c.productType]}
                      {c.branchSymbol ? ` • ${c.branchSymbol}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="nums text-sm font-semibold text-ink">{formatMoney(c.amount)}</span>
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
