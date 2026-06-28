import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2, Download, FileDown, FileText, Pencil, RotateCcw, Send, Flag, Upload, Eye, House, Car, Paperclip,
} from '../lib/icons';
import { api, downloadBlob, viewDocument, documentInlineUrl } from '@credit-core/api-client';
import { CaseChat } from '../components/CaseChat';
import {
  CaseStatus, DocumentType, DOCUMENT_LABEL, PRODUCT_LABEL, Role,
  TRANSITIONS, WorkflowDecision, type CreditCaseDto,
} from '@credit-core/shared';
import { useAuth } from '../lib/auth';
import { Button, Card, Field, Input, StatusBadge } from '../components/primitives';
import { Select, MoneyInput } from '../components/forms';
import { CaseTimeline } from '../components/CaseTimeline';
import { useToast } from '../components/Toast';
import { formatMoney } from '../lib/cn';

const uploadTypes: DocumentType[] = [
  DocumentType.NOTARY, DocumentType.SCAN, DocumentType.COLLATERAL_PHOTO, DocumentType.TECH_PASSPORT,
];

export function CaseView() {
  const { id } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [comment, setComment] = useState('');
  const [katm, setKatm] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadType, setUploadType] = useState<DocumentType>(DocumentType.NOTARY);

  const { data: c, isLoading } = useQuery({ queryKey: ['case', id], queryFn: () => api.case(id!) });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['case', id] });
    qc.invalidateQueries({ queryKey: ['cases'] });
  };

  const transition = useMutation({
    mutationFn: (decision: WorkflowDecision) => api.transition(id!, { decision, comment: comment || undefined }),
    onSuccess: () => { setComment(''); refresh(); },
  });

  const upload = useMutation({
    mutationFn: (file: File) => api.uploadDocument(id!, uploadType, file),
    onSuccess: refresh,
  });

  if (isLoading || !c) return <p className="text-slate-400">Yuklanmoqda…</p>;

  const role = user!.role;
  const myTransitions = TRANSITIONS.filter((t) => t.from === c.status && t.role === role);
  const isOperatorDraft = role === Role.OPERATOR && c.status === CaseStatus.DRAFT;
  const isDirectorReview = role === Role.DIRECTOR && c.status === CaseStatus.DIRECTOR_REVIEW;
  const isAdminFinalize = role === Role.ADMIN && c.status === CaseStatus.ADMIN_FINALIZE;
  const canUpload = isOperatorDraft || isDirectorReview;
  const currentUploadTypes = isDirectorReview ? [DocumentType.DIRECTOR_FINAL] : uploadTypes;

  const decisionLabel: Record<WorkflowDecision, string> = {
    [WorkflowDecision.SUBMIT]: 'Yuborish', [WorkflowDecision.APPROVE]: 'Tasdiqlash',
    [WorkflowDecision.RETURN]: 'Qaytarish', [WorkflowDecision.FINALIZE]: 'Yakunlash',
  };
  const decisionIcon: Record<WorkflowDecision, React.ComponentType<{ className?: string }>> = {
    [WorkflowDecision.SUBMIT]: Send, [WorkflowDecision.APPROVE]: CheckCircle2,
    [WorkflowDecision.RETURN]: RotateCcw, [WorkflowDecision.FINALIZE]: Flag,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{c.number}</h1>
            <StatusBadge status={c.status} />
          </div>
          <p className="text-sm text-slate-500">{PRODUCT_LABEL[c.productType]} • {c.branch?.name ?? '—'}</p>
        </div>
        {isOperatorDraft && (
          <Link to={`/cases/${c.id}/edit`}><Button variant="secondary"><Pencil className="h-4 w-4" /> Tahrirlash</Button></Link>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Detail c={c} canUpload={canUpload} />

          <Card>
            <h2 className="mb-1 font-semibold">Umumiy hujjatlar</h2>
            <p className="mb-3 text-xs text-muted">Garovga bog‘lanmagan hujjatlar (garov hujjatlari yuqorida har bir garov ostida).</p>
            {(() => {
              const general = c.documents.filter((d) => !d.collateralId);
              const images = general.filter((d) => (d.mimeType ?? '').startsWith('image/'));
              const files = general.filter((d) => !(d.mimeType ?? '').startsWith('image/'));
              if (general.length === 0 && !canUpload) return <p className="text-sm text-slate-400">Hujjatlar yo‘q</p>;
              return (
                <div className="space-y-3">
                  {images.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {images.map((d) => (
                        <button key={d.id} onClick={() => viewDocument(d.id, d.fileName)}
                          className="group relative aspect-square overflow-hidden rounded-xl border border-hairline dark:border-white/10" title={`${DOCUMENT_LABEL[d.type]} · ${d.fileName}`}>
                          <img src={documentInlineUrl(d.id)} alt={d.fileName} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
                          <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1.5 py-0.5 text-[10px] text-white">{DOCUMENT_LABEL[d.type]}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <ul className="space-y-2">
                    {files.map((d) => (
                      <li key={d.id} className="flex items-center justify-between gap-2 rounded-xl border border-hairline px-3 py-2 dark:border-white/10">
                        <div className="flex min-w-0 items-center gap-2.5 text-sm">
                          <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{DOCUMENT_LABEL[d.type]} <span className="font-normal text-slate-400">· {d.fileName}</span></p>
                            <p className="text-xs text-slate-400">
                              {new Date(d.uploadedAt).toLocaleString('ru-RU')}
                              {d.uploadedByName ? ` · ${d.uploadedByName}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button onClick={() => viewDocument(d.id, d.fileName)} className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-white/10" title="Ko‘rish">
                            <Eye className="h-4 w-4" />
                          </button>
                          <button onClick={async () => downloadBlob(await api.downloadDocument(d.id), d.fileName)} className="rounded-lg p-1.5 text-brand-600 transition hover:bg-brand-50 dark:hover:bg-brand-600/15" title="Yuklab olish">
                            <Download className="h-4 w-4" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}

            {canUpload && (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-hairline pt-4 dark:border-white/10">
                <div className="w-52">
                  <Select<DocumentType> value={uploadType} onChange={(v) => setUploadType(v)}
                    options={currentUploadTypes.map((t) => ({ value: t, label: DOCUMENT_LABEL[t] }))} />
                </div>
                <input ref={fileRef} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])} />
                <Button variant="secondary" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-4 w-4" /> Hujjat yuklash
                </Button>
                {isDirectorReview && <span className="text-xs text-warning-600 dark:text-warning-400">Tasdiqlash uchun yakuniy hujjat shart</span>}
              </div>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold">Harakatlar tarixi</h2>
            <CaseTimeline events={c.events} />
          </Card>
        </div>

        <div className="space-y-6">
          {myTransitions.length > 0 && (
            <Card className="space-y-3">
              <h2 className="font-semibold">Amallar</h2>
              <Field label="Izoh (ixtiyoriy)">
                <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Izoh…" />
              </Field>
              {myTransitions.map((t) => {
                const Icon = decisionIcon[t.decision];
                return (
                  <Button
                    key={t.decision}
                    variant={t.decision === WorkflowDecision.RETURN ? 'danger' : 'primary'}
                    className="w-full"
                    loading={transition.isPending}
                    onClick={() => transition.mutate(t.decision)}
                  >
                    {!transition.isPending && <Icon className="h-4 w-4" />} {decisionLabel[t.decision]}
                  </Button>
                );
              })}
            </Card>
          )}

          {isAdminFinalize && <AdminPanel c={c} onChange={refresh} katm={katm} setKatm={setKatm} />}
          {role === Role.ADMIN && <KatmInputs />}
        </div>
      </div>

      <Card>
        <h2 className="mb-3 font-semibold">Muloqot (chat)</h2>
        <CaseChat caseId={c.id} />
      </Card>
    </div>
  );
}

function Detail({ c, canUpload }: { c: CreditCaseDto; canUpload: boolean }) {
  const totalCollateral = c.collaterals.reduce((s, x) => s + (x.agreedValue ?? 0), 0);
  const base: [string, string][] = [
    ['Qarz oluvchi', c.borrower?.fullName ?? '—'],
    ['Pasport', [c.borrower?.passportSeries, c.borrower?.passportNumber].filter(Boolean).join(' ') || '—'],
    ['PINFL', c.borrower?.pinfl ?? '—'],
    ['Telefon', c.borrower?.phone ?? '—'],
    ['Summa', formatMoney(c.amount)],
    ['Muddat', c.termMonths ? `${c.termMonths} oy` : '—'],
    ['Jami garov', formatMoney(totalCollateral)],
    ['KATM narxi', formatMoney(c.katmPrice)],
  ];
  return (
    <Card className="space-y-5">
      <div>
        <h2 className="mb-3 font-semibold">Qarz oluvchi va kredit</h2>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {base.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs uppercase tracking-wide text-slate-400">{k}</dt>
              <dd className="nums text-sm font-medium text-ink dark:text-slate-200">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {c.guarantors.length > 0 && (
        <div className="border-t border-hairline pt-4 dark:border-white/10">
          <h2 className="mb-2 font-semibold">Kafillar ({c.guarantors.length})</h2>
          <div className="space-y-1.5">
            {c.guarantors.map((g, i) => (
              <div key={g.id ?? i} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-white/5">
                <span className="font-medium">{g.fullName}</span>
                {g.relation && <span className="text-muted">· {g.relation}</span>}
                {g.passportNumber && <span className="nums text-muted">· {g.passportNumber}</span>}
                {g.phone && <span className="nums text-muted">· {g.phone}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3 border-t border-hairline pt-4 dark:border-white/10">
        <h2 className="font-semibold">Garovlar ({c.collaterals.length})</h2>
        {c.collaterals.map((col, i) => {
          const isAuto = col.type === 'AUTO';
          const rows: [string, string][] = isAuto
            ? [
                ['Model', col.model ?? '—'],
                ['Davlat raqami', col.stateNumber ?? '—'],
                ['Tex passport', col.techPassportNo ?? '—'],
                ['Rang / yil', `${col.color ?? '—'} / ${col.year ?? '—'}`],
                ['Probeg', col.mileage != null ? `${col.mileage} km` : '—'],
                ['Garov qiymati', formatMoney(col.agreedValue)],
              ]
            : [
                ['Manzil', col.address ?? '—'],
                ['Kadastr №', col.cadastreNo ?? '—'],
                ['Reestr №', col.registryNo ?? '—'],
                ['Maydon', `${col.totalAreaM2 ?? '—'} / ${col.livingAreaM2 ?? '—'} m²`],
                ['Xonalar', [col.roomNames, col.roomCount != null ? `(${col.roomCount})` : ''].filter(Boolean).join(' ') || '—'],
                ['Garov qiymati', formatMoney(col.agreedValue)],
              ];
          return (
            <div key={col.id ?? i} className="rounded-xl border border-hairline p-4 dark:border-white/10">
              <div className="mb-2 flex items-center gap-2">
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-white ${isAuto ? 'bg-warning-600' : 'bg-brand-700'}`}>
                  {isAuto ? <Car className="h-4 w-4" /> : <House className="h-4 w-4" />}
                </span>
                <p className="text-sm font-semibold">Garov {i + 1} — {isAuto ? 'Avtotransport' : 'Uy-joy'}</p>
              </div>
              <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {rows.map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">{k}</dt>
                    <dd className="nums text-sm font-medium text-ink dark:text-slate-200">{v}</dd>
                  </div>
                ))}
              </dl>
              {col.owners?.length ? (
                <p className="mt-2 text-xs text-slate-500">Egalar: {col.owners.map((o) => `${o.fullName}${o.sharePercent != null ? ` (${o.sharePercent}%)` : ''}`).join(', ')}</p>
              ) : null}
              {col.id && (
                <CollateralDocs
                  caseId={c.id}
                  collateralId={col.id}
                  docs={c.documents.filter((d) => d.collateralId === col.id)}
                  canUpload={canUpload}
                />
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

const COLLATERAL_DOC_TYPES: DocumentType[] = [
  DocumentType.COLLATERAL_PHOTO, DocumentType.TECH_PASSPORT, DocumentType.NOTARY, DocumentType.SCAN, DocumentType.OTHER,
];

function CollateralDocs({
  caseId, collateralId, docs, canUpload,
}: { caseId: string; collateralId: string; docs: CreditCaseDto['documents']; canUpload: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [docType, setDocType] = useState<DocumentType>(DocumentType.COLLATERAL_PHOTO);

  const reset = () => { setFile(null); setTitle(''); setDescription(''); setDocType(DocumentType.COLLATERAL_PHOTO); setOpen(false); };
  const upload = useMutation({
    mutationFn: () => api.uploadDocument(caseId, docType, file!, { collateralId, title: title || undefined, description: description || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['case', caseId] }); toast.success('Hujjat biriktirildi', title || file?.name); reset(); },
    onError: () => toast.error('Xatolik', 'Hujjat yuklanmadi'),
  });

  const images = docs.filter((d) => (d.mimeType ?? '').startsWith('image/'));
  const files = docs.filter((d) => !(d.mimeType ?? '').startsWith('image/'));

  return (
    <div className="mt-3 border-t border-hairline pt-3 dark:border-white/10">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Garov hujjatlari ({docs.length})</p>
        {canUpload && !open && (
          <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-brand-700 transition hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-600/15">
            <Upload className="h-3.5 w-3.5" /> Hujjat biriktirish
          </button>
        )}
      </div>

      {docs.length === 0 && !open && <p className="text-xs text-slate-400">Hali hujjat biriktirilmagan</p>}

      {images.length > 0 && (
        <div className="mb-2 grid grid-cols-4 gap-2 sm:grid-cols-6">
          {images.map((d) => (
            <button key={d.id} onClick={() => viewDocument(d.id, d.fileName)}
              className="group relative aspect-square overflow-hidden rounded-lg border border-hairline dark:border-white/10" title={[d.title, d.fileName].filter(Boolean).join(' · ')}>
              <img src={documentInlineUrl(d.id)} alt={d.fileName} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
              {d.title && <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1 py-0.5 text-[9px] text-white">{d.title}</span>}
            </button>
          ))}
        </div>
      )}
      {files.length > 0 && (
        <ul className="mb-2 space-y-1.5">
          {files.map((d) => (
            <li key={d.id} className="flex items-start justify-between gap-2 rounded-lg border border-hairline px-2.5 py-1.5 dark:border-white/10">
              <div className="flex min-w-0 items-start gap-2 text-sm">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <div className="min-w-0">
                  <p className="truncate font-medium">{d.title || DOCUMENT_LABEL[d.type]} <span className="font-normal text-slate-400">· {d.fileName}</span></p>
                  {d.description && <p className="text-xs text-slate-500">{d.description}</p>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button onClick={() => viewDocument(d.id, d.fileName)} className="rounded-lg p-1 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-white/10" title="Ko‘rish"><Eye className="h-4 w-4" /></button>
                <button onClick={async () => downloadBlob(await api.downloadDocument(d.id), d.fileName)} className="rounded-lg p-1 text-brand-600 transition hover:bg-brand-50 dark:hover:bg-brand-600/15" title="Yuklab olish"><Download className="h-4 w-4" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="space-y-2 rounded-xl border border-dashed border-hairline bg-slate-50/60 p-3 dark:border-white/15 dark:bg-white/5">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Hujjat nomi"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="masalan: Kadastr ko‘chirmasi" /></Field>
            <Field label="Turi">
              <Select<DocumentType> value={docType} onChange={setDocType} options={COLLATERAL_DOC_TYPES.map((t) => ({ value: t, label: DOCUMENT_LABEL[t] }))} />
            </Field>
          </div>
          <Field label="Izoh (ixtiyoriy)"><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Qo‘shimcha tavsif…" /></Field>
          <input ref={fileRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => fileRef.current?.click()}><Paperclip className="h-4 w-4" /> {file ? 'Faylni almashtirish' : 'Fayl tanlash'}</Button>
            {file && <span className="truncate text-xs text-muted">{file.name}</span>}
            <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" onClick={reset}>Bekor</Button>
              <Button disabled={!file} loading={upload.isPending} onClick={() => upload.mutate()}><Upload className="h-4 w-4" /> Biriktirish</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminPanel({
  c, onChange, katm, setKatm,
}: { c: CreditCaseDto; onChange: () => void; katm: string; setKatm: (v: string) => void }) {
  const saveKatm = useMutation({ mutationFn: () => api.setKatmPrice(c.id, Number(katm)), onSuccess: onChange });
  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">Yakunlash (Admin)</h2>
      <Field label="KATM narxi">
        <div className="flex gap-2">
          <MoneyInput value={katm ? Number(katm) : null} onChange={(v) => setKatm(v == null ? '' : String(v))} />
          <Button variant="secondary" onClick={() => saveKatm.mutate()} disabled={!katm}>Saqlash</Button>
        </div>
      </Field>
      <Button variant="secondary" className="w-full" onClick={async () => downloadBlob(await api.generatePdf(c.id), `Akt_${c.number}.pdf`)}>
        <FileDown className="h-4 w-4" /> PDF generatsiya (Akt)
      </Button>
      <Button variant="secondary" className="w-full" onClick={async () => downloadBlob(await api.exportExcel(c.id), `Garov_${c.number}.xlsx`)}>
        <Download className="h-4 w-4" /> Excel eksport
      </Button>
    </Card>
  );
}

function KatmInputs() {
  // KATM integratsiyasi tayyor emas — qiymatlarni qo'lda kiritish inputlari.
  const [history, setHistory] = useState('');
  const [score, setScore] = useState('');
  const [pledge, setPledge] = useState('');
  return (
    <Card className="space-y-3 border-dashed">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">KATM hisobotlari</h2>
        <span className="rounded-full bg-warning-100 px-2 py-0.5 text-xs font-medium text-warning-700 dark:bg-warning-600/15 dark:text-warning-400">Qo‘lda · tez kunda avto</span>
      </div>
      <p className="text-xs text-slate-500">PINFL bo‘yicha 2–3 hisobot qiymatini kiriting (integratsiya tayyor bo‘lguncha).</p>
      <Field label="Kredit tarixi">
        <Input value={history} onChange={(e) => setHistory(e.target.value)} placeholder="masalan: yaxshi / muddati o‘tgan yo‘q" />
      </Field>
      <Field label="Skoring bali">
        <Input type="number" value={score} onChange={(e) => setScore(e.target.value)} placeholder="0–1000" />
      </Field>
      <Field label="Garov reestri holati">
        <Input value={pledge} onChange={(e) => setPledge(e.target.value)} placeholder="band emas / band" />
      </Field>
    </Card>
  );
}
