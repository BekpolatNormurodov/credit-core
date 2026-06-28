import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, LogOut, Menu, ShieldCheck, X, Sun, Moon, Globe } from '../lib/icons';
import { api } from '@credit-core/api-client';
import { ROLE_LABEL } from '@credit-core/shared';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import { useI18n } from '../lib/i18n';
import { cn } from '../lib/cn';
import { ConfirmDialog } from './Modal';

export interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeKey?: 'unread';
}

export function AppShell({ title, nav, children }: { title: string; nav: NavItem[]; children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const { lang, setLang } = useI18n();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

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
            className={cn(
              'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
              active ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-100',
            )}
          >
            {active && <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r bg-brand-400" />}
            <item.icon className="h-[18px] w-[18px]" />
            <span className="flex-1">{item.label}</span>
            {!!badge && badge > 0 && (
              <span className="rounded-full bg-brand-500 px-1.5 text-[10px] font-semibold text-white">{badge > 99 ? '99+' : badge}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const sidebar = (
    <div className="flex h-full flex-col bg-navy-900 p-4 text-white">
      <div className="mb-6 flex shrink-0 items-center gap-2.5 px-1">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/90">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-bold leading-tight">credit-core</p>
          <p className="text-xs text-slate-400">{user ? ROLE_LABEL[user.role] : ''}</p>
        </div>
      </div>
      <div className="-mr-2 min-h-0 flex-1 overflow-y-auto pr-2">{navList}</div>
      <div className="mt-3 shrink-0 rounded-xl bg-white/5 p-3">
        <Link to="/profile" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-lg p-1 transition hover:bg-white/5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold">{(user?.fullName ?? '?').slice(0, 1).toUpperCase()}</span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{user?.fullName}</span>
            <span className="block truncate text-xs text-slate-400">{user?.branch?.name ?? 'Markaziy apparat'}</span>
          </span>
        </Link>
        <button onClick={() => { setOpen(false); setConfirmLogout(true); }} className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white">
          <LogOut className="h-4 w-4" /> Chiqish
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-canvas">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 md:block">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72">
            <button className="absolute right-3 top-4 z-10 text-slate-300" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
            {sidebar}
          </aside>
        </div>
      )}

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-hairline bg-white/90 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-navy-900/90 md:px-8">
          <button className="text-slate-600 dark:text-slate-300 md:hidden" onClick={() => setOpen(true)} aria-label="Menyu"><Menu className="h-5 w-5" /></button>
          <h2 className="text-sm font-semibold text-ink dark:text-slate-100">{current?.label ?? title}</h2>
          <div className="ml-auto flex items-center gap-2.5">
            <button onClick={() => setLang(lang === 'uz' ? 'ru' : 'uz')} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10" aria-label="Til">
              <Globe className="h-4 w-4" /> {lang.toUpperCase()}
            </button>
            <button onClick={toggle} className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10" aria-label="Mavzu">
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <Link to="/notifications" className="relative text-slate-500 hover:text-ink dark:text-slate-300 dark:hover:text-white">
              <Bell className="h-5 w-5" />
              {!!unread && unread > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-600 px-1 text-[10px] font-semibold text-white">{unread > 99 ? '99+' : unread}</span>}
            </Link>
            <Link to="/profile" className="hidden items-center gap-2 rounded-full py-1 pl-1 pr-2 transition hover:bg-slate-100 sm:flex dark:hover:bg-white/10">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-800 text-xs font-semibold text-white dark:bg-brand-600">
                {(user?.fullName ?? '?').slice(0, 1).toUpperCase()}
              </div>
              <span className="text-sm text-slate-600 dark:text-slate-300">{user?.fullName}</span>
            </Link>
          </div>
        </header>

        <div className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-8">{children}</div>
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
