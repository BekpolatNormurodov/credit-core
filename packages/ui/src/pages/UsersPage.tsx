import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserAdd, Plus, Eye, EyeOff, Copy as CopyIcon, User as UserIcon } from '../lib/icons';
import { api, userAvatarUrl } from '@credit-core/api-client';
import { Role, ROLE_LABEL } from '@credit-core/shared';
import { Button, Field, Input, PasswordInput } from '../components/primitives';
import { Select } from '../components/forms';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { DataTable, type Column } from '../components/DataTable';

const ROLES: Role[] = [Role.OPERATOR, Role.MODERATOR, Role.DIRECTOR, Role.ADMIN];
const empty = { fullName: '', login: '', password: '', role: Role.OPERATOR as Role, branchId: '' };
const roleTone: Record<Role, string> = {
  [Role.OPERATOR]: 'bg-brand-600', [Role.MODERATOR]: 'bg-warning-600', [Role.DIRECTOR]: 'bg-violet-600', [Role.ADMIN]: 'bg-navy-800',
};
const initials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

interface UserRow { id: string; fullName: string; login: string; role: Role; isActive: boolean; plainPassword?: string | null; avatarPath?: string | null; branch?: { name: string } | null }

function Avatar({ u, size = 'h-9 w-9' }: { u: UserRow; size?: string }) {
  if (u.avatarPath) return <img src={userAvatarUrl(u.id)} alt={u.fullName} className={`${size} shrink-0 rounded-full object-cover`} />;
  return <span className={`${size} flex shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${roleTone[u.role]}`}>{initials(u.fullName)}</span>;
}

function CopyBtn({ value, label }: { value: string; label: string }) {
  const toast = useToast();
  return (
    <button
      onClick={() => { navigator.clipboard?.writeText(value); toast.success('Nusxalandi', `${label}: ${value}`); }}
      className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-ink dark:hover:bg-white/10 dark:hover:text-slate-100"
      aria-label="Nusxalash"
    >
      <CopyIcon className="h-3.5 w-3.5" />
    </button>
  );
}

function PasswordCell({ value }: { value?: string | null }) {
  const [show, setShow] = useState(false);
  if (!value) return <span className="text-slate-400">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="nums">{show ? value : '••••••'}</span>
      <button onClick={() => setShow((s) => !s)} className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-ink dark:hover:bg-white/10 dark:hover:text-slate-100" aria-label="Ko‘rsatish">
        {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
      <CopyBtn value={value} label="Parol" />
    </span>
  );
}

export function UsersPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [avatar, setAvatar] = useState<File | null>(null);
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => api.users() as Promise<UserRow[]> });
  const { data: branches } = useQuery({ queryKey: ['branches'], queryFn: () => api.branches() });
  const [u, setU] = useState(empty);

  const reset = () => { setU(empty); setAvatar(null); };

  const create = useMutation({
    mutationFn: async () => {
      const created = await api.createUser({ ...u, branchId: u.branchId || undefined });
      if (avatar && created?.id) await api.uploadUserAvatar(created.id, avatar);
      return created;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Foydalanuvchi qo‘shildi', u.fullName);
      reset();
      setOpen(false);
    },
    onError: () => toast.error('Xatolik', 'Foydalanuvchi qo‘shilmadi'),
  });

  const columns: Column<UserRow>[] = [
    { key: 'fullName', header: 'F.I.O', render: (x) => <span className="flex items-center gap-2.5"><Avatar u={x} /><span className="font-medium">{x.fullName}</span></span> },
    { key: 'login', header: 'Login', render: (x) => <span className="inline-flex items-center gap-1.5 text-muted">@{x.login}<CopyBtn value={x.login} label="Login" /></span> },
    { key: 'password', header: 'Parol', render: (x) => <PasswordCell value={x.plainPassword} /> },
    { key: 'role', header: 'Rol', render: (x) => <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-white/10">{ROLE_LABEL[x.role]}</span> },
    { key: 'branch', header: 'Filial', render: (x) => x.branch?.name ?? '—' },
    { key: 'isActive', header: 'Holat', render: (x) => x.isActive ? <span className="text-success-700 dark:text-success-400">Faol</span> : <span className="text-slate-400">Nofaol</span> },
  ];

  const invalid = !u.fullName || !u.login || u.password.length < 4;
  const previewRow: UserRow = { id: 'preview', fullName: u.fullName || '?', login: u.login, role: u.role, isActive: true };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-800 text-white"><UserAdd className="h-5 w-5" /></span>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Foydalanuvchilar</h1>
          <p className="text-sm text-muted">Tizim foydalanuvchilari, rollari va loginlari</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Yangi foydalanuvchi</Button>
      </div>

      <DataTable columns={columns} rows={users ?? []} searchable searchFields={['fullName', 'login']} empty="Foydalanuvchi yo‘q" />

      <Modal
        open={open}
        onClose={() => { setOpen(false); reset(); }}
        title="Yangi foydalanuvchi"
        description="Tizimga yangi xodim qo‘shish"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setOpen(false); reset(); }}>Bekor qilish</Button>
            <Button loading={create.isPending} disabled={invalid} onClick={() => create.mutate()}>
              {!create.isPending && <UserAdd className="h-4 w-4" />} Qo‘shish
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            {avatar ? (
              <img src={URL.createObjectURL(avatar)} alt="avatar" className="h-16 w-16 rounded-2xl object-cover" />
            ) : (
              <Avatar u={previewRow} size="h-16 w-16 rounded-2xl" />
            )}
            <div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => setAvatar(e.target.files?.[0] ?? null)} />
              <Button variant="secondary" onClick={() => fileRef.current?.click()}><UserIcon className="h-4 w-4" /> Rasm tanlash</Button>
              {avatar && <button className="ml-2 text-xs text-muted hover:text-danger-600" onClick={() => setAvatar(null)}>olib tashlash</button>}
            </div>
          </div>
          <Field label="F.I.O" required><Input value={u.fullName} onChange={(e) => setU({ ...u, fullName: e.target.value })} autoFocus /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Login" required><Input value={u.login} onChange={(e) => setU({ ...u, login: e.target.value })} /></Field>
            <Field label="Parol" required hint="kamida 4 belgi"><PasswordInput value={u.password} onChange={(e) => setU({ ...u, password: e.target.value })} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Rol">
              <Select value={u.role} onChange={(v) => setU({ ...u, role: v })} options={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))} />
            </Field>
            <Field label="Filial">
              <Select<string> value={u.branchId} onChange={(v) => setU({ ...u, branchId: v })} placeholder="— markaziy —"
                options={[{ value: '', label: '— markaziy —' }, ...(branches ?? []).map((br) => ({ value: br.id, label: br.name }))]} />
            </Field>
          </div>
        </div>
      </Modal>
    </div>
  );
}
