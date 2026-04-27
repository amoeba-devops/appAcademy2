import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';
import { LevelTestCreateDialog } from '@/modules/ref/components/level-test-create-dialog';

interface Lvl {
  id: string;
  examType: string;
  gradeBasis: string;
  resourceType?: string | null;
  resourceUrl?: string | null;
  defaultDurationMin?: number | null;
  versionNo: number;
  effectiveFrom: string;
  procedureSteps?: unknown[] | null;
}

export function LevelTestList() {
  const { t } = useTranslation(['ref', 'common']);
  const { data, isLoading } = useQuery({
    queryKey: ['ref', 'levelTests'],
    queryFn: async () => {
      const res = await apiClient.get<Lvl[]>('/acm/ref/level-test-guides');
      return res.data;
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">{t('tabs.levelTests')}</h2>
        <LevelTestCreateDialog />
      </div>
      {isLoading && <p className="text-secondary">{t('common:status.loading')}</p>}
      {!isLoading && (data?.length ?? 0) === 0 && (
        <p className="text-secondary py-12 text-center">{t('empty.levelTests')}</p>
      )}
      {(data?.length ?? 0) > 0 && (
        <div className="rounded-lg bg-surface border border-[var(--border-subtle)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--gray-100)] text-secondary">
              <tr>
                <th className="text-left px-4 py-3">{t('table.examType')}</th>
                <th className="text-left px-4 py-3">{t('table.gradeBasis')}</th>
                <th className="text-left px-4 py-3">{t('form.resourceType')}</th>
                <th className="text-left px-4 py-3">{t('form.defaultDurationMin')}</th>
                <th className="text-left px-4 py-3">{t('table.stepsCount')}</th>
                <th className="text-left px-4 py-3">{t('table.version')}</th>
                <th className="text-left px-4 py-3">{t('table.effectiveFrom')}</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((l) => (
                <tr key={l.id} className="border-t border-[var(--border-subtle)]">
                  <td className="px-4 py-3">{t(`lvlExamType.${l.examType}`)}</td>
                  <td className="px-4 py-3">{t(`gradeBasis.${l.gradeBasis}`)}</td>
                  <td className="px-4 py-3">
                    {l.resourceType ? t(`resourceType.${l.resourceType}`) : '—'}
                  </td>
                  <td className="px-4 py-3">{l.defaultDurationMin ?? '—'}</td>
                  <td className="px-4 py-3">
                    {Array.isArray(l.procedureSteps) ? l.procedureSteps.length : 0}
                  </td>
                  <td className="px-4 py-3">v{l.versionNo}</td>
                  <td className="px-4 py-3">{l.effectiveFrom}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
