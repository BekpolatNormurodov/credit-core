import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building, Plus, Hashtag, Location, People, Pencil, Layers, Banknote } from '../lib/icons';
import { api } from '@credit-core/api-client';
import { Role, type BranchDto } from '@credit-core/shared';
import { Button, Field, Input } from '../components/primitives';
import { Select, MultiSelect } from '../components/forms';
import { MetricCard } from '../components/widgets';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { DataTable, type Column } from '../components/DataTable';
import { formatMoney } from '../lib/cn';

// O'zbekiston 14 hududi (12 viloyat + Qoraqalpog'iston + Toshkent sh.)
const REGIONS = [
  'Toshkent shahri', 'Toshkent viloyati', 'Andijon', 'Buxoro', "Farg'ona", 'Jizzax',
  'Xorazm', 'Namangan', 'Navoiy', 'Qashqadaryo', 'Samarqand', 'Sirdaryo',
  'Surxondaryo', "Qoraqalpog'iston Respublikasi",
];

interface UserRow { id: string; fullName: string; role: Role }
type FormState = { name: string; symbol: string; region: string; moderatorIds: string[] };
const emptyForm: FormState = { name: '', symbol: '', region: '', moderatorIds: [] };

export function BranchesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [modal, setModal] = useState<null | { mode: 'create' } | { mode: 'edit'; id: string }>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const { data: branches } = useQuery({ queryKey: ['branches'], queryFn: () => api.branches() });
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => api.users() as Promise<UserRow[]> });
  const moderators = (users ?? []).filter((u) => u.role === Role.MODERATOR);

  const close = () => { setModal(null); setForm(emptyForm); };
  const openCreate = () => { setForm(emptyForm); setModal({ mode: 'create' }); };
  const openEdit = (b: BranchDto) => {
    setForm({ name: b.name, symbol: b.symbol, region: b.region ?? '', moderatorIds: (b.moderators ?? []).map((m) => m.id) });
    setModal({ mode: 'edit', id: b.id });
  };

  const save = useMutation({
    mutationFn: () => {
      const payload = { name: form.name, symbol: form.symbol, region: form.region || undefined, moderatorIds: form.moderatorIds };
      return modal?.mode === 'edit' ? api.updateBranch(modal.id, payload) : api.createBranch(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] });
      qc.invalidateQueries({ queryKey: ['cases'] });
      toast.success(modal?.mode === 'edit' ? 'Filial saqlandi' : 'Filial qo‘shildi', form.name);
      close();
    },
    onError: () => toast.error('Xatolik', 'Saqlanmadi'),
  });

  const columns: Column<BranchDto>[] = [
    { key: 'name', header: 'Filial', render: (x) => <span className="font-medium text-gray-800 dark:text-white">{x.name}</span> },
    { key: 'symbol', header: 'Simvol', render: (x) => <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">{x.symbol}</span> },
    { key: 'region', header: 'Hudud', render: (x) => x.region ?? '—' },
    { key: 'caseCount', header: 'Arizalar', align: 'right', render: (x) => <span className="nums font-medium text-gray-800 dark:text-gray-100">{x.caseCount ?? 0}</span> },
    { key: 'totalAmount', header: 'Summa', align: 'right', render: (x) => <span className="nums text-gray-700 dark:text-gray-300">{formatMoney(x.totalAmount ?? 0)}</span> },
    { key: 'moderators', header: 'Moderatorlar', render: (x) => (
      x.moderators?.length ? (
        <span className="flex flex-wrap gap-1">
          {x.moderators.map((m) => <span key={m.id} className="rounded-md bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700 dark:bg-white/10 dark:text-gray-300">{m.fullName}</span>)}
        </span>
      ) : <span className="text-gray-400">— biriktirilmagan</span>
    ) },
    { key: 'actions', header: 'Amallar', align: 'right', render: (x) => (
      <button onClick={(e) => { e.stopPropagation(); openEdit(x); }} aria-label="Filialni tahrirlash" title="Tahrirlash" className="rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30 dark:text-gray-400 dark:hover:bg-white/10"><Pencil className="h-[18px] w-[18px]" /></button>
    ) },
  ];

  const isEdit = modal?.mode === 'edit';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400"><Building className="h-5 w-5" /></span>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Filiallar</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Filiallar va ularga biriktirilgan moderatorlar</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-5 w-5" /> Yangi filial</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={Building} label="Jami filial" value={String((branches ?? []).length)} tone="brand" />
        <MetricCard icon={People} label="Moderatorlar" value={String(new Set((branches ?? []).flatMap((b) => (b.moderators ?? []).map((m) => m.id))).size)} tone="success" />
        <MetricCard icon={Layers} label="Jami ariza" value={String((branches ?? []).reduce((s, b) => s + (b.caseCount ?? 0), 0))} tone="warning" />
        <MetricCard icon={Banknote} label="Jami summa" value={formatMoney((branches ?? []).reduce((s, b) => s + (b.totalAmount ?? 0), 0))} tone="danger" />
      </div>

      <DataTable columns={columns} rows={branches ?? []} searchable searchFields={['name', 'symbol', 'region']} empty="Filial yo‘q" />

      <Modal
        open={!!modal}
        onClose={close}
        title={isEdit ? 'Filialni tahrirlash' : 'Yangi filial'}
        description="Filial maʼlumotlari va mas’ul moderator(lar)"
        footer={
          <>
            <Button variant="secondary" onClick={close}>Bekor qilish</Button>
            <Button loading={save.isPending} disabled={!form.name || !form.symbol} onClick={() => save.mutate()}>
              {!save.isPending && <Plus className="h-5 w-5" />} Saqlash
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Nomi" required icon={Building}><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Toshkent filiali" autoFocus /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Simvol" required icon={Hashtag} hint="qisqa kod, masalan TK"><Input value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })} placeholder="TK" /></Field>
            <Field label="Hudud" icon={Location}>
              <Select<string> value={form.region} onChange={(v) => setForm({ ...form, region: v })} placeholder="— hududni tanlang —"
                options={REGIONS.map((r) => ({ value: r, label: r }))} />
            </Field>
          </div>
          <Field label="Mas’ul moderatorlar" icon={People} hint="bir nechta tanlash mumkin — faqat shu moderatorlar, admin va direktor arizalarni ko‘radi">
            <MultiSelect<string> value={form.moderatorIds} onChange={(v) => setForm({ ...form, moderatorIds: v })}
              placeholder="— moderator tanlang —" empty="Moderator yo‘q (avval foydalanuvchi qo‘shing)"
              options={moderators.map((m) => ({ value: m.id, label: m.fullName }))} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
