import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, LogOut, Menu, Search, X, ArrowRight, FileText } from '../lib/icons';
import { api, userAvatarUrl } from '@credit-core/api-client';
import { ROLE_LABEL, STATUS_LABEL } from '@credit-core/shared';
import { useAuth } from '../lib/auth';
import { cn } from '../lib/cn';
import { ConfirmDialog } from './Modal';
import { LangSwitch, ThemeSwitch } from './Switches';
import { LogoMark } from './Logo';

/** Global case search — by number, borrower, guarantor, operator or branch. */
function GlobalSearch({ className }: { className?: string }) {
  const navigate = useNavigate();
  const boxRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);

  const { data: results, isFetching } = useQuery({
    queryKey: ['case-search', q],
    queryFn: () => api.searchCases(q),
    enabled: q.trim().length >= 2,
  });

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const go = (id: string) => { navigate(`/cases/${id}`); setOpen(false); setQ(''); };

  return (
    <div ref={boxRef} className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Ariza, arizachi, kafil, operator yoki filial…"
        className="h-10 w-[260px] rounded-xl border border-hairline bg-canvas pl-10 pr-3 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100 dark:border-white/10 dark:bg-navy-800 dark:text-slate-100 dark:focus:ring-brand-900 xl:w-[340px]"
      />
      {open && q.trim().length >= 2 && (
        <div className="absolute left-0 top-12 z-50 w-[340px] overflow-hidden rounded-xl border border-hairline bg-white shadow-pop dark:border-white/10 dark:bg-navy-800 xl:w-[420px]">
          {isFetching && !results && <p className="px-4 py-3 text-sm text-slate-400">Qidirilmoqda…</p>}
          {results && results.length === 0 && <p className="px-4 py-3 text-sm text-slate-400">Hech narsa topilmadi</p>}
          <ul className="max-h-80 overflow-y-auto py-1">
            {results?.map((c) => (
              <li key={c.id}>
                <button onClick={() => go(c.id)} className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-slate-50 dark:hover:bg-white/5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-600/15 dark:text-brand-300"><FileText className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink dark:text-slate-100">{c.number} <span className="font-normal text-slate-400">· {c.borrowerName ?? '—'}</span></span>
                    <span className="block truncate text-xs text-muted">{c.branchSymbol ?? '—'} · {STATUS_LABEL[c.status]}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeKey?: 'unread';
}

export function AppShell({ title, nav, children }: { title: string; nav: NavItem[]; children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false); // mobile drawer
  const [collapsed, setCollapsed] = useState<boolean>(
    () => typeof window !== 'undefined' && localStorage.getItem('cc.sidebar.collapsed') === '1',
  ); // desktop rail (persisted)
  const [confirmLogout, setConfirmLogout] = useState(false);

  useEffect(() => {
    localStorage.setItem('cc.sidebar.collapsed', collapsed ? '1' : '0');
  }, [collapsed]);

  const { data: unread } = useQuery({ queryKey: ['unread'], queryFn: () => api.unreadCount(), refetchInterval: 20_000 });

  const current = nav.find((n) => n.to === location.pathname || (n.to !== '/' && location.pathname.startsWith(n.to)));

  const navList = (
    <nav className="space-y-1">
      {nav.map((item) => {
        const active = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to));
        const badge = item.badgeKey === 'unread' ? unread : 0;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setOpen(false)}
            title={item.label}
            className={cn(
              'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
              collapsed && 'justify-center px-0',
              active ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-100',
            )}
          >
            {active && !collapsed && <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r bg-brand-400" />}
            <item.icon className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && <span className="flex-1">{item.label}</span>}
            {!collapsed && !!badge && badge > 0 && (
              <span className="rounded-full bg-brand-500 px-1.5 text-[10px] font-semibold text-white">{badge > 99 ? '99+' : badge}</span>
            )}
            {collapsed && !!badge && badge > 0 && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand-400" />
            )}
          </Link>
        );
      })}
    </nav>
  );

  const sidebar = (railCollapsed: boolean) => (
    <div className={cn('flex h-full flex-col bg-navy-900 py-5 text-white', railCollapsed ? 'px-3' : 'px-4')}>
      {/* Logo */}
      <div className={cn('mb-6 flex shrink-0 items-center gap-2.5', railCollapsed ? 'justify-center px-0' : 'px-1')}>
        <LogoMark className="h-10 w-10 shrink-0" />
        {!railCollapsed && (
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-tight">credit<span className="text-brand-400">-core</span></p>
            <p className="text-xs text-slate-400">{user ? ROLE_LABEL[user.role] : ''}</p>
          </div>
        )}
      </div>

      {/* Section label */}
      {!railCollapsed && (
        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Menyu</p>
      )}

      <div className="no-scrollbar -mr-2 min-h-0 flex-1 overflow-y-auto pr-2">{navList}</div>

      {/* Bottom: profile + logout */}
      <div className={cn('mt-3 shrink-0 rounded-xl bg-white/5', railCollapsed ? 'p-2' : 'p-3')}>
        <Link
          to="/profile"
          onClick={() => setOpen(false)}
          title={user?.fullName}
          className={cn('flex items-center gap-2.5 rounded-lg p-1 transition hover:bg-white/5', railCollapsed && 'justify-center')}
        >
          {user?.hasAvatar ? (
            <img src={userAvatarUrl(user.id)} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
          ) : (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold">
              {(user?.fullName ?? '?').slice(0, 1).toUpperCase()}
            </span>
          )}
          {!railCollapsed && (
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{user?.fullName}</span>
              <span className="block truncate text-xs text-slate-400">{user?.branch?.name ?? 'Markaziy apparat'}</span>
            </span>
          )}
        </Link>
        <button
          onClick={() => { setOpen(false); setConfirmLogout(true); }}
          title="Chiqish"
          className={cn(
            'mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white',
            railCollapsed && 'justify-center px-0',
          )}
        >
          <LogOut className="h-4 w-4" /> {!railCollapsed && 'Chiqish'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-canvas">
      {/* Desktop sidebar (in-flow, collapsible) */}
      <aside
        className={cn(
          'sticky top-0 hidden h-screen shrink-0 transition-[width] duration-300 ease-in-out md:block',
          collapsed ? 'w-[84px]' : 'w-64',
        )}
      >
        {sidebar(collapsed)}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72">
            <button className="absolute right-3 top-4 z-10 text-slate-300" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
            {sidebar(false)}
          </aside>
        </div>
      )}

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-hairline bg-white/90 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-navy-900/90 md:px-6">
          {/* mobile menu */}
          <button
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-hairline text-slate-600 dark:border-white/10 dark:text-slate-300 md:hidden"
            onClick={() => setOpen(true)}
            aria-label="Menyu"
          >
            <Menu className="h-5 w-5" />
          </button>
          {/* desktop collapse */}
          <button
            className="hidden h-10 w-10 items-center justify-center rounded-xl border border-hairline text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5 md:flex"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Menyuni ochish' : 'Menyuni yig‘ish'}
            title={collapsed ? 'Menyuni ochish' : 'Menyuni yig‘ish'}
          >
            <ArrowRight className={cn('h-[18px] w-[18px] transition-transform duration-300', collapsed ? 'rotate-0' : 'rotate-180')} />
          </button>

          <h2 className="text-sm font-semibold text-ink dark:text-slate-100">{current?.label ?? title}</h2>

          {/* Global case search */}
          <GlobalSearch className="ml-2 hidden lg:block" />

          <div className="ml-auto flex items-center gap-2.5">
            <LangSwitch />
            <ThemeSwitch />
            <Link to="/notifications" className="relative flex h-10 w-10 items-center justify-center rounded-full border border-hairline text-slate-500 transition hover:bg-slate-50 hover:text-ink dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white">
              <Bell className="h-5 w-5" />
              {!!unread && unread > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-600 px-1 text-[10px] font-semibold text-white">{unread > 99 ? '99+' : unread}</span>}
            </Link>
            <Link to="/profile" className="hidden items-center gap-2 rounded-full py-1 pl-1 pr-2 transition hover:bg-slate-100 sm:flex dark:hover:bg-white/10">
              {user?.hasAvatar ? (
                <img src={userAvatarUrl(user.id)} alt="" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-800 text-xs font-semibold text-white dark:bg-brand-600">
                  {(user?.fullName ?? '?').slice(0, 1).toUpperCase()}
                </div>
              )}
              <span className="text-sm text-slate-600 dark:text-slate-300">{user?.fullName}</span>
            </Link>
          </div>
        </header>

        <div className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">{children}</div>
      </main>

      <ConfirmDialog
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        onConfirm={logout}
        title="Tizimdan chiqasizmi?"
        message="Joriy sessiya yakunlanadi va qaytadan login qilishingiz kerak bo'ladi."
        confirmLabel="Chiqish"
      />
    </div>
  );
}
