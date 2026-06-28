import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LogOut, ShieldCheck } from 'lucide-react';
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

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden w-64 flex-col border-r border-slate-200 bg-white p-5 md:flex">
        <div className="mb-8 flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">{title}</p>
            <p className="text-xs text-slate-500">{user ? ROLE_LABEL[user.role] : ''}</p>
          </div>
        </div>
        <nav className="space-y-1">
          {nav.map((item) => {
            const active = location.pathname === item.to || location.pathname.startsWith(item.to + '/');
            return (
              <Link
                key={item.to}
                to={item.to}
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
        <div className="mt-auto border-t border-slate-100 pt-4">
          <p className="px-3 text-sm font-medium">{user?.fullName}</p>
          <p className="px-3 text-xs text-slate-400">{user?.branch?.name ?? 'Markaziy'}</p>
          <Button variant="ghost" className="mt-2 w-full justify-start" onClick={logout}>
            <LogOut className="h-4 w-4" /> Chiqish
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-6xl p-6 md:p-10">{children}</div>
      </main>
    </div>
  );
}
