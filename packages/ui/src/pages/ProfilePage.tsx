import { useRef, useState } from 'react';
import { User, ShieldCheck, Building, Phone, LogOut, Camera, Save, Volume, VolumeOff } from '../lib/icons';
import { ROLE_LABEL } from '@credit-core/shared';
import { api, userAvatarUrl } from '@credit-core/api-client';
import { useAuth } from '../lib/auth';
import { Button, Card, Field, Input } from '../components/primitives';
import { PhoneInput } from '../components/forms';
import { Toggle } from '../components/Switches';
import { ConfirmDialog } from '../components/Modal';
import { useToast } from '../components/Toast';
import { playPing, setSoundEnabled, soundEnabled } from '../lib/sound';

function Row({ icon: Icon, label, value }: { icon: any; label: string; value?: string | null }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-300">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
        <p className="truncate font-medium text-gray-800 dark:text-gray-100">{value || '—'}</p>
      </div>
    </div>
  );
}

export function ProfilePage() {
  const { user, logout, setUser } = useAuth();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState(false);
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarVer, setAvatarVer] = useState(0);
  const [sound, setSound] = useState(soundEnabled());

  if (!user) return null;
  const dirty = fullName !== (user.fullName ?? '') || (phone ?? '') !== (user.phone ?? '');

  const save = async () => {
    setSaving(true);
    try {
      const updated = await api.updateProfile({ fullName, phone });
      setUser(updated);
      toast.success('Profil saqlandi');
    } catch {
      toast.error('Xatolik', 'Profil saqlanmadi');
    } finally {
      setSaving(false);
    }
  };

  const onPickAvatar = async (file: File) => {
    setUploading(true);
    try {
      const updated = await api.uploadMyAvatar(file);
      setUser(updated);
      setAvatarVer((v) => v + 1);
      toast.success('Rasm yangilandi');
    } catch {
      toast.error('Xatolik', 'Rasm yuklanmadi');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Profil</h1>

      <Card className="overflow-hidden p-0">
        <div className="flex items-center gap-4 bg-gray-900 p-6 text-white">
          <div className="relative shrink-0">
            {user.hasAvatar ? (
              <img src={`${userAvatarUrl(user.id)}&v=${avatarVer}`} alt={user.fullName} className="h-20 w-20 rounded-2xl object-cover" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-700 text-2xl font-bold">
                {(user.fullName ?? '?').slice(0, 1).toUpperCase()}
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onPickAvatar(e.target.files[0])} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              aria-label="Rasmni o‘zgartirish"
              className="absolute -bottom-1.5 -right-1.5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-gray-900 bg-brand-700 text-white shadow-theme-sm outline-none transition hover:bg-brand-800 focus-visible:ring-2 focus-visible:ring-brand-600/30 disabled:opacity-60"
            >
              {uploading ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Camera className="h-4 w-4" />}
            </button>
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-bold">{user.fullName}</p>
            <p className="text-sm text-gray-300">{ROLE_LABEL[user.role]} · @{user.login}</p>
          </div>
        </div>

        <div className="space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="F.I.O" icon={User}><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></Field>
            <Field label="Telefon" icon={Phone}><PhoneInput value={phone} onChange={setPhone} /></Field>
          </div>
          <div className="flex justify-end">
            <Button onClick={save} loading={saving} disabled={!dirty || !fullName}>
              {!saving && <Save className="h-4 w-4" />} Saqlash
            </Button>
          </div>
        </div>

        <div className="divide-y divide-gray-100 px-6 pb-2 dark:divide-gray-800">
          <Row icon={ShieldCheck} label="Rol" value={ROLE_LABEL[user.role]} />
          <Row icon={Building} label="Filial" value={user.branch?.name ?? 'Markaziy apparat'} />
        </div>
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold text-gray-800 dark:text-white">Bildirishnomalar</h2>
        <div className="flex items-center justify-between gap-4 py-2">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-300">
              {sound ? <Volume className="h-[18px] w-[18px]" /> : <VolumeOff className="h-[18px] w-[18px]" />}
            </span>
            <div className="min-w-0">
              <p className="font-medium text-gray-800 dark:text-gray-100">Bildirishnoma ovozi</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Yangi xabar yoki bildirishnoma kelganda ovoz chalinadi</p>
            </div>
          </div>
          <Toggle
            checked={sound}
            onChange={(v) => { setSound(v); setSoundEnabled(v); if (v) playPing(); }}
            label="Bildirishnoma ovozi"
          />
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
