import { useMemo, useState } from 'react';
import { Search, ArrowRight } from '../lib/icons';
import { cn } from '../lib/cn';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
}

export function DataTable<T extends { id?: string }>({
  columns,
  rows,
  pageSize = 8,
  onRowClick,
  searchable,
  searchFields,
  empty = 'Ma’lumot yo‘q',
}: {
  columns: Column<T>[];
  rows: T[];
  pageSize?: number;
  onRowClick?: (row: T) => void;
  searchable?: boolean;
  searchFields?: (keyof T)[];
  empty?: string;
}) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!q || !searchFields) return rows;
    const needle = q.toLowerCase();
    return rows.filter((r) => searchFields.some((f) => String(r[f] ?? '').toLowerCase().includes(needle)));
  }, [rows, q, searchFields]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const slice = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const alignCls = (a?: string) => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left');

  return (
    <div className="overflow-hidden rounded-2xl border border-hairline bg-surface shadow-card dark:border-white/10 dark:bg-navy-800">
      {searchable && (
        <div className="flex items-center gap-2 border-b border-hairline px-4 py-3 dark:border-white/10">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(0); }}
            placeholder="Qidirish…"
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-slate-400 dark:text-slate-100"
          />
          {q && <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-white/10 dark:text-slate-300">{filtered.length}</span>}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-hairline bg-slate-50/80 text-xs uppercase tracking-wide text-muted dark:border-white/10 dark:bg-white/5">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={cn('whitespace-nowrap px-4 py-3 font-semibold', alignCls(c.align))}>{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.length === 0 && (
              <tr><td colSpan={columns.length} className="px-4 py-14 text-center text-slate-400">{empty}</td></tr>
            )}
            {slice.map((row, i) => (
              <tr
                key={row.id ?? i}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'border-b border-slate-50 transition last:border-0 dark:border-white/[0.04]',
                  i % 2 === 1 && 'bg-slate-50/40 dark:bg-white/[0.015]',
                  onRowClick && 'cursor-pointer hover:bg-brand-50/50 dark:hover:bg-brand-600/10',
                )}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn('px-4 py-3 text-ink dark:text-slate-200', alignCls(c.align), c.className)}>
                    {c.render ? c.render(row) : String((row as any)[c.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length > pageSize && (
        <div className="flex items-center justify-between border-t border-hairline px-4 py-3 text-sm dark:border-white/10">
          <span className="text-muted">{filtered.length} ta · {safePage + 1}/{pageCount} sahifa</span>
          <div className="flex gap-1.5">
            <button disabled={safePage === 0} onClick={() => setPage(safePage - 1)} className="flex items-center gap-1 rounded-lg border border-hairline px-3 py-1.5 transition disabled:opacity-40 enabled:hover:bg-slate-50 dark:border-white/10 dark:enabled:hover:bg-white/5">
              <ArrowRight className="h-3.5 w-3.5 rotate-180" /> Oldingi
            </button>
            <button disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)} className="flex items-center gap-1 rounded-lg border border-hairline px-3 py-1.5 transition disabled:opacity-40 enabled:hover:bg-slate-50 dark:border-white/10 dark:enabled:hover:bg-white/5">
              Keyingi <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
