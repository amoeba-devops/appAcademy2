import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Download, FileText, Loader2 } from 'lucide-react';
import { portalApi, type PortalMaterial } from '../api/portal-api';

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function PortalMaterialsPage() {
  const { t, i18n } = useTranslation('common');
  const { data: materials = [], isLoading } = useQuery({
    queryKey: ['portal-materials'],
    queryFn: portalApi.materials,
  });
  const [downloading, setDownloading] = useState<string | null>(null);

  const onDownload = async (m: PortalMaterial) => {
    setDownloading(m.id);
    try {
      await portalApi.downloadMaterial(m.id, m.filename);
    } finally {
      setDownloading(null);
    }
  };

  // group by class
  const groups = materials.reduce<Record<string, PortalMaterial[]>>((acc, m) => {
    const k = m.className ?? '—';
    (acc[k] ??= []).push(m);
    return acc;
  }, {});

  return (
    <div>
      <h1 className="mb-3 text-lg font-semibold text-primary">
        {t('portalApp.nav.materials')}
      </h1>
      {isLoading ? (
        <p className="py-6 text-center text-sm text-secondary">…</p>
      ) : materials.length === 0 ? (
        <p className="rounded-md border border-[var(--border-subtle)] p-6 text-center text-sm text-secondary">
          {t('portalApp.materials.empty')}
        </p>
      ) : (
        <div className="space-y-4">
          {Object.entries(groups).map(([cls, items]) => (
            <div key={cls} className="rounded-md border border-[var(--border-subtle)]">
              <div className="border-b border-[var(--border-subtle)] bg-[var(--gray-50)] px-3 py-1.5 text-sm font-medium text-primary">
                {cls}
              </div>
              {items.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-3 py-2 last:border-b-0"
                >
                  <FileText size={16} className="shrink-0 text-secondary" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-primary">{m.title}</div>
                    <div className="text-xs text-secondary">
                      {fmtSize(m.sizeBytes)} ·{' '}
                      {new Date(m.createdAt).toLocaleDateString(i18n.language)}
                    </div>
                  </div>
                  <button
                    onClick={() => onDownload(m)}
                    disabled={downloading === m.id}
                    className="inline-flex items-center gap-1 rounded border border-[var(--border-subtle)] px-2 py-1 text-xs text-accent-700 hover:bg-[var(--gray-50)]"
                  >
                    {downloading === m.id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Download size={12} />
                    )}
                    {t('portalApp.materials.download')}
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
