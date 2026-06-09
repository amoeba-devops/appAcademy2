import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, Trash2, Pencil, BadgeCheck, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useAuthStore } from '@/stores/auth.store';
import {
  useParents,
  useDeleteParent,
  useUpdateParent,
  useRegisterParentAsAmaClient,
  type ParentSummary,
} from '../hooks/use-parents';

const inputClass =
  'w-full h-9 rounded-md border border-[var(--border-subtle)] bg-canvas px-3 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent-500/40';

interface InlineEditState {
  id: string;
  parName: string;
  parRelation: string;
  parPhone: string;
  parEmail: string;
}

export function ParentListPage() {
  const { t } = useTranslation('std');
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const toast = useToast();
  const role = useAuthStore((s) => s.user?.role);
  const canRegisterAma = role === 'ADMIN' || role === 'STAFF';

  const { data, isLoading } = useParents({ q: q.length >= 2 ? q : undefined, page, limit });
  const deleteMut = useDeleteParent();
  const registerAmaMut = useRegisterParentAsAmaClient();

  const handleRegisterAma = async (p: ParentSummary) => {
    try {
      const res = await registerAmaMut.mutateAsync(p.id);
      toast.success(
        res.alreadyRegistered
          ? t('parentList.ama.alreadyRegistered', '이미 등록된 학부모입니다')
          : t('parentList.ama.success', 'AMA 고객사로 등록되었습니다'),
      );
    } catch {
      toast.error(t('parentList.ama.error', 'AMA 등록에 실패했습니다. 잠시 후 다시 시도하세요.'));
    }
  };

  const items = useMemo<ParentSummary[]>(() => data?.items ?? [], [data]);
  const total = data?.total ?? 0;

  const [edit, setEdit] = useState<InlineEditState | null>(null);
  const updateMut = useUpdateParent(edit?.id ?? '');

  const handleSaveEdit = async () => {
    if (!edit) return;
    await updateMut.mutateAsync({
      parName: edit.parName,
      parRelation: edit.parRelation || undefined,
      parPhone: edit.parPhone || undefined,
      parEmail: edit.parEmail || undefined,
    });
    setEdit(null);
  };

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
              <th className="px-3 py-2 text-left">{t('parentList.ama.column', 'AMA 고객사')}</th>
              <th className="px-3 py-2 text-right">{t('common:actions.actions', '작업')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {isLoading && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-secondary">
                  {t('common:status.loading')}
                </td>
              </tr>
            )}
            {!isLoading && items.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-secondary">
                  {t('parentList.empty', '등록된 학부모가 없습니다')}
                </td>
              </tr>
            )}
            {items.map((p) =>
              edit?.id === p.id ? (
                <tr key={p.id} className="bg-[var(--canvas-subtle)]">
                  <td className="px-3 py-2">
                    <input
                      value={edit.parName}
                      onChange={(e) => setEdit({ ...edit, parName: e.target.value })}
                      className={inputClass}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={edit.parRelation}
                      onChange={(e) => setEdit({ ...edit, parRelation: e.target.value })}
                      className={inputClass}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={edit.parPhone}
                      onChange={(e) => setEdit({ ...edit, parPhone: e.target.value })}
                      className={inputClass}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={edit.parEmail}
                      onChange={(e) => setEdit({ ...edit, parEmail: e.target.value })}
                      className={inputClass}
                    />
                  </td>
                  <td className="px-3 py-2 text-secondary">{p.childCount ?? 0}</td>
                  <td className="px-3 py-2 text-secondary">—</td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" onClick={handleSaveEdit} disabled={updateMut.isPending}>
                      {t('common:actions.save', '저장')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-1"
                      onClick={() => setEdit(null)}
                    >
                      {t('common:actions.cancel', '취소')}
                    </Button>
                  </td>
                </tr>
              ) : (
                <tr key={p.id} className="hover:bg-[var(--canvas-subtle)]">
                  <td className="px-3 py-2 font-medium text-primary">{p.name}</td>
                  <td className="px-3 py-2 text-secondary">{p.relation ?? '—'}</td>
                  <td className="px-3 py-2 text-secondary">{p.phone ?? '—'}</td>
                  <td className="px-3 py-2 text-secondary">{p.email ?? '—'}</td>
                  <td className="px-3 py-2">
                    {(p.childCount ?? 0) === 0 ? (
                      <span className="rounded-full bg-warning-50 px-2 py-0.5 text-[10px] font-semibold text-warning-700">
                        {t('parentList.orphan', '고아 (자녀 없음)')}
                      </span>
                    ) : (
                      <button
                        onClick={() => navigate(`/admin/std/parents/${p.id}`)}
                        className="text-accent hover:underline"
                      >
                        {p.childCount}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {p.amaClientId ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-status-active-bg px-2 py-0.5 text-[10px] font-semibold text-status-active-fg"
                        title={p.amaClientId}
                      >
                        <BadgeCheck className="h-3 w-3" />
                        {t('parentList.ama.registered', '등록됨')}
                      </span>
                    ) : !p.amaEligible ? (
                      <span
                        className="text-[11px] text-secondary"
                        title={t(
                          'parentList.ama.eligibleHint',
                          'ACTIVE 상태 학생을 보유한 학부모만 등록할 수 있습니다.',
                        )}
                      >
                        {t('parentList.ama.notEligible', 'ACTIVE 학생 없음')}
                      </span>
                    ) : canRegisterAma ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={registerAmaMut.isPending}
                        onClick={() => handleRegisterAma(p)}
                      >
                        <UserPlus className="mr-1 h-3 w-3" />
                        {t('parentList.ama.register', 'AMA 고객사 등록')}
                      </Button>
                    ) : (
                      <span className="text-[11px] text-secondary">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setEdit({
                          id: p.id,
                          parName: p.name,
                          parRelation: p.relation ?? '',
                          parPhone: p.phone ?? '',
                          parEmail: p.email ?? '',
                        })
                      }
                    >
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
              ),
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            {t('common:actions.prev', '이전')}
          </Button>
          <span className="text-xs text-secondary">
            {page} / {Math.ceil(total / limit)}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page * limit >= total}
            onClick={() => setPage(page + 1)}
          >
            {t('common:actions.next', '다음')}
          </Button>
        </div>
      )}
    </div>
  );
}
