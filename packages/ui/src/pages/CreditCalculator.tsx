import { useMemo, useState } from 'react';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Calculator } from '../lib/icons';
import { Card, Field, Input } from '../components/primitives';
import { MoneyInput } from '../components/forms';
import { DataTable, type Column } from '../components/DataTable';
import { useTheme } from '../lib/theme';
import { formatMoney } from '../lib/cn';
import { chartSeries, chartAxis } from '../lib/chartColors';

/** Themed donut tooltip (slice name + money). */
function CalcTip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 shadow-theme-md dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
      <p className="font-semibold text-gray-800 dark:text-white">{payload[0].name}</p>
      <p className="nums text-gray-500 dark:text-gray-400">{formatMoney(Number(payload[0].value))}</p>
    </div>
  );
}

interface Row { id: string; n: number; payment: number; principal: number; interest: number; balance: number }

function annuity(amount: number, annualRate: number, months: number): Row[] {
  const r = annualRate / 100 / 12;
  const pay = r === 0 ? amount / months : (amount * r) / (1 - Math.pow(1 + r, -months));
  const rows: Row[] = [];
  let balance = amount;
  for (let n = 1; n <= months; n++) {
    const interest = balance * r;
    const principal = Math.min(pay - interest, balance);
    balance = Math.max(0, balance - principal);
    rows.push({ id: String(n), n, payment: principal + interest, principal, interest, balance });
  }
  return rows;
}

function differentiated(amount: number, annualRate: number, months: number): Row[] {
  const r = annualRate / 100 / 12;
  const principal = amount / months;
  const rows: Row[] = [];
  let balance = amount;
  for (let n = 1; n <= months; n++) {
    const interest = balance * r;
    balance = Math.max(0, balance - principal);
    rows.push({ id: String(n), n, payment: principal + interest, principal, interest, balance });
  }
  return rows;
}

export function CreditCalculator() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const series = chartSeries(dark);
  const { tick } = chartAxis(dark);
  const [amount, setAmount] = useState(100_000_000);
  const [rate, setRate] = useState(24);
  const [months, setMonths] = useState(18);
  const [method, setMethod] = useState<'annuity' | 'diff'>('annuity');

  const schedule = useMemo(
    () => (amount > 0 && months > 0 ? (method === 'annuity' ? annuity(amount, rate, months) : differentiated(amount, rate, months)) : []),
    [amount, rate, months, method],
  );
  const totalInterest = schedule.reduce((s, r) => s + r.interest, 0);
  const totalPay = schedule.reduce((s, r) => s + r.payment, 0);
  const firstPay = schedule[0]?.payment ?? 0;

  const columns: Column<Row>[] = [
    { key: 'n', header: '#', className: 'nums text-gray-500 dark:text-gray-400', render: (r) => r.n },
    { key: 'payment', header: 'To‘lov', align: 'right', className: 'nums font-medium', render: (r) => formatMoney(Math.round(r.payment)) },
    { key: 'principal', header: 'Asosiy qarz', align: 'right', className: 'nums', render: (r) => formatMoney(Math.round(r.principal)) },
    { key: 'interest', header: 'Foiz', align: 'right', className: 'nums', render: (r) => formatMoney(Math.round(r.interest)) },
    { key: 'balance', header: 'Qoldiq', align: 'right', className: 'nums text-gray-500 dark:text-gray-400', render: (r) => formatMoney(Math.round(r.balance)) },
  ];

  const pie = [
    { name: 'Asosiy qarz', value: amount, fill: series.brand },
    { name: 'Foiz (ustama)', value: Math.round(totalInterest), fill: series.warning },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-700 text-white"><Calculator className="h-5 w-5" /></span>
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Kredit kalkulyatori</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">To‘lov jadvali va ustama hisobi</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="space-y-4 lg:col-span-1">
          <Field label="Kredit summasi"><MoneyInput value={amount} onChange={(v) => setAmount(v ?? 0)} /></Field>
          <Field label="Yillik foiz stavkasi (%)"><Input type="number" value={rate} onChange={(e) => setRate(Number(e.target.value) || 0)} /></Field>
          <Field label="Muddat (oy)"><Input type="number" value={months} onChange={(e) => setMonths(Number(e.target.value) || 0)} /></Field>
          <Field label="To‘lov usuli">
            <div className="flex gap-2">
              {(['annuity', 'diff'] as const).map((m) => (
                <button key={m} onClick={() => setMethod(m)} aria-pressed={method === m}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30 ${method === m ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-400' : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-white/5'}`}>
                  {m === 'annuity' ? 'Annuitet' : 'Differensial'}
                </button>
              ))}
            </div>
          </Field>
        </Card>

        <Card className="lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label={method === 'annuity' ? 'Oylik to‘lov' : '1-oy to‘lovi'} value={formatMoney(Math.round(firstPay))} tone="text-brand-700 dark:text-brand-400" />
            <Stat label="Jami ustama (foiz)" value={formatMoney(Math.round(totalInterest))} tone="text-warning-600 dark:text-warning-500" />
            <Stat label="Jami to‘lov" value={formatMoney(Math.round(totalPay))} tone="text-gray-800 dark:text-white" />
          </div>
          <div className="mt-4 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {pie.map((p) => <Cell key={p.name} fill={p.fill} />)}
                </Pie>
                <Tooltip content={<CalcTip />} />
                <Legend wrapperStyle={{ fontSize: 13, color: tick }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <DataTable columns={columns} rows={schedule} pageSize={12} empty="Qiymatlarni kiriting" />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl bg-gray-50 p-3 dark:bg-white/5">
      <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`nums text-lg font-bold ${tone}`}>{value}</p>
    </div>
  );
}
