import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useMpqList, useDeleteMpq } from '../hooks/use-mpq';
import { MpqFilters, type MpqFilterValue } from '../components/mpq-filters';
import { MpqTable } from '../components/mpq-table';
import { MpqFormModal } from '../components/mpq-form-modal';
import { MpqImportModal } from '../components/mpq-import-modal';

const EMPTY: MpqFilterValue = {
  q: '',
  grade: 'ALL',
  hasAnswer: 'ALL',
  paired: false,
  status: 'ALL',
};

export function MpqListPage() {
  const { t } = useTranslation('mpq');
  const [filters, setFilters] = useState<MpqFilterValue>(EMPTY);
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const confirm = useConfirm();

  const { data, isLoading } = useMpqList({
    q: filters.q || undefined,
    grade: filters.grade,
    hasAnswer: filters.hasAnswer,
    paired: filters.paired || undefined,
    status: filters.status,
    page,
    limit: 20,
  });

  const deleteMut = useDeleteMpq();

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
            <Upload size={14} className="mr-1" />
            {t('actions.import')}
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={14} className="mr-1" />
            {t('actions.create')}
          </Button>
        </div>
      </div>

      <MpqFilters value={filters} onChange={(v) => { setFilters(v); setPage(1); }} />

      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-secondary">{t('table.total', { count: total })}</p>
        <div className="flex items-center gap-2 text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded border border-[var(--border-subtle)] px-2 py-1 disabled:opacity-40"
          >
            ‹
          </button>
          <span className="text-secondary">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border border-[var(--border-subtle)] px-2 py-1 disabled:opacity-40"
          >
            ›
          </button>
        </div>
      </div>

      <MpqTable
        items={data?.items ?? []}
        isLoading={isLoading}
        onEdit={(id) => setEditId(id)}
        onDelete={async (item) => {
          const ok = await confirm({
            title: t('delete.title'),
            description: t('delete.description', { no: item.externalNo }),
            confirmLabel: t('common:actions.delete'),
            variant: 'destructive',
          });
          if (ok) await deleteMut.mutateAsync(item.id);
        }}
      />

      <MpqFormModal open={showCreate} onClose={() => setShowCreate(false)} />
      <MpqFormModal
        open={!!editId}
        editId={editId}
        onClose={() => setEditId(null)}
      />
      <MpqImportModal open={showImport} onClose={() => setShowImport(false)} />
    </div>
  );
}
