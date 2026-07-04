import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useClasses } from '../hooks/use-classes';
import type { ClassSummary } from '../types';
import { ClsFilters, type ClsFilterValue } from '../components/cls-filters';
import { ClsTable } from '../components/cls-table';
import { ClassCreateDialog } from '../components/class-create-dialog';

const EMPTY: ClsFilterValue = {
  status: '',
  subjectType: '',
  teacher: '',
  search: '',
};

export function ClsListPage() {
  const { t } = useTranslation(['cls', 'common']);
  const navigate = useNavigate();
  const [filters, setFilters] = useState<ClsFilterValue>(EMPTY);
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useClasses({
    status: filters.status || undefined,
    subjectType: filters.subjectType || undefined,
  });

  const filtered = useMemo<ClassSummary[]>(() => {
    const items = data?.items ?? [];
    const q = filters.search.trim().toLowerCase();
    const teacherQuery = filters.teacher.trim().toLowerCase();
    return items.filter((c) => {
      const matchesTeacher = !teacherQuery
        ? true
        : (c.teacherName ?? '').toLowerCase().includes(teacherQuery);
      if (!q) return matchesTeacher;
      const codeHit = c.code.toLowerCase().includes(q);
      const teacherHit = (c.teacherName ?? '').toLowerCase().includes(q);
      const subjectHit = (c.subjectLabel ?? '').toLowerCase().includes(q);
      return matchesTeacher && (codeHit || teacherHit || subjectHit);
    });
  }, [data, filters.search, filters.teacher]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <Button onClick={() => setCreateOpen(true)}>
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

      <ClassCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(classId) => navigate(`/admin/cls/${classId}`)}
      />
    </div>
  );
}
