import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, FileText, Loader2, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  downloadMaterial,
  useClassMaterials,
  useDeleteMaterial,
  useUploadMaterial,
} from '../hooks/use-materials';

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** PLN-260706 §4.5 — teacher/admin materials panel on the class detail page. */
export function MaterialsPanel({ clsId }: { clsId: string }) {
  const { t, i18n } = useTranslation('common');
  const { data: materials = [], isLoading } = useClassMaterials(clsId);
  const upload = useUploadMaterial(clsId);
  const del = useDeleteMaterial(clsId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await upload.mutateAsync({ file, title: title.trim() || undefined });
    setTitle('');
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="rounded-lg border border-[var(--border-subtle)] p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-secondary">
        {t('material.title')}
      </h3>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('material.titlePlaceholder')}
          className="h-8 min-w-[12rem] flex-1 rounded-md border border-[var(--border-subtle)] px-2 text-sm"
        />
        <input ref={fileRef} type="file" className="hidden" onChange={onFile} />
        <Button
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={upload.isPending}
        >
          {upload.isPending ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="mr-1 h-3.5 w-3.5" />
          )}
          {t('material.upload')}
        </Button>
      </div>
      <p className="mb-3 text-xs text-secondary">{t('material.uploadHint')}</p>

      {isLoading ? (
        <p className="py-3 text-center text-sm text-secondary">…</p>
      ) : materials.length === 0 ? (
        <p className="py-3 text-center text-sm text-secondary">{t('material.empty')}</p>
      ) : (
        <ul className="divide-y divide-[var(--border-subtle)] rounded-md border border-[var(--border-subtle)]">
          {materials.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-3 py-2">
              <FileText size={16} className="shrink-0 text-secondary" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-primary">{m.title}</div>
                <div className="text-xs text-secondary">
                  {fmtSize(m.sizeBytes)} ·{' '}
                  {new Date(m.createdAt).toLocaleDateString(i18n.language)}
                </div>
              </div>
              <button
                onClick={() => downloadMaterial(m.id, m.filename)}
                className="rounded p-1 text-accent-700 hover:bg-[var(--gray-50)]"
                title={t('material.download')}
              >
                <Download size={14} />
              </button>
              <button
                onClick={() => del.mutate(m.id)}
                disabled={del.isPending}
                className="rounded p-1 text-red-600 hover:bg-red-50"
                title={t('material.delete')}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
