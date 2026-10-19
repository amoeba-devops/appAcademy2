import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { FilterBar, ResultBar } from '@/components/ui/section';
import { useTeachers } from '../hooks/use-teachers';
import { TchTable } from '../components/tch-table';
import { TchFormModal } from '../components/tch-form-modal';
import type { TeacherDetail } from '../types';

export function TchListPage() {
  const { t } = useTranslation('tch');
  const { t: tc } = useTranslation('common');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string>('ACTIVE');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TeacherDetail | undefined>(undefined);

  const { data, isLoading } = useTeachers({
    q: q || undefined,
    status: status || undefined,
  });

  const onEdit = (teacher: TeacherDetail) => {
    setEditing(teacher);
    setShowForm(true);
  };

  const onClose = () => {
    setShowForm(false);
    setEditing(undefined);
  };

  return (
    <div>
      <PageHeader
        icon={UserCog}
        title={tc('nav.tch')}
        description={tc('pageHeader.tch.desc')}
        actions={
          <Button size="sm" onClick={() => { setEditing(undefined); setShowForm(true); }}>
            <Plus size={14} className="mr-1" />
            {t('actions.create')}
          </Button>
        }
      />

      <FilterBar>
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
          <option value="LEAVE">{t('status.LEAVE')}</option>
          <option value="RESIGNED">{t('status.RESIGNED')}</option>
          <option value="ALL">{t('filter.all')}</option>
        </select>
      </FilterBar>

      <ResultBar>{t('table.total', { count: data?.total ?? 0 })}</ResultBar>

      <TchTable items={data?.items ?? []} isLoading={isLoading} onRowClick={onEdit} />

      <TchFormModal open={showForm} onClose={onClose} initial={editing} />
    </div>
  );
}
