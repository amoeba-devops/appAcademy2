import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';
import { GuidelineCreateDialog } from '@/modules/ref/components/guideline-create-dialog';

interface Guideline {
  id: string;
  code: string;
  examType: string;
  labelKr: string;
  labelEn?: string | null;
  versionNo: number;
  effectiveFrom: string;
  dataStatus: string;
  workflowSteps?: unknown[] | null;
}

export function GuidelineList() {
  const { t } = useTranslation(['ref', 'common']);
  const { data, isLoading } = useQuery({
    queryKey: ['ref', 'guidelines'],
    queryFn: async () => {
      const res = await apiClient.get<Guideline[]>('/acm/ref/class-guidelines');
      return res.data;
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">{t('tabs.guidelines')}</h2>
        <GuidelineCreateDialog />
      </div>
      {isLoading && <p className="text-secondary">{t('common:status.loading')}</p>}
      {!isLoading && (data?.length ?? 0) === 0 && (
        <p className="text-secondary py-12 text-center">{t('empty.guidelines')}</p>
      )}
      {(data?.length ?? 0) > 0 && (
        <div className="rounded-lg bg-surface border border-[var(--border-subtle)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--gray-100)] text-secondary">
              <tr>
                <th className="text-left px-4 py-3">{t('table.code')}</th>
                <th className="text-left px-4 py-3">{t('table.examType')}</th>
                <th className="text-left px-4 py-3">{t('table.label')}</th>
                <th className="text-left px-4 py-3">{t('table.stepsCount')}</th>
                <th className="text-left px-4 py-3">{t('table.version')}</th>
                <th className="text-left px-4 py-3">{t('table.status')}</th>
                <th className="text-left px-4 py-3">{t('table.effectiveFrom')}</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((g) => (
                <tr key={g.id} className="border-t border-[var(--border-subtle)]">
                  <td className="px-4 py-3 font-mono text-xs">{g.code}</td>
                  <td className="px-4 py-3">{t(`examType.${g.examType}`)}</td>
                  <td className="px-4 py-3">{g.labelKr}</td>
                  <td className="px-4 py-3">
                    {Array.isArray(g.workflowSteps) ? g.workflowSteps.length : 0}
                  </td>
                  <td className="px-4 py-3">v{g.versionNo}</td>
                  <td className="px-4 py-3">{t(`dataStatus.${g.dataStatus}`)}</td>
                  <td className="px-4 py-3">{g.effectiveFrom}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
