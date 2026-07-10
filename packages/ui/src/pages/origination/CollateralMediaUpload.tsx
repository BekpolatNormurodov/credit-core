import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, documentInlineUrl, viewDocument } from '@credit-core/api-client';
import { DocumentType } from '@credit-core/shared';
import { Button } from '../../components/primitives';
import { useToast } from '../../components/Toast';
import { Upload, Play, X } from '../../lib/icons';
import type { OriginationForm } from './useOriginationForm';

const MAX = 10;
const isMedia = (m?: string | null) => { const x = m ?? ''; return x.startsWith('image/') || x.startsWith('video/'); };

/**
 * Per-collateral photos/videos in the wizard (optional, max 10). The collateral has no id until it's
 * saved, so the first upload ensures the case exists, persists the line/collaterals, then uploads to
 * the matching collateral's id (by index). Existing media is read back from the saved case.
 */
export function CollateralMediaUpload({ f, colIndex }: { f: OriginationForm; colIndex: number }) {
  const qc = useQueryClient();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const { data: media = [] } = useQuery({
    queryKey: ['col-media', f.caseId, colIndex],
    enabled: !!f.caseId,
    queryFn: async () => {
      const c = await api.case(f.caseId!);
      const col = c.collaterals[colIndex];
      if (!col?.id) return [];
      return c.documents.filter((d) => d.collateralId === col.id && (isMedia(d.mimeType) || d.type === DocumentType.COLLATERAL_PHOTO));
    },
  });
  const remaining = MAX - media.length;

  const onPick = async (files: FileList | null) => {
    const picked = files ? Array.from(files) : [];
    if (!picked.length) return;
    if (picked.length > remaining) { toast.error('Ko‘p', `Ko‘pi ${MAX} ta — yana ${Math.max(0, remaining)} ta`); return; }
    setBusy(true);
    try {
      const id = await f.ensureCase();
      if (!id) throw new Error('no case');
      await f.saveSection('creditLine'); // persist collaterals so this one gets an id
      const c = await api.case(id);
      const col = c.collaterals[colIndex];
      if (!col?.id) { toast.error('Avval saqlang', 'Garovni saqlab, qayta urinib ko‘ring'); return; }
      for (const file of picked) await api.uploadDocument(id, DocumentType.COLLATERAL_PHOTO, file, { collateralId: col.id });
      qc.invalidateQueries({ queryKey: ['col-media', id, colIndex] });
      qc.invalidateQueries({ queryKey: ['case', id] });
      toast.success('Yuklandi', 'Garov rasm/videolari');
    } catch { toast.error('Yuklanmadi', 'Qayta urinib ko‘ring'); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ''; }
  };

  const remove = async (docId: string) => {
    await api.deleteDocument(docId);
    qc.invalidateQueries({ queryKey: ['col-media', f.caseId, colIndex] });
    qc.invalidateQueries({ queryKey: ['case', f.caseId] });
  };

  return (
    <div className="space-y-2 border-t border-gray-200 pt-4 dark:border-gray-800">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-800 dark:text-white">Rasm / video <span className="font-normal text-gray-400">— ixtiyoriy, ko‘pi {MAX} ta ({media.length}/{MAX})</span></h4>
        {remaining > 0 && <Button variant="secondary" loading={busy} onClick={() => inputRef.current?.click()}><Upload className="h-4 w-4" /> Rasm / video</Button>}
      </div>
      <input ref={inputRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => onPick(e.target.files)} />
      {media.length > 0 && (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {media.map((d) => {
            const isVideo = (d.mimeType ?? '').startsWith('video/');
            return (
              <div key={d.id} className="group relative">
                <button type="button" onClick={() => viewDocument(d.id, d.fileName)} title={d.fileName} className="block aspect-square w-full overflow-hidden rounded-lg border border-gray-200 outline-none transition hover:border-brand-400 dark:border-gray-700">
                  {isVideo
                    ? <span className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-gray-900 text-white"><Play className="h-5 w-5" /><span className="text-[9px] font-medium">Video</span></span>
                    : <img src={documentInlineUrl(d.id)} alt={d.fileName} className="h-full w-full object-cover" />}
                </button>
                <button type="button" onClick={() => remove(d.id)} aria-label="O‘chirish" className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-error-600 text-white opacity-0 shadow transition group-hover:opacity-100"><X className="h-3 w-3" /></button>
              </div>
            );
          })}
        </div>
      )}
      {busy && <p className="text-[11px] text-gray-400 dark:text-gray-500">Yuklanmoqda…</p>}
      {!f.caseId && media.length === 0 && !busy && <p className="text-[11px] text-gray-400 dark:text-gray-500">Fayl tanlansangiz ariza avtomatik saqlanadi va rasm biriktiriladi.</p>}
    </div>
  );
}
