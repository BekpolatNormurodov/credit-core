import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building, Plus } from '../lib/icons';
import { api } from '@credit-core/api-client';
import type { BranchDto } from '@credit-core/shared';
import { Button, Field, Input } from '../components/primitives';
import { Select } from '../components/forms';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { DataTable, type Column } from '../components/DataTable';

// O'zbekiston 14 hududi (12 viloyat + Qoraqalpog'iston + Toshkent sh.)
const REGIONS = [
  'Toshkent shahri', 'Toshkent viloyati', 'Andijon', 'Buxoro', "Farg'ona", 'Jizzax',
  'Xorazm', 'Namangan', 'Navoiy', 'Qashqadaryo', 'Samarqand', 'Sirdaryo',
  'Surxondaryo', "Qoraqalpog'iston Respublikasi",
];

const empty = { name: '', symbol: '', region: '' };

export function BranchesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const { data: branches } = useQuery({ queryKey: ['branches'], queryFn: () => api.branches() });
  const [b, setB] = useState(empty);

  const create = useMutation({
    mutationFn: () => api.createBranch({ name: b.name, symbol: b.symbol, region: b.region || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] });
      toast.success('Filial qo‘shildi', b.name);
      setB(empty);
      setOpen(false);
    },
    onError: () => toast.error('Xatolik', 'Filial qo‘shilmadi'),
  });

  const columns: Column<BranchDto>[] = [
    { key: 'name', header: 'Filial', render: (x) => <span className="font-medium">{x.name}</span> },
    { key: 'symbol', header: 'Simvol', render: (x) => <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-600/15 dark:text-brand-300">{x.symbol}</span> },
    { key: 'region', header: 'Hudud', render: (x) => x.region ?? '—' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-800 text-white"><Building className="h-5 w-5" /></span>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Filiallar</h1>
          <p className="text-sm text-muted">Tarmoq filiallari va simvollari</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Yangi filial</Button>
      </div>

      <DataTable columns={columns} rows={branches ?? []} searchable searchFields={['name', 'symbol', 'region']} empty="Filial yo‘q" />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Yangi filial"
        description="Tarmoqqa yangi filial qo‘shish"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Bekor qilish</Button>
            <Button loading={create.isPending} disabled={!b.name || !b.symbol} onClick={() => create.mutate()}>
              {!create.isPending && <Plus className="h-4 w-4" />} Qo‘shish
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Nomi" required><Input value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} placeholder="Toshkent filiali" autoFocus /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Simvol" required hint="qisqa kod, masalan TK"><Input value={b.symbol} onChange={(e) => setB({ ...b, symbol: e.target.value.toUpperCase() })} placeholder="TK" /></Field>
            <Field label="Hudud">
              <Select<string> value={b.region} onChange={(v) => setB({ ...b, region: v })} placeholder="— hududni tanlang —"
                options={REGIONS.map((r) => ({ value: r, label: r }))} />
            </Field>
          </div>
        </div>
      </Modal>
    </div>
  );
}
