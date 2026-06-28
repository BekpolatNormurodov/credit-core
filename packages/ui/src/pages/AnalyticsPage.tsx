import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Banknote, FileCheck2, Landmark, Layers, House, Car, Chart, Money } from '../lib/icons';
import { api } from '@credit-core/api-client';
import { CaseStatus, ProductType, PRODUCT_LABEL, STATUS_LABEL, Role } from '@credit-core/shared';
import { Card, Skeleton, StatusBadge } from '../components/primitives';
import { DatePicker, Select } from '../components/forms';
import { useAuth } from '../lib/auth';
import { MetricCard, WidgetCard } from '../components/widgets';
import { useTheme } from '../lib/theme';
import { cn, formatMoney } from '../lib/cn';

type RangeKey = 'all' | 'week' | 'month' | 'prev' | 'custom';
const RANGE_PRESETS: { key: RangeKey; label: string }[] = [
  { key: 'all', label: 'Hammasi' },
  { key: 'week', label: '7 kun' },
  { key: 'month', label: 'Shu oy' },
  { key: 'prev', label: "O'tgan oy" },
  { key: 'custom', label: 'Oraliq' },
];

function computeRange(key: RangeKey, custom: { from: string | null; to: string | null }): { from?: string; to?: string } | undefined {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  if (key === 'week') { const f = new Date(now); f.setDate(f.getDate() - 7); return { from: f.toISOString() }; }
  if (key === 'month') return { from: new Date(y, m, 1).toISOString() };
  if (key === 'prev') return { from: new Date(y, m - 1, 1).toISOString(), to: new Date(y, m, 0, 23, 59, 59).toISOString() };
  if (key === 'custom') return { from: custom.from ?? undefined, to: custom.to ?? undefined };
  return undefined;
}

const MONTH_SHORT = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
const monthLabel = (mk: string) => { const [, m] = mk.split('-'); return MONTH_SHORT[Number(m) - 1] ?? mk; };
const productHex: Record<ProductType, string> = { [ProductType.REAL_ESTATE]: '#0369a1', [ProductType.AUTO]: '#d97706' };

