import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  Banknote, FileCheck2, Landmark, Layers, House, Car, Chart, Money, Building, Clock, Pause, ArrowRight,
} from '../lib/icons';
import { api } from '@credit-core/api-client';
import { CaseStatus, ProductType, PRODUCT_LABEL, STATUS_LABEL, Role } from '@credit-core/shared';
import { Card, Skeleton, StatusBadge } from '../components/primitives';
import { DatePicker, Select } from '../components/forms';
import { useAuth } from '../lib/auth';
import { MetricCard, WidgetCard } from '../components/widgets';
import { useTheme } from '../lib/theme';
import { cn, formatMoney } from '../lib/cn';
import { chartSeries, chartAxis, productColor, statusColor } from '../lib/chartColors';

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

/** Short so'm: 1.2 mlrd / 340 mln / 56 ming. */
function compactSom(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1).replace('.0', '')} mlrd`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace('.0', '')} mln`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)} ming`;
  return String(n);
}

/** Month-over-month % change of the last two values. */
function momDelta(values: number[]): number | undefined {
  if (values.length < 2) return undefined;
  const prev = values[values.length - 2];
  const cur = values[values.length - 1];
  if (!prev) return cur > 0 ? 100 : undefined;
  return Math.round(((cur - prev) / prev) * 100);
}

/** Multi-series tooltip — renders each payload row with its color; money or count. */
function SeriesTip({ active, payload, label, unit }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-theme-md dark:border-gray-700 dark:bg-gray-800">
      {label != null && <p className="mb-1 font-semibold text-gray-800 dark:text-white">{label}</p>}
      {payload.map((p: any) => (
        <p key={p.dataKey} className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.fill }} />
          {p.name}:&nbsp;
          <span className="nums font-medium text-gray-800 dark:text-gray-100">{unit === 'money' ? formatMoney(p.value) : `${p.value} ta`}</span>
        </p>
      ))}
    </div>
  );
}

/** Donut tooltip (status name + count). */
function PieTip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 shadow-theme-md dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
      <p className="font-semibold text-gray-800 dark:text-white">{payload[0].payload.name}</p>
      <p className="nums text-gray-500 dark:text-gray-400">{payload[0].value} ta</p>
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
  const [region, setRegion] = useState('');
  const [metric, setMetric] = useState<'count' | 'amount'>('count');
  const { data: branches } = useQuery({ queryKey: ['branches'], queryFn: () => api.branches(), enabled: canFilterBranch });
  const regions = useMemo(() => [...new Set((branches ?? []).map((b) => b.region).filter(Boolean) as string[])].sort(), [branches]);
  const branchOptions = useMemo(() => (branches ?? []).filter((b) => !region || b.region === region), [branches, region]);
  const range = useMemo(() => ({ ...computeRange(rangeKey, custom), branchId: branchId || undefined, region: region || undefined }), [rangeKey, custom, branchId, region]);
  const { data, isLoading } = useQuery({ queryKey: ['stats', rangeKey, custom.from, custom.to, branchId, region], queryFn: () => api.stats(range) });
  const dark = theme === 'dark';
  const { grid, tick } = chartAxis(dark);
  const series = chartSeries(dark);
  const productClr = productColor(dark);
  const statusClr = statusColor(dark);

  const filterBar = (
    <div className="flex flex-wrap items-center gap-2">
      {canFilterBranch && regions.length > 0 && (
        <div className="w-44">
          <Select<string>
            value={region}
            onChange={(v) => { setRegion(v); setBranchId(''); }}
            searchable
            placeholder="Barcha hududlar"
            options={[{ value: '', label: 'Barcha hududlar' }, ...regions.map((r) => ({ value: r, label: r }))]}
          />
        </div>
      )}
      {canFilterBranch && (
        <div className="w-52">
          <Select<string>
            value={branchId}
            onChange={setBranchId}
            searchable
            placeholder="Barcha filiallar"
            options={[
              { value: '', label: 'Barcha filiallar' },
              ...branchOptions.map((b) => ({ value: b.id, label: b.region ? `${b.name} · ${b.region}` : b.name })),
            ]}
          />
        </div>
      )}
      <div className="flex flex-wrap gap-1 rounded-xl border border-gray-200 bg-white p-1 dark:border-gray-800 dark:bg-gray-900">
        {RANGE_PRESETS.map((p) => (
          <button key={p.key} onClick={() => setRangeKey(p.key)}
            className={cn('rounded-lg px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30',
              rangeKey === p.key
                ? 'bg-brand-600 text-white shadow-theme-sm'
                : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5')}>
            {p.label}
          </button>
        ))}
      </div>
      {rangeKey === 'custom' && (
        <div className="flex items-center gap-2">
          <div className="w-40"><DatePicker value={custom.from} onChange={(v) => setCustom((c) => ({ ...c, from: v }))} placeholder="dan" /></div>
          <span className="text-gray-500 dark:text-gray-400">—</span>
          <div className="w-40"><DatePicker value={custom.to} onChange={(v) => setCustom((c) => ({ ...c, to: v }))} placeholder="gacha" /></div>
        </div>
      )}
    </div>
  );

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Monitoring va tahlil</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Ishlar bo‘yicha umumiy ko‘rsatkichlar</p>
      </div>
      {filterBar}
    </div>
  );

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        {header}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[132px] rounded-2xl" />)}</div>
        <Skeleton className="h-80 rounded-2xl" />
        <div className="grid gap-6 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}</div>
      </div>
    );
  }

  const pieData = data.byStatus.filter((s) => s.count > 0).map((s) => ({ name: STATUS_LABEL[s.status], value: s.count, status: s.status }));
  const statusList = [...data.byStatus].filter((s) => s.count > 0).sort((a, b) => b.count - a.count);
  const topBranches = data.byBranch.slice(0, 6);
  const branchMax = Math.max(1, ...topBranches.map((b) => b.count));
  const countDelta = momDelta(data.byMonth.map((m) => m.count));
  const amountDelta = momDelta(data.byMonth.map((m) => m.amount));
  const barData = data.byMonth.map((m) => ({ name: monthLabel(m.month), value: metric === 'count' ? m.count : m.amount }));
  const productMonthData = data.byProductMonth.map((m) => ({ name: monthLabel(m.month), realEstate: m.realEstate, auto: m.auto }));
  const hasProductMonth = productMonthData.some((m) => m.realEstate + m.auto > 0);

  return (
    <div className="space-y-6">
      {header}

      {/* KPI hero row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={Layers} label="Jami ishlar" value={String(data.totalCases)} delta={countDelta} tone="brand" />
        <MetricCard icon={Banknote} label="Jami summa" value={formatMoney(data.totalAmount)} delta={amountDelta} tone="warning" />
        <MetricCard icon={FileCheck2} label="Yakunlangan" value={String(data.finalizedCount)} tone="success" />
        <MetricCard icon={Chart} label="Jarayonda" value={String(data.activeCount)} tone="brand" />
      </div>

      {/* Secondary metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={Money} label="O‘rtacha summa" value={formatMoney(data.avgAmount)} tone="warning" />
        <MetricCard icon={FileCheck2} label="Tasdiqlash ulushi" value={`${Math.round(data.approvalRate * 100)}%`} tone="success" />
        <MetricCard icon={Landmark} label="Jami KATM" value={formatMoney(data.totalKatm)} tone="danger" />
        <MetricCard icon={Landmark} label="Garov qiymati" value={formatMoney(data.totalCollateralValue)} tone="brand" />
      </div>

      {/* Hero chart with count / amount toggle */}
      <WidgetCard
        title="Arizalar dinamikasi"
        subtitle="So‘nggi 6 oy kesimida"
        action={
          <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-1 dark:border-gray-800 dark:bg-gray-900">
            {([['count', 'Soni'], ['amount', 'Summa']] as const).map(([k, lbl]) => (
              <button key={k} onClick={() => setMetric(k)}
                className={cn('rounded-md px-3 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30',
                  metric === k ? 'bg-brand-600 text-white shadow-theme-sm' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5')}>
                {lbl}
              </button>
            ))}
          </div>
        }
      >
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ left: -8, right: 8, top: 8 }} barCategoryGap="28%">
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={series.brandSoft} />
                  <stop offset="100%" stopColor={series.brand} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: tick }} axisLine={false} tickLine={false} />
              <YAxis
                allowDecimals={false}
                width={metric === 'amount' ? 56 : 36}
                tick={{ fontSize: 11, fill: tick }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => (metric === 'amount' ? compactSom(Number(v)) : String(v))}
              />
              <Tooltip content={<SeriesTip unit={metric === 'amount' ? 'money' : 'count'} />} cursor={{ fill: theme === 'dark' ? 'rgba(255,255,255,.04)' : 'rgba(16,24,40,.04)' }} />
              <Bar dataKey="value" name={metric === 'amount' ? 'Summa' : 'Arizalar'} fill="url(#barGrad)" radius={[6, 6, 0, 0]} maxBarSize={46} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </WidgetCard>

      {/* Top branches · status breakdown · live process card */}
      <div className="grid gap-6 lg:grid-cols-3">
        <WidgetCard
          title="Top filiallar"
          subtitle="Arizalar soni bo‘yicha"
          action={canFilterBranch ? <Link to="/branches" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline dark:text-brand-400">Hammasi <ArrowRight className="h-4 w-4" /></Link> : undefined}
        >
          {topBranches.length ? (
            <ul className="space-y-3.5">
              {topBranches.map((b, i) => (
                <li key={b.branch}>
                  <div className="mb-1 flex items-center gap-2 text-sm">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-50 text-xs font-bold text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">{i + 1}</span>
                    <span className="flex items-center gap-1.5 font-medium text-gray-700 dark:text-gray-200"><Building className="h-4 w-4 text-gray-400" /> {b.branch}</span>
                    <span className="ml-auto shrink-0 text-gray-500 dark:text-gray-400"><span className="nums font-semibold text-gray-700 dark:text-gray-200">{b.count}</span> ta · {compactSom(b.amount)}</span>
                  </div>
                  <div className="ml-9 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${(b.count / branchMax) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">Ma'lumot yo‘q</p>
          )}
        </WidgetCard>

        <WidgetCard title="Holatlar" subtitle="Bosqichlar kesimida">
          {statusList.length ? (
            <ul className="space-y-3.5">
              {statusList.map((s) => {
                const pct = data.totalCases ? Math.round((s.count / data.totalCases) * 100) : 0;
                return (
                  <li key={s.status}>
                    <div className="mb-1 flex items-center gap-2 text-sm">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: statusClr[s.status] }} />
                      <span className="truncate font-medium text-gray-700 dark:text-gray-200">{STATUS_LABEL[s.status]}</span>
                      <span className="ml-auto shrink-0 text-gray-500 dark:text-gray-400"><span className="nums font-semibold text-gray-700 dark:text-gray-200">{s.count}</span> · {pct}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: statusClr[s.status] }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">Ma'lumot yo‘q</p>
          )}
        </WidgetCard>

        <WidgetCard title="Jarayon holati" subtitle="Hozirgi yuk">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success-500 opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success-500" />
            </span>
            <span className="nums text-3xl font-bold text-gray-800 dark:text-white">{data.activeCount}</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">ariza jarayonda</span>
          </div>
          <div className="-mx-1 mt-3 h-24">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.byMonth.map((m) => ({ name: monthLabel(m.month), count: m.count }))} margin={{ top: 4, bottom: 0, left: 4, right: 4 }}>
                <defs>
                  <linearGradient id="liveGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={series.success} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={series.success} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Tooltip content={<SeriesTip unit="count" />} cursor={false} />
                <Area type="monotone" dataKey="count" name="Arizalar" stroke={series.success} strokeWidth={2} fill="url(#liveGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
            <LiveStat icon={Clock} label="Muddati o‘tgan" value={data.overdueCount} tone="danger" />
            <LiveStat icon={Pause} label="Pauzada" value={data.pausedCount} tone="muted" />
            <LiveStat icon={FileCheck2} label="Yakunlangan" value={data.finalizedCount} tone="success" />
          </div>
        </WidgetCard>
      </div>

      {/* Product dynamics (stacked) · status share (donut) */}
      <div className="grid gap-6 lg:grid-cols-5">
        <WidgetCard title="Mahsulot dinamikasi" subtitle="Oylar bo‘yicha taqsimot" className="lg:col-span-3">
          {hasProductMonth ? (
            <>
              <div className="mb-3 flex flex-wrap gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: productClr[ProductType.REAL_ESTATE] }} /> {PRODUCT_LABEL[ProductType.REAL_ESTATE]}</span>
                <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: productClr[ProductType.AUTO] }} /> {PRODUCT_LABEL[ProductType.AUTO]}</span>
              </div>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={productMonthData} margin={{ left: -8, right: 8, top: 4 }} barCategoryGap="28%">
                    <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: tick }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} width={32} tick={{ fontSize: 11, fill: tick }} axisLine={false} tickLine={false} />
                    <Tooltip content={<SeriesTip unit="count" />} cursor={{ fill: theme === 'dark' ? 'rgba(255,255,255,.04)' : 'rgba(16,24,40,.04)' }} />
                    <Bar dataKey="realEstate" stackId="p" name={PRODUCT_LABEL[ProductType.REAL_ESTATE]} fill={productClr[ProductType.REAL_ESTATE]} radius={[0, 0, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="auto" stackId="p" name={PRODUCT_LABEL[ProductType.AUTO]} fill={productClr[ProductType.AUTO]} radius={[6, 6, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">Ma'lumot yo‘q</p>
          )}
        </WidgetCard>

        <WidgetCard title="Holatlar ulushi" className="lg:col-span-2">
          {data.totalCases ? (
            <>
              <div className="relative h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={86} paddingAngle={2} stroke="none">
                      {pieData.map((p) => <Cell key={p.status} fill={statusClr[p.status]} />)}
                    </Pie>
                    <Tooltip content={<PieTip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="nums text-3xl font-bold text-gray-800 dark:text-white">{data.totalCases}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">jami ariza</span>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                {pieData.map((p) => (
                  <div key={p.status} className="flex items-center gap-1.5 text-xs">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: statusClr[p.status as CaseStatus] }} />
                    <span className="truncate text-gray-500 dark:text-gray-400">{p.name}</span>
                    <span className="nums ml-auto font-semibold text-gray-700 dark:text-gray-200">{p.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">Ma'lumot yo‘q</p>
          )}
        </WidgetCard>
      </div>

      {/* Product split bars */}
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
                  <span className="font-medium text-gray-700 dark:text-gray-200">{PRODUCT_LABEL[p.product]}</span>
                  <span className="ml-auto text-gray-500 dark:text-gray-400">{p.count} ta · {formatMoney(p.amount)}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: productClr[p.product] }} />
                </div>
              </div>
            );
          })}
        </div>
      </WidgetCard>

      <Card className="overflow-hidden p-0">
        <h2 className="border-b border-gray-200 p-5 font-semibold text-gray-800 dark:border-gray-800 dark:text-white">So‘nggi arizalar</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500 dark:bg-white/5 dark:text-gray-400">
              <tr>
                <th className="px-5 py-3">Raqam</th>
                <th className="px-5 py-3">Qarz oluvchi</th>
                <th className="px-5 py-3">Filial</th>
                <th className="px-5 py-3 text-right">Summa</th>
                <th className="px-5 py-3">Holat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {data.recent.map((c) => (
                <tr key={c.id} className="transition hover:bg-gray-50 dark:hover:bg-white/5">
                  <td className="px-5 py-3 font-medium">
                    <Link to={`/cases/${c.id}`} className="text-brand-700 hover:underline dark:text-brand-400">{c.number}</Link>
                  </td>
                  <td className="px-5 py-3 text-gray-700 dark:text-gray-200">{c.borrowerName ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-700 dark:text-gray-200">{c.branchSymbol ?? '—'}</td>
                  <td className="nums px-5 py-3 text-right font-medium text-gray-700 dark:text-gray-200">{formatMoney(c.amount)}</td>
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

const liveTone = {
  danger: 'text-error-600 dark:text-error-500',
  success: 'text-success-600 dark:text-success-500',
  muted: 'text-gray-600 dark:text-gray-300',
} as const;

function LiveStat({ icon: Icon, label, value, tone }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; tone: keyof typeof liveTone }) {
  return (
    <div className="text-center">
      <p className={cn('nums flex items-center justify-center gap-1 text-lg font-bold', liveTone[tone])}>
        <Icon className="h-4 w-4" /> {value}
      </p>
      <p className="mt-0.5 text-[11px] leading-tight text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  );
}
