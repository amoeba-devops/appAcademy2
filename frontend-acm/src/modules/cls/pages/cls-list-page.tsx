import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useClasses } from '../hooks/use-classes';
import type { ClassSummary } from '../types';
import { ClsFilters, type ClsFilterValue } from '../components/cls-filters';
import { ClsTable } from '../components/cls-table';

const EMPTY: ClsFilterValue = {
  status: '',
  subjectType: '',
  teacher: '',
  search: '',
};

export function ClsListPage() {
  const { t } = useTranslation(['cls', 'common']);
  const [filters, setFilters] = useState<ClsFilterValue>(EMPTY);

  const { data, isLoading } = useClasses({
    status: filters.status || undefined,
    subjectType: filters.subjectType || undefined,
    teacherUserId: filters.teacher || undefined,
  });

  const filtered = useMemo<ClassSummary[]>(() => {
    const items = data?.items ?? [];
    const q = filters.search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((c) => {
      const codeHit = c.code.toLowerCase().includes(q);
      const teacherHit = (c.teacherName ?? '').toLowerCase().includes(q);
      return codeHit || teacherHit;
    });
  }, [data, filters.search]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <Button disabled title={t('common:todo')}>
          <Plus size={16} className="mr-1" />
          {t('actions.createClass')}
        </Button>
      </div>

      <ClsFilters value={filters} onChange={setFilters} />

      {isLoading ? (
        <p className="text-secondary">{t('common:status.loading')}</p>
      ) : (
        <ClsTable items={filtered} isLoading={isLoading} />
      )}
    </div>
  );
}
