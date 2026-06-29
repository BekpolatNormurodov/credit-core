import { Fragment, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Paperclip, Search, Send, FileText, Download, X, User as UserIcon, Check, Pencil, Trash2 } from '../lib/icons';
import { api, downloadBlob, viewDocument, documentInlineUrl } from '@credit-core/api-client';
import { Role, ROLE_LABEL, type DocumentDto, type MessageDto } from '@credit-core/shared';
import { Button, Input } from './primitives';
import { ConfirmDialog } from './Modal';
import { Select } from './forms';
import { useToast } from './Toast';
import { cn } from '../lib/cn';

const ROLES: Role[] = [Role.OPERATOR, Role.MODERATOR, Role.DIRECTOR, Role.ADMIN];

const roleTone: Record<Role, string> = {
  [Role.OPERATOR]: 'bg-brand-600',
  [Role.MODERATOR]: 'bg-warning-600',
  [Role.DIRECTOR]: 'bg-violet-600',
  [Role.ADMIN]: 'bg-gray-800 dark:bg-gray-600',
};
const initials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const timeFmt = (d: string) => new Date(d).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

const dayKey = (iso: string) => new Date(iso).toDateString();
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Bugun';
  if (d.toDateString() === yest.toDateString()) return 'Kecha';
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
}
function readLabel(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length <= 2) return `${names.join(', ')} o‘qidi`;
  return `${names[0]} +${names.length - 1} o‘qidi`;
}

type Target = { kind: 'all' } | { kind: 'role'; role: Role } | { kind: 'user'; id: string; name: string; role: Role };
const isImg = (d: DocumentDto) => (d.mimeType ?? '').startsWith('image/');

