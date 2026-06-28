import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Paperclip, Search, Send, FileText, Download } from '../lib/icons';
import { api, downloadBlob, viewDocument } from '@credit-core/api-client';
import { Role, ROLE_LABEL } from '@credit-core/shared';
import { Button, Input } from './primitives';
import { cn } from '../lib/cn';

const ROLES: Role[] = [Role.OPERATOR, Role.MODERATOR, Role.DIRECTOR, Role.ADMIN];

export function CaseChat({ caseId }: { caseId: string }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [toRole, setToRole] = useState<Role | ''>('');
  const [search, setSearch] = useState('');
  const [pickedFile, setPickedFile] = useState<File | null>(null);

  const { data: messages } = useQuery({
    queryKey: ['messages', caseId],
    queryFn: () => api.messages(caseId),
    refetchInterval: 8_000,
  });

  const { data: directory } = useQuery({
    queryKey: ['directory', search],
    queryFn: () => api.directory(undefined, search || undefined),
    enabled: search.length > 0,
  });

  const send = useMutation({
    mutationFn: () =>
      api.sendMessage(caseId, { text: text || undefined, toRole: toRole || undefined, file: pickedFile ?? undefined }),
    onSuccess: () => {
      setText('');
      setPickedFile(null);
      qc.invalidateQueries({ queryKey: ['messages', caseId] });
      qc.invalidateQueries({ queryKey: ['unread'] });
    },
  });

  const canSend = (text.trim() || pickedFile) && !send.isPending;

  return (
    <div className="flex h-[28rem] flex-col">
      {/* Directory search */}
      <div className="mb-3 flex items-center gap-2 rounded-xl border border-hairline px-3 py-1.5">
        <Search className="h-4 w-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Xodim qidirish (operator, moderator, direktor…)"
          className="w-full bg-transparent text-sm outline-none"
        />
      </div>
      {search && directory && (
        <div className="mb-3 max-h-28 space-y-1 overflow-y-auto rounded-xl bg-slate-50 p-2">
          {directory.length === 0 && <p className="px-2 text-xs text-slate-400">Topilmadi</p>}
          {directory.map((u) => (
            <button
              key={u.id}
              onClick={() => { setToRole(u.role); setSearch(''); }}
              className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white"
            >
              <span>{u.fullName} <span className="text-slate-400">· {u.branchName ?? '—'}</span></span>
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700">{ROLE_LABEL[u.role]}</span>
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto rounded-xl bg-slate-50 p-3">
        {!messages?.length && <p className="py-8 text-center text-sm text-slate-400">Hali xabarlar yo‘q</p>}
        {messages?.map((m) => (
          <div key={m.id} className={cn('flex', m.mine ? 'justify-end' : 'justify-start')}>
            <div className={cn('max-w-[80%] rounded-2xl px-3 py-2 text-sm', m.mine ? 'bg-brand-600 text-white' : 'bg-white border border-hairline')}>
              {!m.mine && (
                <p className="mb-0.5 text-xs font-semibold opacity-80">
                  {m.senderName} · {ROLE_LABEL[m.senderRole]}
                </p>
              )}
              {m.toRole && (
                <p className={cn('mb-1 text-[11px]', m.mine ? 'text-brand-100' : 'text-slate-400')}>
                  → {ROLE_LABEL[m.toRole]}
                </p>
              )}
              {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}
              {m.document && (
                <div className={cn('mt-1.5 flex items-center gap-2 rounded-lg px-2 py-1.5', m.mine ? 'bg-brand-700' : 'bg-slate-100')}>
                  <FileText className="h-4 w-4 shrink-0" />
                  <button className="flex-1 truncate text-left text-xs underline" onClick={() => viewDocument(m.document!.id, m.document!.fileName)}>
                    {m.document.fileName}
                  </button>
                  <button onClick={async () => downloadBlob(await api.downloadDocument(m.document!.id), m.document!.fileName)}>
                    <Download className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <p className={cn('mt-1 text-[10px]', m.mine ? 'text-brand-100' : 'text-slate-400')}>
                {new Date(m.createdAt).toLocaleString('ru-RU')}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Composer */}
      <div className="mt-3 space-y-2">
        {(pickedFile || toRole) && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {toRole && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-brand-700">→ {ROLE_LABEL[toRole]} <button onClick={() => setToRole('')}>✕</button></span>}
            {pickedFile && <span className="rounded-full bg-slate-100 px-2 py-0.5">📎 {pickedFile.name} <button onClick={() => setPickedFile(null)}>✕</button></span>}
          </div>
        )}
        <div className="flex items-center gap-2">
          <select
            value={toRole}
            onChange={(e) => setToRole(e.target.value as Role | '')}
            className="rounded-xl border border-hairline px-2 py-2.5 text-sm"
          >
            <option value="">Hammaga</option>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
          <input ref={fileRef} type="file" className="hidden" onChange={(e) => setPickedFile(e.target.files?.[0] ?? null)} />
          <Button variant="secondary" className="px-3" onClick={() => fileRef.current?.click()} aria-label="Fayl">
            <Paperclip className="h-4 w-4" />
          </Button>
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && canSend) send.mutate(); }}
            placeholder="Xabar yozing…"
          />
          <Button className="px-3" disabled={!canSend} loading={send.isPending} onClick={() => send.mutate()} aria-label="Yuborish">
            {!send.isPending && <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
