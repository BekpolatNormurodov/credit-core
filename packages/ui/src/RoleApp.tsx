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
import { FilePlus2, LayoutGrid, Settings } from 'lucide-react';
import { Role, ROLE_LABEL } from '@credit-core/shared';
import { AuthProvider, useAuth } from './lib/auth';
import { Splash } from './components/Splash';
import { LoginPage } from './components/LoginPage';
import { AppShell, type NavItem } from './components/AppShell';
import { Button } from './components/primitives';
import { Dashboard } from './pages/Dashboard';
import { CaseForm } from './pages/CaseForm';
import { CaseView } from './pages/CaseView';
import { AdminPage } from './pages/AdminPage';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });

function navFor(role: Role): NavItem[] {
  const base: NavItem[] = [{ to: '/', label: 'Ishlar', icon: LayoutGrid }];
  if (role === Role.OPERATOR) base.push({ to: '/cases/new', label: 'Yangi ish', icon: FilePlus2 });
  if (role === Role.ADMIN) base.push({ to: '/admin', label: 'Boshqaruv', icon: Settings });
  return base;
}

function Shell({ role, title }: { role: Role; title: string }) {
  const { user, logout } = useAuth();

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
    <AppShell title={title} nav={navFor(role)}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        {role === Role.OPERATOR && <Route path="/cases/new" element={<CaseForm />} />}
        {role === Role.OPERATOR && <Route path="/cases/:id/edit" element={<CaseForm />} />}
        <Route path="/cases/:id" element={<CaseView />} />
        {role === Role.ADMIN && <Route path="/admin" element={<AdminPage />} />}
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
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Gate role={role} title={title} />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
