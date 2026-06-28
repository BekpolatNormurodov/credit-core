import { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, LogIn } from '../lib/icons';
import { Role, ROLE_LABEL } from '@credit-core/shared';
import { getErrorMessage } from '@credit-core/api-client';
import { useAuth } from '../lib/auth';
import { Button, Input, Field, PasswordInput } from './primitives';
import { LangSwitch, ThemeSwitch } from './Switches';

export function LoginPage({ role, title }: { role: Role; title: string }) {
  const { login } = useAuth();
  const [loginName, setLoginName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await login(loginName, password);
      if (user.role !== role) {
        setError(`Bu portal faqat "${ROLE_LABEL[role]}" uchun. Sizning rolingiz: ${ROLE_LABEL[user.role]}`);
      }
    } catch (err) {
      setError(getErrorMessage(err, { unauthorized: 'Login yoki parol noto‘g‘ri' }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-canvas dark:bg-navy-900 lg:grid lg:grid-cols-2">
      {/* Top-right controls */}
      <div className="absolute right-4 top-4 z-20 flex items-center gap-2.5">
        <LangSwitch />
        <ThemeSwitch />
      </div>

      {/* Left: form */}
      <div className="flex min-h-screen items-center justify-center p-6 lg:min-h-0">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="w-full max-w-md"
        >
          {/* Mobile logo (panel hidden on small screens) */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-navy-800 text-white dark:bg-brand-600">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-ink dark:text-white">{title}</h1>
              <p className="text-sm text-muted dark:text-slate-400">{ROLE_LABEL[role]} portali</p>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-bold text-ink dark:text-white">Tizimga kirish</h2>
            <p className="mt-1 text-sm text-muted dark:text-slate-400">
              {ROLE_LABEL[role]} portali — login va parolingizni kiriting.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <Field label="Login">
              <Input value={loginName} onChange={(e) => setLoginName(e.target.value)} placeholder="login" autoFocus />
            </Field>
            <Field label="Parol">
              <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
            </Field>
            {error && (
              <p role="alert" className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700 dark:bg-danger-600/15 dark:text-danger-400">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" loading={loading}>
              {!loading && <LogIn className="h-4 w-4" />}
              {loading ? 'Kirilmoqda…' : 'Kirish'}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-400">credit-core • garov tizimi</p>
        </motion.div>
      </div>

      {/* Right: brand panel (lg+) */}
      <div className="relative hidden overflow-hidden bg-navy-900 lg:flex lg:items-center lg:justify-center">
        {/* dotted grid pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        />
        {/* glow */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-500/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-brand-700/20 blur-3xl" />

        <div className="relative z-10 max-w-sm px-10 text-center text-white">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500/90 shadow-soft">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            Garov kreditlari uchun yagona boshqaruv tizimi. Arizalar, moderatsiya,
            tahlil va hisobotlar — bitta xavfsiz panelda.
          </p>
        </div>
      </div>
    </div>
  );
}
