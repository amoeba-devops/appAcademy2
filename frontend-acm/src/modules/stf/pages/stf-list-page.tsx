import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStaff } from '../hooks/use-staff';
import { StfTable } from '../components/stf-table';
import { StfFormModal } from '../components/stf-form-modal';
import type { StaffDetail } from '../types';

export function StfListPage() {
  const { t } = useTranslation('stf');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string>('ACTIVE');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<StaffDetail | undefined>(undefined);

  const { data, isLoading } = useStaff({
    q: q || undefined,
    status: status || undefined,
  });

  const onEdit = (s: StaffDetail) => {
    setEditing(s);
    setShowForm(true);
  };

  const onClose = () => {
    setShowForm(false);
    setEditing(undefined);
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <Button size="sm" onClick={() => { setEditing(undefined); setShowForm(true); }}>
          <Plus size={14} className="mr-1" />
          {t('actions.create')}
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('filter.searchPlaceholder')}
            className="h-9 w-64 rounded-md border border-[var(--border-subtle)] bg-canvas pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/40"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 rounded-md border border-[var(--border-subtle)] bg-canvas px-3 text-sm"
        >
          <option value="ACTIVE">{t('status.ACTIVE')}</option>
          <option value="INACTIVE">{t('status.INACTIVE')}</option>
          <option value="ALL">{t('filter.all')}</option>
        </select>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-secondary">
          {t('table.total', { count: data?.total ?? 0 })}
        </p>
      </div>

      <StfTable items={data?.items ?? []} isLoading={isLoading} onRowClick={onEdit} />

      <StfFormModal open={showForm} onClose={onClose} initial={editing} />
    </div>
  );
}
