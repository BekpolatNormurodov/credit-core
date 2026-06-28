import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Banknote, FileCheck2, Landmark, Layers } from '../lib/icons';
import { api } from '@credit-core/api-client';
import { CaseStatus, STATUS_LABEL } from '@credit-core/shared';
import { Card, Skeleton, StatusBadge } from '../components/primitives';
import { formatMoney } from '../lib/cn';

const statusColor: Record<CaseStatus, string> = {
  [CaseStatus.DRAFT]: 'bg-slate-400',
  [CaseStatus.MODERATION]: 'bg-warning-600',
  [CaseStatus.DIRECTOR_REVIEW]: 'bg-violet-500',
  [CaseStatus.ADMIN_FINALIZE]: 'bg-brand-600',
  [CaseStatus.FINALIZED]: 'bg-success-600',
  [CaseStatus.REJECTED]: 'bg-danger-600',
};

const hexFor: Record<CaseStatus, string> = {
  [CaseStatus.DRAFT]: '#94a3b8',
  [CaseStatus.MODERATION]: '#d97706',
  [CaseStatus.DIRECTOR_REVIEW]: '#8b5cf6',
  [CaseStatus.ADMIN_FINALIZE]: '#0369a1',
  [CaseStatus.FINALIZED]: '#059669',
  [CaseStatus.REJECTED]: '#dc2626',
};

function StatCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: string }) {
  return (
    <Card className="flex items-center gap-4">
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${tone}`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
        <p className="nums text-xl font-bold text-ink">{value}</p>
      </div>
    </Card>
  );
}

function Bars({ data }: { data: { label: string; count: number; color?: string }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3">
          <span className="w-40 shrink-0 truncate text-sm text-slate-600">{d.label}</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(d.count / max) * 100}%` }}
              transition={{ duration: 0.5 }}
              className={`h-full rounded-full ${d.color ?? 'bg-brand-600'}`}
            />
          </div>
          <span className="nums w-8 text-right text-sm font-semibold">{d.count}</span>
        </div>
      ))}
    </div>
  );
}

export function AnalyticsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['stats'], queryFn: () => api.stats() });

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Monitoring va tahlil</h1>
        <p className="text-sm text-slate-500">Ishlar bo‘yicha umumiy ko‘rsatkichlar</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Layers} label="Jami ishlar" value={String(data.totalCases)} tone="bg-brand-600" />
        <StatCard icon={FileCheck2} label="Yakunlangan" value={String(data.finalizedCount)} tone="bg-success-600" />
        <StatCard icon={Banknote} label="Jami summa" value={formatMoney(data.totalAmount)} tone="bg-navy-800" />
        <StatCard icon={Landmark} label="Jami KATM" value={formatMoney(data.totalKatm)} tone="bg-warning-600" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-semibold">Holat bo‘yicha</h2>
          <Bars
            data={data.byStatus.map((s) => ({
              label: STATUS_LABEL[s.status],
              count: s.count,
              color: statusColor[s.status],
            }))}
          />
        </Card>
        <Card>
          <h2 className="mb-4 font-semibold">Holatlar ulushi</h2>
          {data.totalCases ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.byStatus.filter((s) => s.count > 0).map((s) => ({ name: STATUS_LABEL[s.status], value: s.count, status: s.status }))}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {data.byStatus.filter((s) => s.count > 0).map((s) => (
                      <Cell key={s.status} fill={hexFor[s.status]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Ma'lumot yo‘q</p>
          )}
        </Card>
      </div>

      <Card className="lg:col-span-2">
        <h2 className="mb-4 font-semibold">Filial bo‘yicha</h2>
        {data.byBranch.length ? (
          <Bars data={data.byBranch.map((b) => ({ label: b.branch, count: b.count }))} />
        ) : (
          <p className="text-sm text-slate-400">Ma'lumot yo‘q</p>
        )}
      </Card>

      <Card className="overflow-hidden p-0">
        <h2 className="border-b border-hairline p-5 font-semibold">So‘nggi arizalar</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3">Raqam</th>
                <th className="px-5 py-3">Qarz oluvchi</th>
                <th className="px-5 py-3">Filial</th>
                <th className="px-5 py-3 text-right">Summa</th>
                <th className="px-5 py-3">Holat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.recent.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium">
                    <Link to={`/cases/${c.id}`} className="text-brand-700 hover:underline">{c.number}</Link>
                  </td>
                  <td className="px-5 py-3">{c.borrowerName ?? '—'}</td>
                  <td className="px-5 py-3">{c.branchSymbol ?? '—'}</td>
                  <td className="nums px-5 py-3 text-right font-medium">{formatMoney(c.amount)}</td>
                  <td className="px-5 py-3"><StatusBadge status={c.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
