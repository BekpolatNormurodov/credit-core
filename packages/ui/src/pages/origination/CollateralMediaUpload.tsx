import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, documentInlineUrl, viewDocument } from '@credit-core/api-client';
import { DocumentType } from '@credit-core/shared';
import { Button } from '../../components/primitives';
import { useToast } from '../../components/Toast';
import { Upload, Play, X, FileText } from '../../lib/icons';
import type { OriginationForm } from './useOriginationForm';

/** Persist files on the collateral at `colIndex` under a document type: ensure the case exists, save
 *  the line so the collateral gets an id, then upload each to it. Returns the case id (for cache
 *  invalidation) or null if the collateral has no id yet. Shared by the strips and the tex scanner. */
export async function saveCollateralMedia(
  f: OriginationForm, colIndex: number, files: File[], type: DocumentType = DocumentType.COLLATERAL_PHOTO,
): Promise<string | null> {
  const id = await f.ensureCase();
  if (!id) return null;
  await f.saveSection('creditLine');
  const c = await api.case(id);
  const col = c.collaterals[colIndex];
  if (!col?.id) return null;
  for (const file of files) await api.uploadDocument(id, type, file, { collateralId: col.id });
  return id;
}

/**
 * A per-collateral attachment strip in the wizard (optional). One instance per document type — photos/
 * videos (COLLATERAL_PHOTO) or the power of attorney (GEN_DOVERNOST). The collateral has no id until
 * saved, so the first upload persists the line, then uploads to the collateral's id (matched by index).
 */
export function CollateralAttachments({
  f, colIndex, type = DocumentType.COLLATERAL_PHOTO, accept = 'image/*,video/*', title = 'Rasm / video', max = 10,
}: { f: OriginationForm; colIndex: number; type?: DocumentType; accept?: string; title?: string; max?: number }) {
  const qc = useQueryClient();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const key = ['col-att', f.caseId, colIndex, type];

  const { data: docs = [] } = useQuery({
    queryKey: key,
    enabled: !!f.caseId,
    queryFn: async () => {
      const c = await api.case(f.caseId!);
      const col = c.collaterals[colIndex];
      if (!col?.id) return [];
      return c.documents.filter((d) => d.collateralId === col.id && d.type === type);
    },
  });
  const remaining = max - docs.length;

  const onPick = async (files: FileList | null) => {
    const picked = files ? Array.from(files) : [];
    if (!picked.length) return;
    if (picked.length > remaining) { toast.error('Ko‘p', `Ko‘pi ${max} ta — yana ${Math.max(0, remaining)} ta`); return; }
    setBusy(true);
    try {
      const id = await saveCollateralMedia(f, colIndex, picked, type);
      if (!id) { toast.error('Avval saqlang', 'Garovni saqlab, qayta urinib ko‘ring'); return; }
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ['case', id] });
      toast.success('Yuklandi', title);
    } catch { toast.error('Yuklanmadi', 'Qayta urinib ko‘ring'); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ''; }
  };
  const remove = async (docId: string) => {
    await api.deleteDocument(docId);
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ['case', f.caseId] });
  };

  return (
    <div className="space-y-2 border-t border-gray-200 pt-3 dark:border-gray-800">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-800 dark:text-white">{title} <span className="font-normal text-gray-400">— ixtiyoriy ({docs.length}/{max})</span></h4>
        {remaining > 0 && <Button variant="secondary" loading={busy} onClick={() => inputRef.current?.click()}><Upload className="h-4 w-4" /> Biriktirish</Button>}
      </div>
      <input ref={inputRef} type="file" accept={accept} multiple hidden onChange={(e) => onPick(e.target.files)} />
      {docs.length > 0 && (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {docs.map((d) => {
            const mime = d.mimeType ?? '';
            const isImg = mime.startsWith('image/');
            const isVideo = mime.startsWith('video/');
            return (
              <div key={d.id} className="group relative">
                <button type="button" onClick={() => viewDocument(d.id, d.fileName)} title={d.fileName} className="block aspect-square w-full overflow-hidden rounded-lg border border-gray-200 outline-none transition hover:border-brand-400 dark:border-gray-700">
                  {isImg
                    ? <img src={documentInlineUrl(d.id)} alt={d.fileName} className="h-full w-full object-cover" />
                    : <span className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-gray-900 text-white">{isVideo ? <Play className="h-5 w-5" /> : <FileText className="h-5 w-5" />}<span className="text-[9px] font-medium">{isVideo ? 'Video' : 'PDF'}</span></span>}
                </button>
                <button type="button" onClick={() => remove(d.id)} aria-label="O‘chirish" className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-error-600 text-white opacity-0 shadow transition group-hover:opacity-100"><X className="h-3 w-3" /></button>
              </div>
            );
          })}
        </div>
      )}
      {busy && <p className="text-[11px] text-gray-400 dark:text-gray-500">Yuklanmoqda…</p>}
    </div>
  );
}
