import { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { LogIn } from '../lib/icons';
import { Role, ROLE_LABEL } from '@credit-core/shared';
import { getErrorMessage } from '@credit-core/api-client';
import { useAuth } from '../lib/auth';
import { Button, Input, Field, PasswordInput } from './primitives';
import { LangSwitch, ThemeSwitch } from './Switches';
import { LogoMark } from './Logo';
import { SplineScene } from './SplineScene';

const SPLINE_SCENE = 'https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode';

export function LoginPage({ role, title }: { role: Role; title: string }) {
  const { login } = useAuth();
  const [loginName, setLoginName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Cursor-following glow on the 3D panel.
  const stageRef = useRef<HTMLDivElement>(null);
  const [glowOn, setGlowOn] = useState(false);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const gx = useSpring(mx, { stiffness: 150, damping: 22, mass: 0.4 });
  const gy = useSpring(my, { stiffness: 150, damping: 22, mass: 0.4 });

  const onMove = (e: React.MouseEvent) => {
    const r = stageRef.current?.getBoundingClientRect();
    if (!r) return;
    mx.set(e.clientX - r.left);
    my.set(e.clientY - r.top);
  };

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
    <div className="relative min-h-screen bg-canvas dark:bg-gray-950 lg:grid lg:grid-cols-2">
      {/* Top-right controls */}
      <div className="absolute right-4 top-4 z-30 flex items-center gap-2.5">
        <LangSwitch />
        <ThemeSwitch />
      </div>

      {/* Left: interactive 3D brand panel (lg+) */}
      <div
        ref={stageRef}
        onMouseMove={onMove}
        onMouseEnter={() => setGlowOn(true)}
        onMouseLeave={() => setGlowOn(false)}
        className="relative hidden overflow-hidden bg-gray-900 lg:block"
      >
        {/* dotted grid */}
        <div
          className="pointer-events-none absolute inset-0 z-[1] opacity-[0.16]"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.7) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            maskImage: 'radial-gradient(70% 70% at 40% 45%, #000 30%, transparent 80%)',
            WebkitMaskImage: 'radial-gradient(70% 70% at 40% 45%, #000 30%, transparent 80%)',
          }}
        />
        {/* ambient corner glows */}
        <div className="pointer-events-none absolute -right-24 -top-24 z-[1] h-72 w-72 rounded-full bg-brand-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -left-20 z-[1] h-72 w-72 rounded-full bg-brand-700/20 blur-3xl" />

        {/* grounding glow pool under the robot */}
        <div
          className="pointer-events-none absolute bottom-[14%] left-1/2 z-[1] h-28 w-[460px] -translate-x-1/2 blur-2xl"
          style={{
            borderRadius: '50%',
            background: 'radial-gradient(ellipse at center, rgba(56,189,248,0.22), rgba(56,189,248,0) 70%)',
          }}
        />

        {/* 3D scene */}
        <SplineScene scene={SPLINE_SCENE} className="absolute inset-0 z-[2] h-full w-full" />

        {/* cursor-following glow */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute z-[3] h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full mix-blend-screen blur-[42px] transition-opacity duration-300"
          style={{
            left: gx,
            top: gy,
            opacity: glowOn ? 1 : 0,
            background: 'radial-gradient(circle, rgba(56,189,248,0.55), rgba(14,165,233,0) 60%)',
          }}
        />

        {/* centered logo lockup */}
        <div className="absolute left-1/2 top-9 z-[4] flex -translate-x-1/2 items-center gap-2.5">
          <LogoMark className="h-9 w-9" />
          <span className="font-heading text-lg font-semibold tracking-tight text-white">credit-core</span>
        </div>

        {/* tagline */}
        <div className="absolute bottom-12 left-10 right-10 z-[4]">
          <h2 className="font-heading text-2xl font-semibold text-white">Garov kreditlari — yagona panelda.</h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-gray-300">
            Arizalar, moderatsiya, tahlil va hisobotlar — bitta xavfsiz boshqaruv tizimida.
          </p>
        </div>
      </div>

      {/* Right: form */}
      <div className="flex min-h-screen items-center justify-center p-6 lg:min-h-0">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="w-full max-w-md"
        >
          {/* Mobile logo (panel hidden on small screens) */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <LogoMark className="h-12 w-12" />
            <div>
              <h1 className="text-xl font-bold text-gray-800 dark:text-white">{title}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{ROLE_LABEL[role]} portali</p>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Tizimga kirish</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {ROLE_LABEL[role]} portali — login va parolingizni kiriting.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <Field label="Login">
              <Input name="username" autoComplete="username" value={loginName} onChange={(e) => setLoginName(e.target.value)} placeholder="login" autoFocus />
            </Field>
            <Field label="Parol">
              <PasswordInput name="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
            </Field>
            {error && (
              <p role="alert" className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-sm text-error-600 dark:border-error-500/30 dark:bg-error-500/12 dark:text-error-400">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" loading={loading}>
              {!loading && <LogIn className="h-4 w-4" />}
              {loading ? 'Kirilmoqda…' : 'Kirish'}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-gray-500 dark:text-gray-400">credit-core • garov tizimi</p>
        </motion.div>
      </div>
    </div>
  );
}
