import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserAdd, Plus, Eye, EyeOff, Copy as CopyIcon, User as UserIcon, Pencil, Lock, Check, Hashtag, ShieldCheck, Building } from '../lib/icons';
import { api, userAvatarUrl } from '@credit-core/api-client';
import { Role, ROLE_LABEL } from '@credit-core/shared';
import { Button, Field, Input, PasswordInput } from '../components/primitives';
import { Select } from '../components/forms';
import { Modal, ConfirmDialog } from '../components/Modal';
import { useToast } from '../components/Toast';
import { DataTable, type Column } from '../components/DataTable';
import { useAuth } from '../lib/auth';

const ROLES: Role[] = [Role.OPERATOR, Role.MODERATOR, Role.DIRECTOR, Role.ADMIN];
const roleTone: Record<Role, string> = {
  [Role.OPERATOR]: 'bg-brand-600', [Role.MODERATOR]: 'bg-warning-600', [Role.DIRECTOR]: 'bg-violet-600', [Role.ADMIN]: 'bg-navy-800',
};
const initials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

interface UserRow { id: string; fullName: string; login: string; role: Role; isActive: boolean; plainPassword?: string | null; avatarPath?: string | null; branchId?: string | null; branch?: { name: string } | null }

function Avatar({ u, size = 'h-9 w-9' }: { u: UserRow; size?: string }) {
  if (u.avatarPath) return <img src={userAvatarUrl(u.id)} alt={u.fullName} className={`${size} shrink-0 rounded-full object-cover`} />;
  return <span className={`${size} flex shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${roleTone[u.role]}`}>{initials(u.fullName)}</span>;
}

function CopyBtn({ value, label }: { value: string; label: string }) {
  const toast = useToast();
  return (
    <button onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(value); toast.success('Nusxalandi', `${label}: ${value}`); }}
      className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-ink dark:hover:bg-white/10 dark:hover:text-slate-100" aria-label="Nusxalash">
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

type FormState = { fullName: string; login: string; password: string; role: Role; branchId: string };
const emptyForm: FormState = { fullName: '', login: '', password: '', role: Role.OPERATOR, branchId: '' };

