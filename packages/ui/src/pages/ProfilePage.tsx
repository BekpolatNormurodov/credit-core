import { User, ShieldCheck, Building, Phone, LogOut, Sun, Moon, Globe } from '../lib/icons';
import { ROLE_LABEL } from '@credit-core/shared';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import { useI18n } from '../lib/i18n';
import { Button, Card } from '../components/primitives';
import { ConfirmDialog } from '../components/Modal';
import { useState } from 'react';

function Row({ icon: Icon, label, value }: { icon: any; label: string; value?: string | null }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
        <p className="truncate font-medium text-ink dark:text-slate-100">{value || '—'}</p>
      </div>
    </div>
  );
}

export function ProfilePage() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const { lang, setLang } = useI18n();
  const [confirm, setConfirm] = useState(false);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Profil</h1>

      <Card className="overflow-hidden p-0">
        <div className="flex items-center gap-4 bg-navy-900 p-6 text-white">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 text-2xl font-bold">
            {(user?.fullName ?? '?').slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-bold">{user?.fullName}</p>
            <p className="text-sm text-slate-300">{user ? ROLE_LABEL[user.role] : ''}</p>
          </div>
        </div>
        <div className="divide-y divide-slate-100 px-6 dark:divide-white/10">
          <Row icon={User} label="Login" value={(user as any)?.login} />
          <Row icon={ShieldCheck} label="Rol" value={user ? ROLE_LABEL[user.role] : ''} />
          <Row icon={Building} label="Filial" value={user?.branch?.name ?? 'Markaziy apparat'} />
          <Row icon={Phone} label="Telefon" value={(user as any)?.phone} />
        </div>
      </Card>

      <Card className="space-y-1">
        <h2 className="mb-2 font-semibold">Sozlamalar</h2>
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300">
              {theme === 'dark' ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
            </span>
            <p className="font-medium">Mavzu</p>
          </div>
          <Button variant="secondary" onClick={toggle}>{theme === 'dark' ? 'Tungi' : 'Kunduzgi'}</Button>
        </div>
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300">
              <Globe className="h-[18px] w-[18px]" />
            </span>
            <p className="font-medium">Til</p>
          </div>
          <Button variant="secondary" onClick={() => setLang(lang === 'uz' ? 'ru' : 'uz')}>{lang === 'uz' ? "O'zbekcha" : 'Русский'}</Button>
        </div>
      </Card>

      <Button variant="danger" className="w-full sm:w-auto" onClick={() => setConfirm(true)}>
        <LogOut className="h-4 w-4" /> Tizimdan chiqish
      </Button>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={logout}
        title="Tizimdan chiqasizmi?"
        message="Joriy sessiya yakunlanadi va qaytadan login qilishingiz kerak bo'ladi."
        confirmLabel="Chiqish"
      />
    </div>
  );
}
