import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, Trash2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ParentEditModal } from '../components/parent-edit-modal';
import {
  useParents,
  useDeleteParent,
  type ParentSummary,
} from '../hooks/use-parents';

const inputClass =
  'w-full h-9 rounded-md border border-[var(--border-subtle)] bg-canvas px-3 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent-500/40';

export function ParentListPage() {
  const { t } = useTranslation('std');
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useParents({ q: q.length >= 2 ? q : undefined, page, limit });
  const deleteMut = useDeleteParent();

  const items = useMemo<ParentSummary[]>(() => data?.items ?? [], [data]);
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  // REQ-260729-3 — 수정은 인라인 행 편집 대신 모달로 처리.
  const [editing, setEditing] = useState<ParentSummary | null>(null);

  // REQ-260619 — render linked student names (ACTIVE highlighted, others dimmed);
  // each name links to the student detail page. Falls back to count for the
  // soft-deleted-student edge case, or an orphan badge when no children.
  const renderChildren = (p: ParentSummary) => {
    const kids = p.children ?? [];
    const count = p.childCount ?? 0;
    if (count === 0) {
      return (
        <span className="rounded-full bg-warning-50 px-2 py-0.5 text-[10px] font-semibold text-warning-700">
          {t('parentList.orphan', '고아 (자녀 없음)')}
        </span>
      );
    }
    if (kids.length === 0) {
      return <span className="text-secondary">{count}</span>;
    }
    return (
      <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
        {kids.map((c, i) => (
          <span key={c.id} className="inline-flex items-center">
            <button
              onClick={() => navigate(`/admin/std/${c.id}`)}
              title={c.status}
              className={
                'hover:underline ' +
                (c.status === 'ACTIVE' ? 'text-accent' : 'text-secondary opacity-60')
              }
            >
              {c.name}
            </button>
            {i < kids.length - 1 && <span className="text-secondary">,</span>}
          </span>
        ))}
        <span className="text-secondary">({kids.length})</span>
      </div>
    );
  };

  // 페이지 번호 윈도우 (현재 페이지 중심 최대 5개)
  const pageNumbers = useMemo(() => {
    const window = 5;
    let start = Math.max(1, page - Math.floor(window / 2));
    const end = Math.min(totalPages, start + window - 1);
    start = Math.max(1, end - window + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [page, totalPages]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('parentList.title', '학부모 관리')}</h1>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <div className="relative w-80">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder={t('parentList.searchPlaceholder', '이름, 전화번호 또는 이메일')}
            className={inputClass + ' pl-8'}
          />
        </div>
        <span className="text-xs text-secondary">
          {t('table.total', '총 {{count}}명', { count: total })}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--canvas-subtle)] text-xs uppercase text-secondary">
            <tr>
              <th className="px-3 py-2 text-left">{t('field.parentName', '이름')}</th>
              <th className="px-3 py-2 text-left">{t('field.parentRelation', '관계')}</th>
              <th className="px-3 py-2 text-left">{t('field.parentPhone', '전화번호')}</th>
              <th className="px-3 py-2 text-left">{t('field.parentEmail', '이메일')}</th>
              <th className="px-3 py-2 text-left">{t('parentList.childCount', '연결 자녀')}</th>
              <th className="px-3 py-2 text-right">{t('common:actions.actions', '작업')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {isLoading && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-secondary">
                  {t('common:status.loading')}
                </td>
              </tr>
            )}
            {!isLoading && items.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-secondary">
                  {t('parentList.empty', '등록된 학부모가 없습니다')}
                </td>
              </tr>
            )}
            {items.map((p) => (
              <tr key={p.id} className="hover:bg-[var(--canvas-subtle)]">
                <td className="px-3 py-2 font-medium text-primary">{p.name}</td>
                <td className="px-3 py-2 text-secondary">{p.relation ?? '—'}</td>
                <td className="px-3 py-2 text-secondary">{p.phone ?? '—'}</td>
                <td className="px-3 py-2 text-secondary">{p.email ?? '—'}</td>
                <td className="px-3 py-2">{renderChildren(p)}</td>
                <td className="px-3 py-2 text-right">
                  <Button size="sm" variant="outline" onClick={() => setEditing(p)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-1"
                    disabled={(p.childCount ?? 0) > 0 || deleteMut.isPending}
                    title={
                      (p.childCount ?? 0) > 0
                        ? t('parentList.cannotDeleteLinked', '연결된 자녀가 있어 삭제할 수 없습니다')
                        : ''
                    }
                    onClick={() => {
                      if (confirm(t('parentList.confirmDelete', '학부모를 삭제하시겠습니까?'))) {
                        deleteMut.mutate(p.id);
                      }
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination — REQ-260729-3: 번호형 페이저 상시 노출 */}
      {total > 0 && (
        <div className="flex items-center justify-end gap-1">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            {t('common:actions.prev', '이전')}
          </Button>
          {pageNumbers.map((n) => (
            <Button
              key={n}
              size="sm"
              variant={n === page ? 'default' : 'outline'}
              className="min-w-9 px-2"
              onClick={() => setPage(n)}
            >
              {n}
            </Button>
          ))}
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            {t('common:actions.next', '다음')}
          </Button>
        </div>
      )}

      <ParentEditModal parent={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