export function UsersPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { user: me } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [modal, setModal] = useState<null | { mode: 'create' } | { mode: 'edit'; id: string }>(null);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [blockTarget, setBlockTarget] = useState<UserRow | null>(null);

  const { data: allUsers } = useQuery({ queryKey: ['users'], queryFn: () => api.users() as Promise<UserRow[]> });
  const { data: branches } = useQuery({ queryKey: ['branches'], queryFn: () => api.branches() });
  // Admin o'zini ro'yxatda ko'rmasin (o'zini bloklash/tahrirlash chalkashligini oldini oladi).
  const users = allUsers?.filter((u) => u.id !== me?.id);

  const close = () => { setModal(null); setForm(emptyForm); setAvatar(null); };
  const refresh = () => qc.invalidateQueries({ queryKey: ['users'] });

  const openCreate = () => { setForm(emptyForm); setAvatar(null); setModal({ mode: 'create' }); };
  const openEdit = (u: UserRow) => {
    setForm({ fullName: u.fullName, login: u.login, password: '', role: u.role, branchId: u.branchId ?? '' });
    setAvatar(null);
    setModal({ mode: 'edit', id: u.id });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (modal?.mode === 'edit') {
        const updated = await api.updateUser(modal.id, {
          fullName: form.fullName, role: form.role, branchId: form.branchId,
          password: form.password || undefined,
        });
        if (avatar) await api.uploadUserAvatar(modal.id, avatar);
        return updated;
      }
      const created = await api.createUser({ ...form, branchId: form.branchId || undefined });
      if (avatar && created?.id) await api.uploadUserAvatar(created.id, avatar);
      return created;
    },
    onSuccess: () => {
      refresh();
      toast.success(modal?.mode === 'edit' ? 'Saqlandi' : 'Foydalanuvchi qo‘shildi', form.fullName);
      close();
    },
    onError: () => toast.error('Xatolik', 'Saqlanmadi'),
  });

  const toggleBlock = useMutation({
    mutationFn: (u: UserRow) => api.updateUser(u.id, { isActive: !u.isActive }),
    onSuccess: (_d, u) => { refresh(); toast.success(u.isActive ? 'Bloklandi' : 'Faollashtirildi', u.fullName); setBlockTarget(null); },
    onError: () => toast.error('Xatolik', 'Bajarilmadi'),
  });

  const columns: Column<UserRow>[] = [
    { key: 'fullName', header: 'F.I.O', render: (x) => (
      <span className="flex items-center gap-2.5">
        <Avatar u={x} />
        <span className="font-medium">{x.fullName}{!x.isActive && <span className="ml-1.5 rounded bg-danger-50 px-1.5 py-0.5 text-[10px] font-semibold text-danger-600 dark:bg-danger-600/15">bloklangan</span>}</span>
      </span>
    ) },
    { key: 'login', header: 'Login', render: (x) => <span className="inline-flex items-center gap-1.5 text-muted">@{x.login}<CopyBtn value={x.login} label="Login" /></span> },
    { key: 'password', header: 'Parol', render: (x) => <PasswordCell value={x.plainPassword} /> },
    { key: 'role', header: 'Rol', render: (x) => <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-white/10">{ROLE_LABEL[x.role]}</span> },
    { key: 'branch', header: 'Filial', render: (x) => x.branch?.name ?? '—' },
    { key: 'actions', header: 'Amallar', align: 'right', render: (x) => (
      <span className="inline-flex items-center justify-end gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(x); }} className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-white/10" title="Tahrirlash"><Pencil className="h-4 w-4" /></button>
        <button onClick={(e) => { e.stopPropagation(); setBlockTarget(x); }}
          className={`rounded-lg p-1.5 transition ${x.isActive ? 'text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-600/15' : 'text-success-600 hover:bg-success-50 dark:hover:bg-success-600/15'}`}
          title={x.isActive ? 'Bloklash' : 'Faollashtirish'}>
          {x.isActive ? <Lock className="h-4 w-4" /> : <Check className="h-4 w-4" />}
        </button>
      </span>
    ) },
  ];

  const isEdit = modal?.mode === 'edit';
  const invalid = !form.fullName || !form.login || (!isEdit && form.password.length < 4) || (isEdit && form.password.length > 0 && form.password.length < 4);
  const previewRow: UserRow = { id: 'preview', fullName: form.fullName || '?', login: form.login, role: form.role, isActive: true };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-800 text-white"><UserAdd className="h-5 w-5" /></span>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Foydalanuvchilar</h1>
          <p className="text-sm text-muted">Boshqaruv: qo‘shish, tahrirlash, bloklash, parol</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4" /> Yangi foydalanuvchi</Button>
      </div>

      <DataTable columns={columns} rows={users ?? []} searchable searchFields={['fullName', 'login']} empty="Foydalanuvchi yo‘q" />

      <Modal
        open={!!modal}
        onClose={close}
        title={isEdit ? 'Foydalanuvchini tahrirlash' : 'Yangi foydalanuvchi'}
        description={isEdit ? 'Maʼlumot, rol va parolni yangilash' : 'Tizimga yangi xodim qo‘shish'}
        footer={
          <>
            <Button variant="secondary" onClick={close}>Bekor qilish</Button>
            <Button loading={save.isPending} disabled={invalid} onClick={() => save.mutate()}>
              {!save.isPending && <Check className="h-4 w-4" />} Saqlash
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            {avatar ? <img src={URL.createObjectURL(avatar)} alt="avatar" className="h-16 w-16 rounded-2xl object-cover" />
              : <Avatar u={isEdit ? (users?.find((x) => x.id === (modal as any).id) ?? previewRow) : previewRow} size="h-16 w-16 rounded-2xl" />}
            <div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => setAvatar(e.target.files?.[0] ?? null)} />
              <Button variant="secondary" onClick={() => fileRef.current?.click()}><UserIcon className="h-4 w-4" /> Rasm tanlash</Button>
              {avatar && <button className="ml-2 text-xs text-muted hover:text-danger-600" onClick={() => setAvatar(null)}>olib tashlash</button>}
            </div>
          </div>
          <Field label="F.I.O" required icon={UserIcon}><Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} autoFocus /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Login" required icon={Hashtag} hint={isEdit ? 'login o‘zgartirilmaydi' : undefined}>
              <Input value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} disabled={isEdit} />
            </Field>
            <Field label={isEdit ? 'Yangi parol' : 'Parol'} required={!isEdit} icon={Lock} hint={isEdit ? 'bo‘sh qoldirsangiz — o‘zgarmaydi' : 'kamida 4 belgi'}>
              <PasswordInput value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={isEdit ? '••••••' : ''} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Rol" icon={ShieldCheck}>
              <Select value={form.role} onChange={(v) => setForm({ ...form, role: v })} options={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))} />
            </Field>
            <Field label="Filial" icon={Building}>
              <Select<string> value={form.branchId} onChange={(v) => setForm({ ...form, branchId: v })} placeholder="— markaziy —"
                options={[{ value: '', label: '— markaziy —' }, ...(branches ?? []).map((br) => ({ value: br.id, label: br.name }))]} />
            </Field>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!blockTarget}
        onClose={() => setBlockTarget(null)}
        onConfirm={() => blockTarget && toggleBlock.mutate(blockTarget)}
        title={blockTarget?.isActive ? 'Foydalanuvchini bloklash?' : 'Foydalanuvchini faollashtirish?'}
        message={blockTarget ? `${blockTarget.fullName} — ${blockTarget.isActive ? 'tizimga kira olmaydi' : 'qaytadan kira oladi'}.` : ''}
        confirmLabel={blockTarget?.isActive ? 'Bloklash' : 'Faollashtirish'}
        tone={blockTarget?.isActive ? 'danger' : 'primary'}
        loading={toggleBlock.isPending}
      />
    </div>
  );
}
