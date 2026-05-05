import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStudents } from '../hooks/use-students';
import { StdFilters, type StdFilterValue } from '../components/std-filters';
import { StdTable } from '../components/std-table';
import { StdFormModal } from '../components/std-form-modal';
import { StdImportModal } from '../components/std-import-modal';

const EMPTY: StdFilterValue = {
  q: '',
  status: 'ACTIVE',
  school: '',
  grade: '',
  showInactive: false,
};

export function StdListPage() {
  const { t } = useTranslation('std');
  const [filters, setFilters] = useState<StdFilterValue>(EMPTY);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const { data, isLoading } = useStudents({
    q: filters.q || undefined,
    status: filters.status || undefined,
    school: filters.school || undefined,
    grade: filters.grade || undefined,
  });

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

      <StdFilters value={filters} onChange={setFilters} />

      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-secondary">
          {t('table.total', { count: data?.total ?? 0 })}
        </p>
      </div>

      <StdTable items={data?.items ?? []} isLoading={isLoading} />

      <StdFormModal open={showCreate} onClose={() => setShowCreate(false)} />
      <StdImportModal open={showImport} onClose={() => setShowImport(false)} />
    </div>
  );
}
