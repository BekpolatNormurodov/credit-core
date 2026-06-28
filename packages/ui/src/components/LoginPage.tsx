import { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, LogIn } from 'lucide-react';
import { Role, ROLE_LABEL } from '@credit-core/shared';
import { useAuth } from '../lib/auth';
import { Button, Input, Field } from './primitives';

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
    } catch {
      setError('Login yoki parol noto‘g‘ri');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-brand-50 p-4">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-soft"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{title}</h1>
            <p className="text-sm text-slate-500">{ROLE_LABEL[role]} portali</p>
          </div>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Login">
            <Input value={loginName} onChange={(e) => setLoginName(e.target.value)} placeholder="login" autoFocus />
          </Field>
          <Field label="Parol">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
          </Field>
          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            <LogIn className="h-4 w-4" />
            {loading ? 'Kirilmoqda…' : 'Kirish'}
          </Button>
        </form>
        <p className="mt-6 text-center text-xs text-slate-400">credit-core • garov tizimi</p>
      </motion.div>
    </div>
  );
}
