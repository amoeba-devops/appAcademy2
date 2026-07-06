import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { clsx } from 'clsx';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useClass } from '../hooks/use-classes';
import { useUpdateClassStatus } from '../hooks/use-class-mutations';
import type { ClsStatus } from '../types';
import { ClsStatusBadge } from '../components/cls-status-badge';
import { ClsInfoCard } from '../components/cls-info-card';
import { MaterialsPanel } from '@/modules/material/components/materials-panel';
import { ClsStudentsList } from '../components/cls-students-list';
import { ClsRecurrenceList } from '../components/cls-recurrence-list';
import { ClsRecentSessions } from '../components/cls-recent-sessions';

type Tab = 'info' | 'students' | 'schedule' | 'sessions';
const TABS: Tab[] = ['info', 'students', 'schedule', 'sessions'];
const STATUS_OPTIONS: ClsStatus[] = [
  'PROPOSED',
  'ACTIVE',
  'PAUSED',
  'COMPLETED',
  'CANCELLED',
];

export function ClsDetailPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation(['cls', 'common']);
  const [tab, setTab] = useState<Tab>('info');
  const { data: cls, isLoading, error } = useClass(id);
  const statusMutation = useUpdateClassStatus(id);

  const localeMap: Record<string, string> = {
    ko: 'ko-KR',
    en: 'en-US',
    vi: 'vi-VN',
    'zh-CN': 'zh-CN',
  };
  const dateLocale = localeMap[i18n.language ?? 'ko'] ?? 'ko-KR';
  const dash = t('common:dash');

  if (isLoading) {
    return <p className="text-secondary">{t('common:status.loading')}</p>;
  }
  if (error || !cls) {
    return <p className="text-secondary">{t('common:status.error')}</p>;
  }

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(dateLocale) : dash;

  return (
    <div>
      <Link
        to="/admin/cls"
        className="mb-3 inline-block text-sm text-secondary hover:text-primary"
      >
        {t('detail.back')}
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold">{cls.code}</h1>
            <ClsStatusBadge status={cls.status} />
          </div>
          <p className="mt-1 text-sm text-secondary">
            {t(`subjectType.${cls.subjectType}`)}
            {' · '}
            {t(`session.modes.${cls.defaultMode}`)}
          </p>
          <p className="mt-1 text-sm text-secondary">
            {t('table.teacher')}: {cls.teacherName ?? cls.teacherUserId ?? dash}
            {' · '}
            {t('table.startedAt')}: {fmtDate(cls.startedAt)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-secondary">
              {t('detail.statusChange.label')}:
            </span>
            <select
              value={cls.status}
              disabled={statusMutation.isPending}
              onChange={(e) =>
                statusMutation.mutate(e.target.value as ClsStatus)
              }
              className="h-8 rounded-md border border-[var(--border-subtle)] bg-surface px-2 text-sm"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {t(`status.${s}`)}
                </option>
              ))}
            </select>
            {statusMutation.isPending ? (
              <span className="text-xs text-secondary">
                {t('detail.statusChange.pending')}
              </span>
            ) : null}
          </label>

          <Button variant="outline" disabled title={t('common:todo')}>
            <Sparkles size={14} className="mr-1" />
            {t('actions.generate')}
          </Button>
        </div>
      </div>

      <nav className="mb-4 border-b border-[var(--border-subtle)]">
        <ul className="-mb-px flex gap-1 overflow-x-auto">
          {TABS.map((k) => (
            <li key={k}>
              <button
                type="button"
                onClick={() => setTab(k)}
                className={clsx(
                  'whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                  tab === k
                    ? 'border-accent-600 text-accent-700'
                    : 'border-transparent text-secondary hover:text-primary',
                )}
              >
                {t(`detail.tabs.${k}`)}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {tab === 'info' && (
        <div className="space-y-4">
          <ClsInfoCard cls={cls} />
          <MaterialsPanel clsId={cls.id} />
        </div>
      )}
      {tab === 'students' && <ClsStudentsList students={cls.students} />}
      {tab === 'schedule' && <ClsRecurrenceList recurrences={cls.recurrences} />}
      {tab === 'sessions' && <ClsRecentSessions classId={cls.id} students={cls.students} />}
    </div>
  );
}
