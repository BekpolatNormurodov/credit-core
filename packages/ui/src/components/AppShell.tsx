import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, LogOut, Menu, ShieldCheck, X } from '../lib/icons';
import { api } from '@credit-core/api-client';
import { ROLE_LABEL } from '@credit-core/shared';
import { useAuth } from '../lib/auth';
import { cn } from '../lib/cn';
import { Button } from './primitives';

export interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function AppShell({
  title,
  nav,
  children,
}: {
  title: string;
  nav: NavItem[];
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const { data: unread } = useQuery({
    queryKey: ['unread'],
    queryFn: () => api.unreadCount(),
    refetchInterval: 20_000,
  });

  const navList = (
    <nav className="space-y-1">
      {nav.map((item) => {
        const active = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to));
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setOpen(false)}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
              active ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const sidebarInner = (
    <>
      <div className="mb-8 flex items-center gap-2.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-800 text-white">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-bold leading-tight">{title}</p>
          <p className="text-xs text-slate-500">{user ? ROLE_LABEL[user.role] : ''}</p>
        </div>
      </div>
      {navList}
      <div className="mt-auto border-t border-slate-100 pt-4">
        <p className="px-3 text-sm font-medium">{user?.fullName}</p>
        <p className="px-3 text-xs text-slate-400">{user?.branch?.name ?? 'Markaziy'}</p>
        <Button variant="ghost" className="mt-2 w-full justify-start" onClick={logout}>
          <LogOut className="h-4 w-4" /> Chiqish
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-canvas">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 flex-col border-r border-hairline bg-white p-5 md:flex">
        {sidebarInner}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-navy-900/50" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-72 flex-col bg-white p-5 shadow-pop">
            <button className="mb-2 self-end text-slate-400" onClick={() => setOpen(false)}>
              <X className="h-5 w-5" />
            </button>
            {sidebarInner}
          </aside>
        </div>
      )}

      <main className="flex-1 overflow-x-hidden">
        {/* Top bar (mobile hamburger + bell on all sizes) */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-hairline bg-white/80 px-4 py-3 backdrop-blur md:px-8">
          <button className="text-slate-600 md:hidden" onClick={() => setOpen(true)} aria-label="Menyu">
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold md:hidden">{title}</span>
          <div className="ml-auto flex items-center gap-3">
            <div className="relative">
              <Bell className="h-5 w-5 text-slate-500" />
              {!!unread && unread > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-600 px-1 text-[10px] font-semibold text-white">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </div>
            <span className="hidden text-sm text-slate-500 sm:inline">{user?.fullName}</span>
          </div>
        </header>

        <div className="mx-auto max-w-6xl p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
