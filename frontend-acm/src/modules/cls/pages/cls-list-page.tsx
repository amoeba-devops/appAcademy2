import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useClasses } from '../hooks/use-classes';
import type { ClassCreatePrefill, ClassSummary } from '../types';
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
  const location = useLocation();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<ClsFilterValue>(EMPTY);
  const [createOpen, setCreateOpen] = useState(false);
  // Snapshot the router-state prefill once on mount. We intentionally hold it
  // in component state (not derived from `location`) so that clearing the
  // router state below does not null it out before the dialog consumes it.
  const [prefill, setPrefill] = useState<ClassCreatePrefill | null>(
    () =>
      (location.state as { createClassPrefill?: ClassCreatePrefill } | null)
        ?.createClassPrefill ?? null,
  );

  useEffect(() => {
    if (!prefill) return;
    setCreateOpen(true);
    // Clear the router state so a refresh / back navigation does not re-trigger
    // the prefill; the snapshot above keeps it available for the dialog.
    navigate(location.pathname, { replace: true, state: null });
    // Run once on mount — `prefill` is a stable snapshot, not location-derived.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        onOpenChange={(next) => {
          setCreateOpen(next);
          // Drop the prefill snapshot once the dialog closes so a subsequent
          // manual "+ Create" opens a clean form.
          if (!next) setPrefill(null);
        }}
        onCreated={(classId) => navigate(`/admin/cls/${classId}`)}
        prefill={prefill}
      />
    </div>
  );
}
