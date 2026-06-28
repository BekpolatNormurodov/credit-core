import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Banknote, FileCheck2, Landmark, Layers } from '../lib/icons';
import { api } from '@credit-core/api-client';
import { CaseStatus, STATUS_LABEL } from '@credit-core/shared';
import { Card, Skeleton, StatusBadge } from '../components/primitives';
import { useTheme } from '../lib/theme';
import { formatMoney } from '../lib/cn';

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
    <Card className="relative overflow-hidden">
      <div className={`absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-10 ${tone}`} />
      <div className="flex items-center gap-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${tone}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
          <p className="nums truncate text-xl font-bold text-ink dark:text-slate-100">{value}</p>
        </div>
      </div>
    </Card>
  );
}

function ChartTip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-hairline bg-white px-3 py-2 text-xs shadow-pop dark:border-white/10 dark:bg-navy-800 dark:text-slate-100">
      <p className="font-semibold">{payload[0].payload.name}</p>
      <p className="text-muted">{payload[0].value} ta</p>
    </div>
  );
}

export function AnalyticsPage() {
  const { theme } = useTheme();
  const { data, isLoading } = useQuery({ queryKey: ['stats'], queryFn: () => api.stats() });
  const grid = theme === 'dark' ? 'rgba(255,255,255,.08)' : '#e2e8f0';
  const tick = theme === 'dark' ? '#94a3b8' : '#64748b';

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
        <div className="grid gap-6 lg:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}</div>
      </div>
    );
  }

  const statusData = data.byStatus.map((s) => ({ name: STATUS_LABEL[s.status], count: s.count, status: s.status }));
  const pieData = data.byStatus.filter((s) => s.count > 0).map((s) => ({ name: STATUS_LABEL[s.status], value: s.count, status: s.status }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Monitoring va tahlil</h1>
        <p className="text-sm text-muted">Ishlar bo‘yicha umumiy ko‘rsatkichlar</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Layers} label="Jami ishlar" value={String(data.totalCases)} tone="bg-brand-600" />
        <StatCard icon={FileCheck2} label="Yakunlangan" value={String(data.finalizedCount)} tone="bg-success-600" />
        <StatCard icon={Banknote} label="Jami summa" value={formatMoney(data.totalAmount)} tone="bg-navy-800" />
        <StatCard icon={Landmark} label="Jami KATM" value={formatMoney(data.totalKatm)} tone="bg-warning-600" />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <h2 className="mb-4 font-semibold">Holat bo‘yicha taqsimot</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData} margin={{ left: -18, top: 6 }}>
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#0369a1" stopOpacity={0.85} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: tick }} interval={0} angle={-18} textAnchor="end" height={52} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: tick }} />
                <Tooltip content={<ChartTip />} cursor={{ fill: theme === 'dark' ? 'rgba(255,255,255,.04)' : '#f1f5f9' }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={48}>
                  {statusData.map((s) => <Cell key={s.status} fill={hexFor[s.status]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="mb-4 font-semibold">Holatlar ulushi</h2>
          {data.totalCases ? (
            <div className="relative h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={2} stroke="none">
                    {pieData.map((p) => <Cell key={p.status} fill={hexFor[p.status]} />)}
                  </Pie>
                  <Tooltip content={<ChartTip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="nums text-3xl font-bold text-ink dark:text-slate-100">{data.totalCases}</span>
                <span className="text-xs text-muted">jami ariza</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Ma'lumot yo‘q</p>
          )}
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {pieData.map((p) => (
              <div key={p.status} className="flex items-center gap-1.5 text-xs">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: hexFor[p.status as CaseStatus] }} />
                <span className="truncate text-muted">{p.name}</span>
                <span className="nums ml-auto font-semibold">{p.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="mb-4 font-semibold">Filial bo‘yicha hajm</h2>
        {data.byBranch.length ? (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.byBranch.map((b) => ({ name: b.branch, count: b.count }))} margin={{ left: -18, top: 6 }}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: tick }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: tick }} />
                <Tooltip content={<ChartTip />} cursor={{ stroke: grid }} />
                <Area type="monotone" dataKey="count" stroke="#0ea5e9" strokeWidth={2.5} fill="url(#areaGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-slate-400">Ma'lumot yo‘q</p>
        )}
      </Card>

      <Card className="overflow-hidden p-0">
        <h2 className="border-b border-hairline p-5 font-semibold dark:border-white/10">So‘nggi arizalar</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-muted dark:bg-white/5">
              <tr>
                <th className="px-5 py-3">Raqam</th>
                <th className="px-5 py-3">Qarz oluvchi</th>
                <th className="px-5 py-3">Filial</th>
                <th className="px-5 py-3 text-right">Summa</th>
                <th className="px-5 py-3">Holat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {data.recent.map((c) => (
                <tr key={c.id} className="transition hover:bg-slate-50 dark:hover:bg-white/5">
                  <td className="px-5 py-3 font-medium">
                    <Link to={`/cases/${c.id}`} className="text-brand-700 hover:underline dark:text-brand-300">{c.number}</Link>
                  </td>
                  <td className="px-5 py-3 dark:text-slate-200">{c.borrowerName ?? '—'}</td>
                  <td className="px-5 py-3 dark:text-slate-200">{c.branchSymbol ?? '—'}</td>
                  <td className="nums px-5 py-3 text-right font-medium dark:text-slate-200">{formatMoney(c.amount)}</td>
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
