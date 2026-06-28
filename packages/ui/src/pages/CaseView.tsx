import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2, Download, FileDown, FileText, Pencil, RotateCcw, Send, Flag, Upload,
} from 'lucide-react';
import { api, downloadBlob } from '@credit-core/api-client';
import {
  CaseStatus, DocumentType, DOCUMENT_LABEL, PRODUCT_LABEL, Role,
  TRANSITIONS, WorkflowDecision, type CreditCaseDto,
} from '@credit-core/shared';
import { useAuth } from '../lib/auth';
import { Button, Card, Field, Input, StatusBadge } from '../components/primitives';
import { CaseTimeline } from '../components/CaseTimeline';
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
          <Detail c={c} />

          <Card>
            <h2 className="mb-3 font-semibold">Hujjatlar</h2>
            {c.documents.length === 0 && <p className="text-sm text-slate-400">Hujjatlar yo‘q</p>}
            <ul className="space-y-2">
              {c.documents.map((d) => (
                <li key={d.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2">
                  <span className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-slate-400" />
                    <span className="font-medium">{DOCUMENT_LABEL[d.type]}</span>
                    <span className="text-slate-400">{d.fileName}</span>
                  </span>
                  <a href={api.documentUrl(d.id)} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
                    <Download className="h-4 w-4" />
                  </a>
                </li>
              ))}
            </ul>

            {canUpload && (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                <select
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={uploadType}
                  onChange={(e) => setUploadType(e.target.value as DocumentType)}
                >
                  {currentUploadTypes.map((t) => <option key={t} value={t}>{DOCUMENT_LABEL[t]}</option>)}
                </select>
                <input ref={fileRef} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])} />
                <Button variant="secondary" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-4 w-4" /> Hujjat yuklash
                </Button>
                {isDirectorReview && <span className="text-xs text-amber-600">Tasdiqlash uchun yakuniy hujjat shart</span>}
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
                    disabled={transition.isPending}
                    onClick={() => transition.mutate(t.decision)}
                  >
                    <Icon className="h-4 w-4" /> {decisionLabel[t.decision]}
                  </Button>
                );
              })}
            </Card>
          )}

          {isAdminFinalize && <AdminPanel c={c} onChange={refresh} katm={katm} setKatm={setKatm} />}
          {role === Role.ADMIN && <KatmPlaceholder />}
        </div>
      </div>
    </div>
  );
}

function Detail({ c }: { c: CreditCaseDto }) {
  const re = c.realEstate;
  const rows: [string, string][] = [
    ['Qarz oluvchi', c.borrower?.fullName ?? '—'],
    ['Pasport', [c.borrower?.passportSeries, c.borrower?.passportNumber].filter(Boolean).join(' ') || '—'],
    ['Summa', formatMoney(c.amount)],
    ['Muddat', c.termMonths ? `${c.termMonths} oy` : '—'],
    ['Manzil', re?.address ?? '—'],
    ['Kadastr №', re?.cadastreNo ?? '—'],
    ['Reestr №', re?.registryNo ?? '—'],
    ['Mulk turi', re?.propertyType ?? '—'],
    ['Umumiy / yashash', `${re?.totalAreaM2 ?? '—'} / ${re?.livingAreaM2 ?? '—'} m²`],
    ['Xonalar', [re?.roomNames, re?.roomCount != null ? `(${re.roomCount})` : ''].filter(Boolean).join(' ') || '—'],
    ['Garov qiymati', formatMoney(re?.agreedValue)],
    ['KATM narxi', formatMoney(c.katmPrice)],
  ];
  return (
    <Card>
      <h2 className="mb-3 font-semibold">Ma'lumotlar</h2>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs uppercase tracking-wide text-slate-400">{k}</dt>
            <dd className="text-sm font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      {re?.owners?.length ? (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Egalar</p>
          {re.owners.map((o, i) => (
            <p key={i} className="text-sm">{o.fullName} {o.sharePercent != null ? `— ${o.sharePercent}%` : ''}</p>
          ))}
        </div>
      ) : null}
    </Card>
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
          <Input type="number" value={katm} onChange={(e) => setKatm(e.target.value)} placeholder={String(c.katmPrice ?? '')} />
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

function KatmPlaceholder() {
  return (
    <Card className="space-y-2 border-dashed">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">KATM hisobotlari</h2>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Tez kunda</span>
      </div>
      <p className="text-sm text-slate-500">
        Har ariza yoki alohida shaxs (PINFL) bo‘yicha 2–3 KATM hisobotini tekshirish shu yerda bo‘ladi.
      </p>
      <div className="space-y-2 opacity-50">
        <Button variant="secondary" className="w-full" disabled>Kredit tarixi</Button>
        <Button variant="secondary" className="w-full" disabled>Skoring</Button>
        <Button variant="secondary" className="w-full" disabled>Garov reestri</Button>
      </div>
    </Card>
  );
}