const hexFor: Record<CaseStatus, string> = {
  [CaseStatus.DRAFT]: '#94a3b8',
  [CaseStatus.MODERATION]: '#d97706',
  [CaseStatus.DIRECTOR_REVIEW]: '#8b5cf6',
  [CaseStatus.ADMIN_FINALIZE]: '#0369a1',
  [CaseStatus.FINALIZED]: '#059669',
  [CaseStatus.REJECTED]: '#dc2626',
};

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
  const { user } = useAuth();
  const canFilterBranch = user?.role === Role.ADMIN || user?.role === Role.DIRECTOR;
  const [rangeKey, setRangeKey] = useState<RangeKey>('all');
  const [custom, setCustom] = useState<{ from: string | null; to: string | null }>({ from: null, to: null });
  const [branchId, setBranchId] = useState('');
  const range = useMemo(() => ({ ...computeRange(rangeKey, custom), branchId: branchId || undefined }), [rangeKey, custom, branchId]);
  const { data: branches } = useQuery({ queryKey: ['branches'], queryFn: () => api.branches(), enabled: canFilterBranch });
  const { data, isLoading } = useQuery({ queryKey: ['stats', rangeKey, custom.from, custom.to, branchId], queryFn: () => api.stats(range) });
  const grid = theme === 'dark' ? 'rgba(255,255,255,.08)' : '#e2e8f0';
  const tick = theme === 'dark' ? '#94a3b8' : '#64748b';

  const filterBar = (
    <div className="flex flex-wrap items-center gap-2">
      {canFilterBranch && (
        <div className="w-52">
          <Select<string>
            value={branchId}
            onChange={setBranchId}
            searchable
            placeholder="Barcha filiallar"
            options={[
              { value: '', label: 'Barcha filiallar' },
              ...(branches ?? []).map((b) => ({ value: b.id, label: b.region ? `${b.name} · ${b.region}` : b.name })),
            ]}
          />
        </div>
      )}
      <div className="flex flex-wrap gap-1 rounded-xl border border-hairline bg-surface p-1 dark:border-white/10 dark:bg-navy-800">
        {RANGE_PRESETS.map((p) => (
          <button key={p.key} onClick={() => setRangeKey(p.key)}
            className={cn('rounded-lg px-3 py-1.5 text-sm font-medium transition',
              rangeKey === p.key ? 'bg-brand-600 text-white shadow-soft' : 'text-muted hover:bg-slate-100 dark:hover:bg-white/5')}>
            {p.label}
          </button>
        ))}
      </div>
      {rangeKey === 'custom' && (
        <div className="flex items-center gap-2">
          <div className="w-40"><DatePicker value={custom.from} onChange={(v) => setCustom((c) => ({ ...c, from: v }))} placeholder="dan" /></div>
          <span className="text-muted">—</span>
          <div className="w-40"><DatePicker value={custom.to} onChange={(v) => setCustom((c) => ({ ...c, to: v }))} placeholder="gacha" /></div>
        </div>
      )}
    </div>
  );

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Monitoring va tahlil</h1>
            <p className="text-sm text-muted">Ishlar bo‘yicha umumiy ko‘rsatkichlar</p>
          </div>
          {filterBar}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[132px] rounded-2xl" />)}</div>
        <div className="grid gap-6 lg:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}</div>
      </div>
    );
  }

  const pieData = data.byStatus.filter((s) => s.count > 0).map((s) => ({ name: STATUS_LABEL[s.status], value: s.count, status: s.status }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Monitoring va tahlil</h1>
          <p className="text-sm text-muted">Ishlar bo‘yicha umumiy ko‘rsatkichlar</p>
        </div>
        {filterBar}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={Layers} label="Jami ishlar" value={String(data.totalCases)} tone="brand" />
        <MetricCard icon={FileCheck2} label="Yakunlangan" value={String(data.finalizedCount)} tone="success" />
        <MetricCard icon={Banknote} label="Jami summa" value={formatMoney(data.totalAmount)} tone="warning" />
        <MetricCard icon={Landmark} label="Jami KATM" value={formatMoney(data.totalKatm)} tone="danger" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={Chart} label="Jarayonda" value={String(data.activeCount)} tone="brand" />
        <MetricCard icon={Money} label="O‘rtacha summa" value={formatMoney(data.avgAmount)} tone="warning" />
        <MetricCard icon={FileCheck2} label="Tasdiqlash ulushi" value={`${Math.round(data.approvalRate * 100)}%`} tone="success" />
        <MetricCard icon={Landmark} label="Jami garov qiymati" value={formatMoney(data.totalCollateralValue)} tone="danger" />
      </div>

      <WidgetCard title="Oylik dinamika (6 oy)">
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.byMonth.map((m) => ({ name: monthLabel(m.month), count: m.count, amount: m.amount }))} margin={{ left: -18, top: 6 }}>
              <defs>
                <linearGradient id="monthGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: tick }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: tick }} />
              <Tooltip content={<ChartTip />} cursor={{ stroke: grid }} />
              <Area type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#monthGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </WidgetCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <WidgetCard title="Holatlar ulushi">
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
        </WidgetCard>

        <WidgetCard title="Filial bo‘yicha hajm">
          {data.byBranch.length ? (
            <div className="h-64">
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
        </WidgetCard>
      </div>

      <WidgetCard title="Mahsulot bo‘yicha">
        <div className="space-y-3">
          {data.byProduct.map((p) => {
            const pct = data.totalCases ? Math.round((p.count / data.totalCases) * 100) : 0;
            return (
              <div key={p.product}>
                <div className="mb-1 flex items-center gap-2 text-sm">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-white ${p.product === ProductType.AUTO ? 'bg-warning-600' : 'bg-brand-700'}`}>
                    {p.product === ProductType.AUTO ? <Car className="h-4 w-4" /> : <House className="h-4 w-4" />}
                  </span>
                  <span className="font-medium">{PRODUCT_LABEL[p.product]}</span>
                  <span className="ml-auto text-muted">{p.count} ta · {formatMoney(p.amount)}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: productHex[p.product] }} />
                </div>
              </div>
            );
          })}
        </div>
      </WidgetCard>

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
