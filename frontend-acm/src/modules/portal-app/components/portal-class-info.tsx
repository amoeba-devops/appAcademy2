import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ClassLinkList } from '@/components/common/class-links';
import { portalApi, type PortalClassInfoStudent } from '../api/portal-api';

/**
 * REQ-261103B — 포털 수업일정 아래 수업 정보: 강사별 과목·교재·수업링크.
 * 학생은 본인, 학부모는 자녀별 소제목 아래 같은 카드.
 * REQ-261103C — 수업링크 메뉴(/portal/links)도 같은 카드(title 만 다름), 링크는 여러 개.
 */
export function PortalClassInfo({
  byChild,
  title,
  className = 'mt-6',
}: {
  byChild: boolean;
  title?: string;
  className?: string;
}) {
  const { t } = useTranslation('common');
  const { data = [], isLoading } = useQuery({
    queryKey: ['portal-class-info'],
    queryFn: portalApi.classInfo,
    staleTime: 60_000,
  });
  if (isLoading) return null;
  const empty = data.every((s) => s.teachers.length === 0);
  return (
    <section className={`${className} space-y-3`} aria-labelledby="portal-class-info-title">
      <h2 id="portal-class-info-title" className="text-base font-semibold text-primary">
        {title ?? t('portalApp.classInfo.title')}
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
            <div className="border-t border-[var(--border-subtle)] pt-2">
              <ClassLinkList links={tch.links} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