export function CaseChat({ caseId }: { caseId: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState('');
  const [target, setTarget] = useState<Target>({ kind: 'all' });
  const [search, setSearch] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['messages', caseId] });
    qc.invalidateQueries({ queryKey: ['unread'] });
    qc.invalidateQueries({ queryKey: ['unread-by-case'] });
  };

  const send = useMutation({
    mutationFn: () =>
      api.sendMessage(caseId, {
        text: text || undefined,
        toRole: target.kind === 'role' ? target.role : undefined,
        toUserId: target.kind === 'user' ? target.id : undefined,
        files: files.length ? files : undefined,
      }),
    onSuccess: () => { setText(''); setFiles([]); invalidate(); },
  });

  const editMut = useMutation({
    mutationFn: (vars: { id: string; text: string }) => api.editMessage(caseId, vars.id, vars.text),
    onSuccess: () => { setEditingId(null); setEditText(''); invalidate(); },
    onError: () => toast.error('Xatolik', 'Xabarni tahrirlab bo‘lmadi (ehtimol o‘qilgan)'),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => api.deleteMessage(caseId, id),
    onSuccess: () => { setConfirmDeleteId(null); invalidate(); },
    onError: () => { setConfirmDeleteId(null); toast.error('Xatolik', 'Xabarni o‘chirib bo‘lmadi (ehtimol o‘qilgan)'); },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages?.length]);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)].slice(0, 3));
  };
  const startEdit = (m: MessageDto) => { setEditingId(m.id); setEditText(m.text ?? ''); };

  const canSend = (text.trim() || files.length) && !send.isPending;
  const targetLabel = target.kind === 'user' ? target.name : target.kind === 'role' ? ROLE_LABEL[target.role] : null;

  return (
    <div className="flex h-[32rem] flex-col">
      {/* Directory search → direct a message to one specific colleague */}
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800">
        <Search className="h-5 w-5 shrink-0 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Xodimga yo‘naltirish"
          placeholder="Aniq xodimga yo‘naltirish — ism yozing (operator, moderator, direktor…)"
          className="w-full bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400 dark:text-gray-100 dark:placeholder:text-gray-500"
        />
      </div>
      {search && directory && (
        <div className="mb-3 max-h-32 space-y-1 overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-800">
          {directory.length === 0 && <p className="px-2 py-1 text-xs text-gray-400">Topilmadi</p>}
          {directory.map((u) => (
            <button
              key={u.id}
              onClick={() => { setTarget({ kind: 'user', id: u.id, name: u.fullName, role: u.role }); setSearch(''); }}
              className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm text-gray-700 outline-none transition hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-brand-600/30 dark:text-gray-300 dark:hover:bg-white/5"
            >
              <span className="flex items-center gap-2">
                <span className={cn('flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold text-white', roleTone[u.role])}>{initials(u.fullName)}</span>
                {u.fullName} <span className="text-gray-400">· {u.branchName ?? '—'}</span>
              </span>
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">{ROLE_LABEL[u.role]}</span>
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto rounded-2xl border border-gray-200 bg-gray-50 p-3.5 dark:border-gray-800 dark:bg-white/5">
        {!messages?.length && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-400">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-gray-300 shadow-theme-sm dark:bg-gray-800 dark:text-gray-400"><Send className="h-6 w-6" /></span>
            <p className="text-sm">Hali xabarlar yo‘q — birinchi bo‘lib yozing</p>
          </div>
        )}
        {messages?.map((m, i) => {
          const prev = i > 0 ? messages[i - 1] : null;
          const showDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
          const editing = editingId === m.id;
          return (
            <Fragment key={m.id}>
              {showDay && (
                <div className="flex justify-center py-1">
                  <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-medium text-gray-500 shadow-theme-sm dark:bg-gray-800 dark:text-gray-400">{dayLabel(m.createdAt)}</span>
                </div>
              )}
              <div className={cn('group flex items-end gap-2', m.mine ? 'justify-end' : 'justify-start')}>
                {!m.mine && (
                  <span className={cn('mb-4 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white', roleTone[m.senderRole])}>
                    {initials(m.senderName)}
                  </span>
                )}

                {/* Hover edit/delete — mine and not yet read by anyone else */}
                {m.mine && m.editable && !editing && (
                  <div className="mb-4 flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                    <button onClick={() => startEdit(m)} aria-label="Tahrirlash" className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 outline-none transition hover:bg-gray-100 hover:text-gray-700 focus-visible:ring-2 focus-visible:ring-brand-600/30 dark:hover:bg-white/10 dark:hover:text-gray-200"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => setConfirmDeleteId(m.id)} aria-label="O‘chirish" className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 outline-none transition hover:bg-error-50 hover:text-error-600 focus-visible:ring-2 focus-visible:ring-error-600/30 dark:hover:bg-error-500/10"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                )}

                <div className={cn(
                  'max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-theme-sm',
                  m.mine ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md border border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200',
                )}>
                  {!m.mine && (
                    <p className="mb-0.5 text-xs font-semibold text-gray-600 dark:text-gray-300">
                      {m.senderName} <span className="font-normal text-gray-400">· {ROLE_LABEL[m.senderRole]}</span>
                    </p>
                  )}
                  {(m.toUserName || m.toRole) && (
                    <p className={cn('mb-1 inline-flex items-center gap-1 rounded px-1.5 text-[11px]', m.mine ? 'bg-brand-700/60 text-brand-50' : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-300')}>
                      {m.toUserName ? <UserIcon className="h-3 w-3" /> : null}
                      → {m.toUserName ?? (m.toRole ? ROLE_LABEL[m.toRole] : '')}
                    </p>
                  )}

                  {editing ? (
                    <div className="space-y-1.5">
                      <textarea
                        value={editText}
                        autoFocus
                        rows={2}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (editText.trim()) editMut.mutate({ id: m.id, text: editText }); }
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        className="w-full resize-none rounded-lg border border-white/30 bg-white px-2.5 py-1.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-white/40 dark:bg-gray-800 dark:text-gray-100"
                      />
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => setEditingId(null)} className="rounded-lg px-2 py-1 text-xs text-brand-50/90 outline-none transition hover:bg-brand-700/50 focus-visible:ring-2 focus-visible:ring-white/40">Bekor</button>
                        <button onClick={() => editText.trim() && editMut.mutate({ id: m.id, text: editText })} disabled={!editText.trim() || editMut.isPending} className="rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-brand-700 outline-none transition hover:bg-brand-50 focus-visible:ring-2 focus-visible:ring-white/40 disabled:opacity-50">Saqlash</button>
                      </div>
                    </div>
                  ) : (
                    m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>
                  )}

                  {m.documents?.length > 0 && (
                    <div className="mt-1.5 space-y-1.5">
                      {m.documents.filter(isImg).length > 0 && (
                        <div className="grid grid-cols-3 gap-1.5">
                          {m.documents.filter(isImg).map((d) => (
                            <button key={d.id} onClick={() => viewDocument(d.id, d.fileName)}
                              className={cn('aspect-square overflow-hidden rounded-lg border outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30', m.mine ? 'border-white/20' : 'border-gray-200 dark:border-gray-700')} title={d.fileName}>
                              <img src={documentInlineUrl(d.id)} alt={d.fileName} loading="lazy" className="h-full w-full object-cover" />
                            </button>
                          ))}
                        </div>
                      )}
                      {m.documents.filter((d) => !isImg(d)).map((d) => (
                        <div key={d.id} className={cn('flex items-center gap-2 rounded-lg px-2 py-1.5', m.mine ? 'bg-brand-700/70' : 'bg-gray-100 dark:bg-white/10')}>
                          <FileText className="h-4 w-4 shrink-0" />
                          <button className="flex-1 truncate rounded text-left text-xs underline outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30" onClick={() => viewDocument(d.id, d.fileName)}>{d.fileName}</button>
                          <button className="rounded outline-none transition hover:opacity-80 focus-visible:ring-2 focus-visible:ring-brand-600/30" onClick={async () => downloadBlob(await api.downloadDocument(d.id), d.fileName)} aria-label="Yuklab olish">
                            <Download className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Footer: time · edited · read receipt */}
                  <div className={cn('mt-1 flex items-center justify-end gap-1.5 text-[10px]', m.mine ? 'text-brand-100' : 'text-gray-400')}>
                    {m.edited && <span title="Tahrirlangan">tahrirlangan</span>}
                    <span>{timeFmt(m.createdAt)}</span>
                    {m.mine && (
                      m.readByNames.length > 0 ? (
                        <span className="inline-flex items-center gap-0.5 text-brand-100" title={readLabel(m.readByNames)}>
                          <Check className="h-3.5 w-3.5" /> o‘qildi
                        </span>
                      ) : (
                        <Check className="h-3.5 w-3.5 text-brand-200/70" aria-label="Yuborildi" />
                      )
                    )}
                  </div>
                </div>
              </div>
            </Fragment>
          );
        })}
      </div>

      {/* Composer */}
      <div className="mt-3 space-y-2">
        {(files.length > 0 || targetLabel) && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {targetLabel && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-1 font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">
                {target.kind === 'user' && <UserIcon className="h-3 w-3" />} → {targetLabel}
                <button onClick={() => setTarget({ kind: 'all' })} aria-label="Yo‘naltirishni olib tashlash" className="rounded outline-none transition hover:text-error-600 focus-visible:ring-2 focus-visible:ring-brand-600/30"><X className="h-3 w-3" /></button>
              </span>
            )}
            {files.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-gray-600 dark:bg-white/10 dark:text-gray-300">
                <Paperclip className="h-3 w-3" /> {f.name}
                <button onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} aria-label="Faylni olib tashlash" className="rounded outline-none transition hover:text-error-600 focus-visible:ring-2 focus-visible:ring-brand-600/30"><X className="h-3 w-3" /></button>
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

      <ConfirmDialog
        open={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => confirmDeleteId && delMut.mutate(confirmDeleteId)}
        loading={delMut.isPending}
        title="Xabarni o‘chirasizmi?"
        message="Bu xabar butunlay o‘chiriladi. Faqat hali hech kim o‘qimagan xabarlarni o‘chirish mumkin."
        confirmLabel="O‘chirish"
      />
    </div>
  );
}
