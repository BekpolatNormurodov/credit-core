import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, UserPlus } from '../lib/icons';
import { api } from '@credit-core/api-client';
import { Role, ROLE_LABEL } from '@credit-core/shared';
import { Button, Card, Field, Input } from '../components/primitives';

const ROLES: Role[] = [Role.OPERATOR, Role.MODERATOR, Role.DIRECTOR, Role.ADMIN];

export function AdminPage() {
  const qc = useQueryClient();
  const { data: branches } = useQuery({ queryKey: ['branches'], queryFn: () => api.branches() });
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => api.users() });

  const [branch, setBranch] = useState({ name: '', symbol: '', region: '' });
  const [user, setUser] = useState({ fullName: '', login: '', password: '', role: Role.OPERATOR as Role, branchId: '' });

  const createBranch = useMutation({
    mutationFn: () => api.createBranch({ name: branch.name, symbol: branch.symbol, region: branch.region || undefined }),
    onSuccess: () => { setBranch({ name: '', symbol: '', region: '' }); qc.invalidateQueries({ queryKey: ['branches'] }); },
  });
  const createUser = useMutation({
    mutationFn: () => api.createUser({ ...user, branchId: user.branchId || undefined }),
    onSuccess: () => { setUser({ fullName: '', login: '', password: '', role: Role.OPERATOR, branchId: '' }); qc.invalidateQueries({ queryKey: ['users'] }); },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Boshqaruv</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Branches */}
        <Card className="space-y-4">
          <h2 className="flex items-center gap-2 font-semibold"><Building2 className="h-4 w-4" /> Filiallar</h2>
          <div className="space-y-2">
            {branches?.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2">
                <span className="text-sm font-medium">{b.name}</span>
                <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700">{b.symbol}</span>
              </div>
            ))}
          </div>
          <div className="space-y-2 border-t border-slate-100 pt-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Nomi" required><Input value={branch.name} onChange={(e) => setBranch({ ...branch, name: e.target.value })} placeholder="Toshkent filiali" /></Field>
              <Field label="Simvol" required><Input value={branch.symbol} onChange={(e) => setBranch({ ...branch, symbol: e.target.value.toUpperCase() })} placeholder="TK" /></Field>
            </div>
            <Field label="Hudud"><Input value={branch.region} onChange={(e) => setBranch({ ...branch, region: e.target.value })} placeholder="Toshkent" /></Field>
            <Button className="w-full" loading={createBranch.isPending} disabled={!branch.name || !branch.symbol} onClick={() => createBranch.mutate()}>
              {!createBranch.isPending && <Plus className="h-4 w-4" />} Filial qo‘shish
            </Button>
          </div>
        </Card>

        {/* Users */}
        <Card className="space-y-4">
          <h2 className="flex items-center gap-2 font-semibold"><UserPlus className="h-4 w-4" /> Foydalanuvchilar</h2>
          <div className="max-h-40 space-y-2 overflow-y-auto">
            {users?.map((u: any) => (
              <div key={u.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2">
                <span className="text-sm"><span className="font-medium">{u.fullName}</span> <span className="text-slate-400">@{u.login}</span></span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{ROLE_LABEL[u.role as Role]}</span>
              </div>
            ))}
          </div>
          <div className="space-y-2 border-t border-slate-100 pt-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label="F.I.O" required><Input value={user.fullName} onChange={(e) => setUser({ ...user, fullName: e.target.value })} /></Field>
              <Field label="Login" required><Input value={user.login} onChange={(e) => setUser({ ...user, login: e.target.value })} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Parol" required><Input type="password" value={user.password} onChange={(e) => setUser({ ...user, password: e.target.value })} /></Field>
              <Field label="Rol">
                <select className="w-full rounded-xl border border-hairline px-3 py-2.5 text-sm" value={user.role} onChange={(e) => setUser({ ...user, role: e.target.value as Role })}>
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Filial">
              <select className="w-full rounded-xl border border-hairline px-3 py-2.5 text-sm" value={user.branchId} onChange={(e) => setUser({ ...user, branchId: e.target.value })}>
                <option value="">— yo‘q (markaziy) —</option>
                {branches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
            <Button className="w-full" loading={createUser.isPending} disabled={!user.fullName || !user.login || user.password.length < 4} onClick={() => createUser.mutate()}>
              {!createUser.isPending && <UserPlus className="h-4 w-4" />} Foydalanuvchi qo‘shish
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
