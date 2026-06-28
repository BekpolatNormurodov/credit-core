import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Paperclip, Search, Send, FileText, Download, X, User as UserIcon } from '../lib/icons';
import { api, downloadBlob, viewDocument, documentInlineUrl } from '@credit-core/api-client';
import { Role, ROLE_LABEL, type DocumentDto } from '@credit-core/shared';
import { Button, Input } from './primitives';
import { Select } from './forms';
import { cn } from '../lib/cn';

const ROLES: Role[] = [Role.OPERATOR, Role.MODERATOR, Role.DIRECTOR, Role.ADMIN];

const roleTone: Record<Role, string> = {
  [Role.OPERATOR]: 'bg-brand-600',
  [Role.MODERATOR]: 'bg-warning-600',
  [Role.DIRECTOR]: 'bg-violet-600',
  [Role.ADMIN]: 'bg-navy-800',
};
const initials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const timeFmt = (d: string) => new Date(d).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

// Whom the message is directed to: everyone, a role, or one specific user.
type Target = { kind: 'all' } | { kind: 'role'; role: Role } | { kind: 'user'; id: string; name: string; role: Role };

function isImg(d: DocumentDto) {
  return (d.mimeType ?? '').startsWith('image/');
}

export function CaseChat({ caseId }: { caseId: string }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState('');
  const [target, setTarget] = useState<Target>({ kind: 'all' });
  const [search, setSearch] = useState('');
  const [files, setFiles] = useState<File[]>([]);

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
      api.sendMessage(caseId, {
        text: text || undefined,
        toRole: target.kind === 'role' ? target.role : undefined,
        toUserId: target.kind === 'user' ? target.id : undefined,
        files: files.length ? files : undefined,
      }),
    onSuccess: () => {
      setText('');
      setFiles([]);
      qc.invalidateQueries({ queryKey: ['messages', caseId] });
      qc.invalidateQueries({ queryKey: ['unread'] });
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages?.length]);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)].slice(0, 3));
  };

  const canSend = (text.trim() || files.length) && !send.isPending;
  const targetLabel =
    target.kind === 'user' ? target.name : target.kind === 'role' ? ROLE_LABEL[target.role] : null;

  return (
    <div className="flex h-[32rem] flex-col">
      {/* Directory search → pick a specific colleague */}
      <div className="mb-3 flex items-center gap-2 rounded-xl border border-hairline bg-white px-3 py-1.5 dark:border-white/10 dark:bg-navy-800">
        <Search className="h-4 w-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Aniq xodimga yo‘naltirish — ism yozing (operator, moderator, direktor…)"
          className="w-full bg-transparent text-sm outline-none dark:text-slate-100"
        />
      </div>
      {search && directory && (
        <div className="mb-3 max-h-32 space-y-1 overflow-y-auto rounded-xl border border-hairline bg-white p-2 dark:border-white/10 dark:bg-navy-800">
          {directory.length === 0 && <p className="px-2 py-1 text-xs text-slate-400">Topilmadi</p>}
          {directory.map((u) => (
            <button
              key={u.id}
              onClick={() => { setTarget({ kind: 'user', id: u.id, name: u.fullName, role: u.role }); setSearch(''); }}
              className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-white/5"
            >
              <span className="flex items-center gap-2">
                <span className={cn('flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold text-white', roleTone[u.role])}>{initials(u.fullName)}</span>
                {u.fullName} <span className="text-slate-400">· {u.branchName ?? '—'}</span>
              </span>
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700 dark:bg-brand-600/15 dark:text-brand-300">{ROLE_LABEL[u.role]}</span>
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto rounded-2xl border border-hairline bg-slate-50/60 p-3.5 dark:border-white/10 dark:bg-navy-900/40">
        {!messages?.length && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-300 shadow-soft dark:bg-navy-800"><Send className="h-6 w-6" /></span>
            <p className="text-sm">Hali xabarlar yo‘q — birinchi bo‘lib yozing</p>
          </div>
        )}
        {messages?.map((m) => (
          <div key={m.id} className={cn('flex items-end gap-2', m.mine ? 'justify-end' : 'justify-start')}>
            {!m.mine && (
              <span className={cn('mb-4 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white', roleTone[m.senderRole])}>
                {initials(m.senderName)}
              </span>
            )}
            <div className={cn(
              'max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-soft',
              m.mine ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md border border-hairline bg-white dark:border-white/10 dark:bg-navy-800 dark:text-slate-100',
            )}>
              {!m.mine && (
                <p className="mb-0.5 text-xs font-semibold text-slate-500 dark:text-slate-300">
                  {m.senderName} <span className="font-normal text-slate-400">· {ROLE_LABEL[m.senderRole]}</span>
                </p>
              )}
              {(m.toUserName || m.toRole) && (
                <p className={cn('mb-1 inline-flex items-center gap-1 rounded px-1.5 text-[11px]', m.mine ? 'bg-brand-700/60 text-brand-50' : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300')}>
                  {m.toUserName ? <UserIcon className="h-3 w-3" /> : null}
                  → {m.toUserName ?? (m.toRole ? ROLE_LABEL[m.toRole] : '')}
                </p>
              )}
              {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}
              {m.documents?.length > 0 && (
                <div className="mt-1.5 space-y-1.5">
                  {m.documents.filter(isImg).length > 0 && (
                    <div className="grid grid-cols-3 gap-1.5">
                      {m.documents.filter(isImg).map((d) => (
                        <button key={d.id} onClick={() => viewDocument(d.id, d.fileName)}
                          className="aspect-square overflow-hidden rounded-lg border border-white/20" title={d.fileName}>
                          <img src={documentInlineUrl(d.id)} alt={d.fileName} loading="lazy" className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                  {m.documents.filter((d) => !isImg(d)).map((d) => (
                    <div key={d.id} className={cn('flex items-center gap-2 rounded-lg px-2 py-1.5', m.mine ? 'bg-brand-700/70' : 'bg-slate-100 dark:bg-white/10')}>
                      <FileText className="h-4 w-4 shrink-0" />
                      <button className="flex-1 truncate text-left text-xs underline" onClick={() => viewDocument(d.id, d.fileName)}>{d.fileName}</button>
                      <button onClick={async () => downloadBlob(await api.downloadDocument(d.id), d.fileName)} aria-label="Yuklab olish">
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className={cn('mt-1 text-right text-[10px]', m.mine ? 'text-brand-100' : 'text-slate-400')}>{timeFmt(m.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Composer */}
      <div className="mt-3 space-y-2">
        {(files.length > 0 || targetLabel) && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {targetLabel && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-1 font-medium text-brand-700 dark:bg-brand-600/15 dark:text-brand-300">
                {target.kind === 'user' && <UserIcon className="h-3 w-3" />} → {targetLabel}
                <button onClick={() => setTarget({ kind: 'all' })} className="hover:text-danger-600"><X className="h-3 w-3" /></button>
              </span>
            )}
            {files.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-slate-600 dark:bg-white/10 dark:text-slate-300">
                <Paperclip className="h-3 w-3" /> {f.name}
                <button onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} className="hover:text-danger-600"><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="w-32 shrink-0">
            <Select<string>
              value={target.kind === 'role' ? target.role : ''}
              onChange={(v) => setTarget(v ? { kind: 'role', role: v as Role } : { kind: 'all' })}
              options={[{ value: '', label: 'Hammaga' }, ...ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))]}
            />
          </div>
          <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          <Button variant="secondary" className="px-3" onClick={() => fileRef.current?.click()} disabled={files.length >= 3} aria-label="Fayl (max 3)" title="Fayl biriktirish (3 tagacha)">
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
