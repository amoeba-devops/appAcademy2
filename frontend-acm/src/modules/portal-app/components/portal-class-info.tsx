import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Video } from 'lucide-react';
import { portalApi, type PortalClassInfoStudent } from '../api/portal-api';

/**
 * REQ-261103B — 포털 수업일정 아래 수업 정보: 강사별 과목·교재·수업링크.
 * 학생은 본인, 학부모는 자녀별 소제목 아래 같은 카드.
 */
export function PortalClassInfo({ byChild }: { byChild: boolean }) {
  const { t } = useTranslation('common');
  const { data = [], isLoading } = useQuery({
    queryKey: ['portal-class-info'],
    queryFn: portalApi.classInfo,
    staleTime: 60_000,
  });
  if (isLoading) return null;
  const empty = data.every((s) => s.teachers.length === 0);
  return (
    <section className="mt-6 space-y-3" aria-labelledby="portal-class-info-title">
      <h2 id="portal-class-info-title" className="text-base font-semibold text-primary">
        {t('portalApp.classInfo.title')}
      </h2>
      {empty ? (
        <p className="text-sm text-secondary">{t('portalApp.classInfo.empty')}</p>
      ) : (
        data.map((s) => <StudentBlock key={s.stdId} s={s} showName={byChild} />)
      )}
    </section>
  );
}

function StudentBlock({ s, showName }: { s: PortalClassInfoStudent; showName: boolean }) {
  const { t } = useTranslation('common');
  if (!s.teachers.length) return null;
  const none = <span className="text-secondary">—</span>;
  return (
    <div className="space-y-2">
      {showName && <h3 className="text-sm font-medium text-primary">{s.stdName}</h3>}
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {s.teachers.map((tch) => (
          <li
            key={tch.tchId}
            className="space-y-1.5 rounded-md border border-[var(--border-subtle)] bg-surface p-3 text-sm"
          >
            <div className="font-semibold text-primary">{tch.name}</div>
            <div>
              <span className="text-secondary">{t('portalApp.classInfo.subject')}</span>{' '}
              {tch.subject || none}
            </div>
            <div className="whitespace-pre-wrap break-words">
              <span className="text-secondary">{t('portalApp.classInfo.curriculum')}</span>{' '}
              {tch.curriculum || none}
            </div>
            {tch.meetingUrl ? (
              <a
                href={tch.meetingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex min-h-9 items-center gap-2 rounded-md bg-accent-600 px-3 text-sm font-medium text-white hover:bg-accent-700"
              >
                <Video size={16} />
                {t('portalApp.classInfo.join')}
              </a>
            ) : (
              <div>
                <span className="text-secondary">{t('portalApp.classInfo.meetingUrl')}</span>{' '}
                {none}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
