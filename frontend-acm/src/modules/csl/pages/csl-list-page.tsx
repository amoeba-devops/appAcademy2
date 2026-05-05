import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/lib/api-client';
import { CslCreateDialog } from '@/modules/csl/components/csl-create-dialog';

interface Inquiry {
  id: string;
  seqNo: number;
  studentName: string;
  isAnonymous: boolean;
  schoolFreetext?: string | null;
  grade?: string | null;
  inflowType: 'HOMEPAGE' | 'KAKAO_CHANNEL' | 'PHONE';
  applyType: 'COUNSELING_ONLY' | 'EXAM_ONLY' | 'BOTH';
  currentStage:
    | 'INTAKE'
    | 'MAP_TEST'
    | 'TRIAL_CLASS'
    | 'ENROLLMENT_COUNSELING'
    | 'PAYMENT'
    | 'CLASS_STARTED'
    | 'DROPPED';
  registeredAt: string;
  followupAt?: string | null;
  createdAt: string;
}

export function CslListPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation(['csl', 'common']);
  const { data, isLoading } = useQuery({
    queryKey: ['csl', 'list'],
    queryFn: async () => {
      const res = await apiClient.get<Inquiry[] | { items: Inquiry[]; total: number }>(
        '/acm/csl/inquiries',
      );
      const payload = res.data;
      return Array.isArray(payload) ? { items: payload } : payload;
    },
  });

  const localeMap: Record<string, string> = { ko: 'ko-KR', en: 'en-US', vi: 'vi-VN' };
  const dateLocale = localeMap[i18n.language?.slice(0, 2) ?? 'ko'] ?? 'ko-KR';
  const dash = t('common:dash');

  const stageBadgeClass = (stage: Inquiry['currentStage']) => {
    if (stage === 'DROPPED') return 'bg-[var(--gray-200)] text-secondary';
    if (stage === 'CLASS_STARTED') return 'bg-emerald-50 text-emerald-700';
    if (stage === 'PAYMENT') return 'bg-amber-50 text-amber-700';
    return 'bg-accent-50 text-accent-700';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <CslCreateDialog />
      </div>
      {isLoading && <p className="text-secondary">{t('common:status.loading')}</p>}
      <div className="rounded-lg bg-surface border border-[var(--border-subtle)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--gray-100)] text-secondary">
            <tr>
              <th className="text-left px-4 py-3 w-16">{t('table.seqNo')}</th>
              <th className="text-left px-4 py-3">{t('table.student')}</th>
              <th className="text-left px-4 py-3">{t('table.schoolGrade')}</th>
              <th className="text-left px-4 py-3">{t('table.inflow')}</th>
              <th className="text-left px-4 py-3">{t('table.applyType')}</th>
              <th className="text-left px-4 py-3">{t('table.stage')}</th>
              <th className="text-left px-4 py-3">{t('table.registered')}</th>
              <th className="text-left px-4 py-3">{t('table.followup')}</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((c) => (
              <tr
                key={c.id}
                onClick={() => navigate(`/admin/csl/${c.id}`)}
                className="border-t border-[var(--border-subtle)] cursor-pointer hover:bg-[var(--gray-100)]"
              >
                <td className="px-4 py-3 text-secondary tabular-nums">#{c.seqNo}</td>
                <td className="px-4 py-3 font-medium">
                  {c.isAnonymous
                    ? t('anonymousInquiry', { seqNo: c.seqNo })
                    : c.studentName}
                </td>
                <td className="px-4 py-3 text-secondary">
                  {c.schoolFreetext ?? dash} / {c.grade ? t(`grade.${c.grade}`, c.grade) : dash}
                </td>
                <td className="px-4 py-3 text-secondary">{t(`inflow.${c.inflowType}`)}</td>
                <td className="px-4 py-3 text-secondary">{t(`applyType.${c.applyType}`)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded px-2 py-1 text-xs ${stageBadgeClass(c.currentStage)}`}
                  >
                    {t(`stage.${c.currentStage}`)}
                  </span>
                </td>
                <td className="px-4 py-3 text-secondary">
                  {c.registeredAt
                    ? new Date(c.registeredAt).toLocaleDateString(dateLocale)
                    : dash}
                </td>
                <td className="px-4 py-3 text-secondary">
                  {c.followupAt
                    ? new Date(c.followupAt).toLocaleDateString(dateLocale)
                    : dash}
                </td>
              </tr>
            ))}
            {!isLoading && (data?.items ?? []).length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-secondary">
                  {t('table.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
