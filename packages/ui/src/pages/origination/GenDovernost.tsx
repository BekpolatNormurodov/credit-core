import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, documentInlineUrl, viewDocument } from '@credit-core/api-client';
import { DocumentType, type DocumentDto } from '@credit-core/shared';
import { Button } from '../../components/primitives';
import { useToast } from '../../components/Toast';
import { FileText, X } from '../../lib/icons';
import type { OriginationForm } from './useOriginationForm';

/**
 * Gen doverennost (umumiy ishonchnoma) upload — PDF or one/several images. Files persist as case
 * documents (type GEN_DOVERNOST); the case is created on first upload if it doesn't exist yet.
 * Uploaded files preview as thumbnails (image) or a PDF card; click opens inline in a new tab.
 */
export function GenDovernostUpload({ f }: { f: OriginationForm }) {
  const qc = useQueryClient();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  // Fetched under a dedicated key so refreshing the doc list never resets the wizard form state.
  const { data: docs = [] } = useQuery({
    queryKey: ['gendov-docs', f.caseId],
    enabled: !!f.caseId,
    queryFn: async () => (await api.case(f.caseId!)).documents.filter((d) => d.type === DocumentType.GEN_DOVERNOST),
  });

  const onPick = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const id = await f.ensureCase();
      if (!id) throw new Error('no case');
      for (const file of Array.from(files)) await api.uploadDocument(id, DocumentType.GEN_DOVERNOST, file);
      await qc.invalidateQueries({ queryKey: ['gendov-docs', id] });
      toast.success('Yuklandi', 'Gen doverennost');
    } catch {
      toast.error('Yuklanmadi', 'Qayta urinib ko‘ring');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = async (d: DocumentDto) => {
    await api.deleteDocument(d.id);
    qc.invalidateQueries({ queryKey: ['gendov-docs', f.caseId] });
  };

  const isImg = (d: DocumentDto) => (d.mimeType ?? '').startsWith('image/');

  return (
    <div className="space-y-3 border-t border-gray-200 pt-4 dark:border-gray-800">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-800 dark:text-white">Gen doverennost (ishonchnoma) <span className="font-normal text-gray-400">— ixtiyoriy</span></h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">PDF yoki rasm(lar) — bir nechta yuklasa bo‘ladi. Majburiy emas.</p>
        </div>
        <Button variant="secondary" loading={busy} onClick={() => inputRef.current?.click()}>Yuklash</Button>
        <input ref={inputRef} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => onPick(e.target.files)} />
      </div>
      {docs.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {docs.map((d) => (
            <div key={d.id} className="group relative">
              <button
                type="button"
                onClick={() => viewDocument(d.id, d.fileName)}
                title={d.fileName}
                className="block h-24 w-24 overflow-hidden rounded-lg border border-gray-200 transition hover:border-brand-400 dark:border-gray-700"
              >
                {isImg(d) ? (
                  <img src={documentInlineUrl(d.id)} alt={d.fileName} className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gray-50 text-gray-500 dark:bg-white/5 dark:text-gray-400">
                    <FileText className="h-6 w-6" />
                    <span className="text-[10px] font-medium">PDF</span>
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => remove(d)}
                aria-label="O‘chirish"
                className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-error-600 text-white opacity-0 shadow transition group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {!f.caseId && <p className="text-xs text-gray-400 dark:text-gray-500">Fayl tanlansa ariza avtomatik saqlanadi.</p>}
    </div>
  );
}
