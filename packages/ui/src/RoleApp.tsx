import '@fontsource/fira-sans/300.css';
import '@fontsource/fira-sans/400.css';
import '@fontsource/fira-sans/500.css';
import '@fontsource/fira-sans/600.css';
import '@fontsource/fira-sans/700.css';
import '@fontsource/fira-code/400.css';
import '@fontsource/fira-code/500.css';
import '@fontsource/fira-code/600.css';
import '@fontsource/fira-code/700.css';
import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { BarChart3, FilePlus2, LayoutGrid, Calculator, Messages, Building, UserAdd, Bell as BellIcon } from './lib/icons';
import { Role, ROLE_LABEL } from '@credit-core/shared';
import { AuthProvider, useAuth } from './lib/auth';
import { ThemeProvider } from './lib/theme';
import { I18nProvider, useI18n } from './lib/i18n';
import { ToastProvider } from './components/Toast';
import { Splash } from './components/Splash';
import { LoginPage } from './components/LoginPage';
import { AppShell, type NavItem } from './components/AppShell';
import { Button } from './components/primitives';
import { Dashboard } from './pages/Dashboard';
import { CaseForm } from './pages/CaseForm';
import { CaseView } from './pages/CaseView';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { CreditCalculator } from './pages/CreditCalculator';
import { ChatsPage } from './pages/ChatsPage';
import { BranchesPage } from './pages/BranchesPage';
import { UsersPage } from './pages/UsersPage';
import { ProfilePage } from './pages/ProfilePage';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });

function navFor(role: Role, t: (k: string) => string): NavItem[] {
  const base: NavItem[] = [{ to: '/', label: t('nav.applications'), icon: LayoutGrid }];
  if (role === Role.OPERATOR) base.push({ to: '/?new=1', label: t('nav.new'), icon: FilePlus2 });
  base.push({ to: '/calculator', label: t('nav.calculator'), icon: Calculator });
  base.push({ to: '/chats', label: t('nav.chats'), icon: Messages, badgeKey: 'unread' });
  base.push({ to: '/analytics', label: t('nav.monitoring'), icon: BarChart3 });
  base.push({ to: '/notifications', label: t('nav.notifications'), icon: BellIcon, badgeKey: 'unread' });
  if (role === Role.ADMIN) {
    base.push({ to: '/branches', label: t('nav.branches'), icon: Building });
    base.push({ to: '/users', label: t('nav.users'), icon: UserAdd });
  }
  return base;
}

function Shell({ role, title }: { role: Role; title: string }) {
  const { user, logout } = useAuth();
  const { t } = useI18n();

  if (!user) return <LoginPage role={role} title={title} />;

  if (user.role !== role) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-lg font-semibold">Bu portal "{ROLE_LABEL[role]}" uchun.</p>
        <p className="text-slate-500">Siz "{ROLE_LABEL[user.role]}" rolidasiz — to‘g‘ri portalga kiring.</p>
        <Button variant="secondary" onClick={logout}>Chiqish</Button>
      </div>
    );
  }

  return (
    <AppShell title={title} nav={navFor(role, t)}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        {role === Role.OPERATOR && <Route path="/cases/new" element={<Navigate to="/?new=1" replace />} />}
        {role === Role.OPERATOR && <Route path="/cases/:id/edit" element={<CaseForm />} />}
        <Route path="/cases/:id" element={<CaseView />} />
        <Route path="/calculator" element={<CreditCalculator />} />
        <Route path="/chats" element={<ChatsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        {role === Role.ADMIN && <Route path="/branches" element={<BranchesPage />} />}
        {role === Role.ADMIN && <Route path="/users" element={<UsersPage />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

function Gate({ role, title }: { role: Role; title: string }) {
  const { loading } = useAuth();
  const [splashDone, setSplashDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSplashDone(true), 1600);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <AnimatePresence>
        {(!splashDone || loading) && <Splash title={title} subtitle={`${ROLE_LABEL[role]} portali`} />}
      </AnimatePresence>
      {splashDone && !loading && <Shell role={role} title={title} />}
    </>
  );
}

export function RoleApp({ role, title }: { role: Role; title: string }) {
  return (
    <ThemeProvider>
      <I18nProvider>
        <ToastProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <BrowserRouter>
                <Gate role={role} title={title} />
              </BrowserRouter>
            </AuthProvider>
          </QueryClientProvider>
        </ToastProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
