import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStudents } from '../hooks/use-students';
import { StdFilters, type StdFilterValue } from '../components/std-filters';
import { StdTable, type StdSort } from '../components/std-table';
import { StdFormModal } from '../components/std-form-modal';
import { StdImportModal } from '../components/std-import-modal';
import type { StudentCreatePrefill } from '../types';

const EMPTY: StdFilterValue = {
  q: '',
  status: 'ACTIVE',
  school: '',
  grade: '',
  showInactive: false,
};

export function StdListPage() {
  const { t } = useTranslation('std');
  const location = useLocation();
  const navigate = useNavigate();

  const navPrefill = (location.state as { studentCreatePrefill?: StudentCreatePrefill } | null)
    ?.studentCreatePrefill;

  const [filters, setFilters] = useState<StdFilterValue>(EMPTY);
  // PLN-260714 — 기본 정렬은 최신등록일순(createdAt DESC).
  const [sort, setSort] = useState<StdSort>({ field: 'createdAt', dir: 'desc' });
  const [prefill, setPrefill] = useState<StudentCreatePrefill | undefined>(navPrefill);
  const [showCreate, setShowCreate] = useState(!!navPrefill);
  const [showImport, setShowImport] = useState(false);

  // 상담(CSL)에서 프리필과 함께 넘어온 경우 폼을 자동으로 열고, 뒤로가기/새로고침 시
  // 재오픈되지 않도록 라우터 state를 제거한다. (cls-list-page 패턴 참고)
  useEffect(() => {
    if (navPrefill) {
      navigate(location.pathname, { replace: true, state: null });
    }
    // 최초 진입 시 한 번만 실행
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data, isLoading } = useStudents({
    q: filters.q || undefined,
    status: filters.status || undefined,
    school: filters.school || undefined,
    grade: filters.grade || undefined,
    sort: sort.field,
    dir: sort.dir,
  });

  const handleSort = (field: StdSort['field']) => {
    setSort((prev) =>
      prev.field === field
        ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { field, dir: 'asc' },
    );
  };

  const openManualCreate = () => {
    setPrefill(undefined);
    setShowCreate(true);
  };

  const closeCreate = () => {
    setShowCreate(false);
    setPrefill(undefined);
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
            <Upload size={14} className="mr-1" />
            {t('actions.import')}
          </Button>
          <Button size="sm" onClick={openManualCreate}>
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

      <StdTable
        items={data?.items ?? []}
        isLoading={isLoading}
        sort={sort}
        onSort={handleSort}
      />

      {/* create 모달은 열 때마다 새로 마운트해 prefill 기본값을 확실히 반영한다 */}
      {showCreate && <StdFormModal open onClose={closeCreate} prefill={prefill} />}
      <StdImportModal open={showImport} onClose={() => setShowImport(false)} />
    </div>
  );
}
