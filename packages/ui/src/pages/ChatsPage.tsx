import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Messages, Plus, Send, Paperclip, X, Download } from '../lib/icons';
import { api, documentInlineUrl, downloadBlob, type Conversation } from '@credit-core/api-client';
import { DirectoryUser, MessageDto } from '@credit-core/shared';
import { Card, Skeleton, Button, Input } from '../components/primitives';
import { CaseChat } from '../components/CaseChat';
import { cn } from '../lib/cn';

type Selected = { kind: 'saved' | 'dm' | 'case'; key: string; title: string };

export function ChatsPage() {
  const [searchParams] = useSearchParams();
  const { data: convos, isLoading } = useQuery({ queryKey: ['conversations'], queryFn: () => api.conversations(), refetchInterval: 10_000 });
  // Deep-link: /chats?case=<id> (from a case page) opens that case's chat directly.
  const [active, setActive] = useState<Selected | null>(() => {
    const caseId = searchParams.get('case');
    return caseId ? { kind: 'case', key: caseId, title: 'Ariza chati' } : null;
  });
  // React Router reuses the /chats element on a query-only change, so the initializer above won't
  // re-run — re-sync the deep-linked case whenever the ?case= param changes (or is cleared).
  useEffect(() => {
    const caseId = searchParams.get('case');
    setActive(caseId ? { kind: 'case', key: caseId, title: 'Ariza chati' } : null);
  }, [searchParams]);
  const [newOpen, setNewOpen] = useState(false);

  const first = convos?.[0];
  // Prefer the conversation's real title once the list loads (deep-link starts with a placeholder).
  const activeConvo = active && convos?.find((c) => c.kind === active.kind && c.key === active.key);
  const selected: Selected | null = active
    ? { ...active, title: activeConvo?.title ?? active.title }
    : (first ? { kind: first.kind, key: first.key, title: first.title } : null);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-700 text-white"><Messages className="h-5 w-5" /></span>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Xabarlar</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Shaxsiy, saqlangan va ariza chatlari</p>
        </div>
        <Button variant="secondary" onClick={() => setNewOpen((v) => !v)}><Plus className="h-4 w-4" /> Yangi</Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="space-y-1 p-2 lg:col-span-1">
            {newOpen && <NewDm onPick={(u) => { setActive({ kind: 'dm', key: u.id, title: u.fullName }); setNewOpen(false); }} />}
            {(convos ?? []).map((c) => {
              const on = selected?.kind === c.kind && selected?.key === c.key;
              return (
                <button key={`${c.kind}:${c.key}`} onClick={() => setActive({ kind: c.kind, key: c.key, title: c.title })}
                  className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30', on ? 'bg-brand-50 dark:bg-brand-500/10' : 'hover:bg-gray-50 dark:hover:bg-white/5')}>
                  <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm text-white', c.kind === 'saved' ? 'bg-brand-700' : c.kind === 'dm' ? 'bg-violet-600' : 'bg-gray-500')}>
                    {c.kind === 'saved' ? '★' : c.kind === 'dm' ? '@' : '#'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-sm font-semibold', on ? 'text-brand-700 dark:text-brand-400' : 'text-gray-800 dark:text-gray-100')}>{c.title}</span>
                    <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{c.lastText ?? '—'}</span>
                  </span>
                  {c.unread > 0 && !on && (
                    <span className="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[11px] font-semibold text-white">{c.unread > 99 ? '99+' : c.unread}</span>
                  )}
                </button>
              );
            })}
            {!convos?.length && !newOpen && <p className="px-3 py-8 text-center text-sm text-gray-500 dark:text-gray-400">Suhbatlar yo‘q. "Yangi" orqali boshlang.</p>}
          </Card>

          <Card className="lg:col-span-2">
            {!selected ? (
              <p className="py-16 text-center text-gray-500 dark:text-gray-400">Suhbatni tanlang</p>
            ) : selected.kind === 'case' ? (
              <>
                <div className="mb-3 border-b border-gray-200 pb-3 dark:border-white/10"><p className="font-semibold text-gray-800 dark:text-white">{selected.title}</p></div>
                <CaseChat key={selected.key} caseId={selected.key} />
              </>
            ) : (
              <SimpleThread key={`${selected.kind}:${selected.key}`} selected={selected} />
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function NewDm({ onPick }: { onPick: (u: DirectoryUser) => void }) {
  const [q, setQ] = useState('');
  const { data } = useQuery({ queryKey: ['directory', q], queryFn: () => api.directory(undefined, q || undefined) });
  return (
    <div className="mb-2 rounded-xl border border-gray-200 p-2 dark:border-gray-800">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Foydalanuvchini qidiring…" autoFocus />
      <div className="mt-1 max-h-48 overflow-y-auto">
        {(data ?? []).map((u) => (
          <button key={u.id} onClick={() => onPick(u)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-white/5">
            <span className="truncate font-medium text-gray-800 dark:text-gray-100">{u.fullName}</span>
            <span className="ml-auto shrink-0 text-xs text-gray-400">{u.role}</span>
          </button>
        ))}
        {!data?.length && <p className="px-2 py-3 text-center text-xs text-gray-400">Topilmadi</p>}
      </div>
    </div>
  );
}

function SimpleThread({ selected }: { selected: Selected }) {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const isSaved = selected.kind === 'saved';
  const key = isSaved ? ['saved'] : ['dm', selected.key];
  const { data: msgs } = useQuery({ queryKey: key, queryFn: () => (isSaved ? api.savedMessages() : api.dmMessages(selected.key)), refetchInterval: 8_000 });
  const refetch = () => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ['conversations'] }); };
  const send = async () => {
    const t = text.trim();
    if (!t && files.length === 0) return;
    const fs = files;
    setText(''); setFiles([]);
    if (isSaved) await api.sendSaved(t, fs); else await api.sendDm(selected.key, t, fs);
    refetch();
  };
  const save = async (id: string) => { await api.saveToSaved(id); qc.invalidateQueries({ queryKey: ['conversations'] }); };
  const time = (iso: string) => new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return (
    <div className="flex h-[28rem] flex-col">
      <div className="mb-3 border-b border-gray-200 pb-3 dark:border-white/10">
        <p className="font-semibold text-gray-800 dark:text-white">{isSaved ? '★ Saqlangan xabarlar' : selected.title}</p>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {(msgs ?? []).map((m: MessageDto) => {
          const imgs = (m.documents ?? []).filter((d) => (d.mimeType ?? '').startsWith('image/'));
          const otherDocs = (m.documents ?? []).filter((d) => !(d.mimeType ?? '').startsWith('image/'));
          return (
            <div key={m.id} className={cn('flex', m.mine ? 'justify-end' : 'justify-start')}>
              <div className={cn('group max-w-[80%] rounded-2xl px-3 py-2 text-sm', m.mine ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-800 dark:bg-white/10 dark:text-gray-100')}>
                {!m.mine && !isSaved && <p className="mb-0.5 text-xs font-medium opacity-70">{m.senderName}</p>}
                {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}
                {imgs.length > 0 && (
                  <div className="mt-1 grid grid-cols-2 gap-1">
                    {imgs.map((d) => <img key={d.id} src={documentInlineUrl(d.id)} alt={d.fileName} className="h-24 w-full cursor-pointer rounded-lg object-cover" onClick={() => window.open(documentInlineUrl(d.id), '_blank', 'noopener')} />)}
                  </div>
                )}
                {otherDocs.map((d) => (
                  <button key={d.id} onClick={async () => downloadBlob(await api.downloadDocument(d.id), d.fileName)} className="mt-1 flex items-center gap-1.5 rounded-lg bg-black/10 px-2 py-1 text-xs hover:bg-black/20 dark:bg-white/10">
                    <Download className="h-3.5 w-3.5" /> <span className="max-w-[12rem] truncate">{d.fileName}</span>
                  </button>
                ))}
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-[10px] opacity-60">{time(m.createdAt)}{m.edited ? ' · tahrirlandi' : ''}</span>
                  {!isSaved && <button onClick={() => save(m.id)} className="text-[10px] underline opacity-0 transition group-hover:opacity-70">Saqlanganlarga</button>}
                </div>
              </div>
            </div>
          );
        })}
        {!msgs?.length && <p className="py-10 text-center text-sm text-gray-400">Xabar yo‘q</p>}
      </div>
      {files.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-2 py-1 text-xs text-gray-700 dark:bg-white/10 dark:text-gray-200">
              <span className="max-w-[10rem] truncate">{f.name}</span>
              <button onClick={() => setFiles(files.filter((_, x) => x !== i))} aria-label="Olib tashlash"><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx" multiple className="hidden" onChange={(e) => { setFiles((p) => [...p, ...Array.from(e.target.files ?? [])].slice(0, 3)); e.target.value = ''; }} />
        <Button variant="ghost" className="px-2.5" onClick={() => fileRef.current?.click()} aria-label="Fayl biriktirish"><Paperclip className="h-4 w-4" /></Button>
        <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} placeholder="Xabar yozing…" />
        <Button onClick={send} disabled={!text.trim() && files.length === 0}><Send className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}
