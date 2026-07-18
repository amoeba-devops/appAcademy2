import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CalendarRange, ChevronLeft, Folder, MessageSquare } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { portalApi, type TeacherStudent } from '../api/portal-api';

/**
 * PLN-260719 Phase C — 강사 포털 "수강생관리".
 *   • /portal/students        → 배정/반 소속 학생 폴더 그리드
 *   • /portal/students/:stdId → 학생 상세 (기본정보 + 상담 + 수업기록)
 * TEACHER 전용 (타 역할은 안내문).
 */
export function PortalTeacherStudentsPage() {
  const { t } = useTranslation('common');
  const { stdId } = useParams<{ stdId: string }>();
  const kind = useAuthStore((s) => s.portal.user?.kind);

  if (kind !== 'TEACHER') {
    return (
      <p className="rounded-md border border-[var(--border-subtle)] p-6 text-center text-sm text-secondary">
        {t('portalApp.students.teacherOnly', '강사 전용 메뉴입니다.')}
      </p>
    );
  }
  return stdId ? <StudentDetail stdId={stdId} /> : <StudentGrid />;
}

function StudentGrid() {
  const { t } = useTranslation('common');
  const { data: students = [], isLoading } = useQuery({
    queryKey: ['portal-teacher-students'],
    queryFn: portalApi.teacherStudents,
  });

  return (
    <div>
      <h1 className="mb-3 text-lg font-semibold text-primary">
        {t('portalApp.nav.students', '수강생관리')}
      </h1>
      {isLoading ? (
        <p className="py-6 text-center text-sm text-secondary">…</p>
      ) : students.length === 0 ? (
        <p className="rounded-md border border-[var(--border-subtle)] p-6 text-center text-sm text-secondary">
          {t('portalApp.students.empty', '배정된 학생이 없습니다.')}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {students.map((s: TeacherStudent) => (
            <Link
              key={s.id}
              to={`/portal/students/${s.id}`}
              className="group rounded-md border border-[var(--border-subtle)] p-4 text-center hover:border-accent-400 hover:shadow-sm"
            >
              <Folder
                size={36}
                className="mx-auto text-accent-500 group-hover:text-accent-600"
                fill="currentColor"
                fillOpacity={0.15}
              />
              <div className="mt-2 truncate text-sm font-medium text-primary">
                {s.name}
                {s.englishName && (
                  <span className="ml-1 text-xs text-secondary">({s.englishName})</span>
                )}
              </div>
              <div className="mt-0.5 truncate text-xs text-secondary">
                {[s.school, s.grade, s.subject].filter(Boolean).join(' · ') || '—'}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StudentDetail({ stdId }: { stdId: string }) {
  const { t, i18n } = useTranslation(['common', 'csl', 'cal']);
  const { data: s, isLoading } = useQuery({
    queryKey: ['portal-teacher-student', stdId],
    queryFn: () => portalApi.teacherStudent(stdId),
  });

  if (isLoading || !s) {
    return <p className="py-6 text-center text-sm text-secondary">…</p>;
  }

  const fmtDT = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));

  return (
    <div>
      <Link
        to="/portal/students"
        className="mb-3 inline-flex items-center gap-1 text-xs text-accent-700 hover:underline"
      >
        <ChevronLeft size={12} /> {t('portalApp.students.back', '수강생 목록으로')}
      </Link>

      <article className="rounded-md border border-[var(--border-subtle)] p-5">
        <h1 className="text-lg font-semibold text-primary">
          {s.name}
          {s.englishName && (
            <span className="ml-2 text-sm font-normal text-secondary">
              ({s.englishName})
            </span>
          )}
        </h1>

        {/* 기본 정보 */}
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3">
          <InfoRow label={t('portalApp.students.school', '학교/학년')}>
            {[s.school, s.grade].filter(Boolean).join(' · ') || '—'}
          </InfoRow>
          <InfoRow label={t('portalApp.students.subject', '과목')}>
            {s.subject ?? '—'}
          </InfoRow>
          <InfoRow label={t('portalApp.students.email', '이메일')}>
            {s.email ?? '—'}
          </InfoRow>
          <InfoRow label={t('portalApp.students.phone', '연락처')}>
            {s.phone ?? '—'}
          </InfoRow>
          <InfoRow label={t('portalApp.students.startDate', '수강 시작')}>
            {s.startDate ?? '—'}
          </InfoRow>
          {s.sourceInquiry && (
            <InfoRow label={t('portalApp.students.inquiry', '연결 상담')}>
              #{s.sourceInquiry.seqNo} ·{' '}
              {t(`csl:stage.${s.sourceInquiry.currentStage}`, s.sourceInquiry.currentStage)}
            </InfoRow>
          )}
        </dl>

        {(s.specialNote || s.goalsNote) && (
          <div className="mt-3 space-y-1 rounded-md bg-[var(--gray-50)] px-3 py-2 text-sm">
            {s.specialNote && (
              <div>
                <span className="text-xs text-secondary">
                  {t('portalApp.students.specialNote', '특이사항')}:
                </span>{' '}
                {s.specialNote}
              </div>
            )}
            {s.goalsNote && (
              <div>
                <span className="text-xs text-secondary">
                  {t('portalApp.students.goalsNote', '학습 목표')}:
                </span>{' '}
                {s.goalsNote}
              </div>
            )}
          </div>
        )}

        {/* 상담 기록 */}
        <section className="mt-5">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-primary">
            <MessageSquare size={14} />
            {t('portalApp.students.remarks', '상담 기록')}
          </h2>
          {s.remarks.length === 0 ? (
            <p className="text-xs text-secondary">
              {t('portalApp.students.noRemarks', '상담 기록이 없습니다.')}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {s.remarks.map((r, idx) => (
                <li
                  key={idx}
                  className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
                >
                  <div className="whitespace-pre-wrap text-primary">{r.body}</div>
                  <div className="mt-0.5 text-[11px] text-secondary">
                    {new Date(r.createdAt).toLocaleDateString(i18n.language)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 수업 기록 */}
        <section className="mt-5">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-primary">
            <CalendarRange size={14} />
            {t('portalApp.students.classes', '수업 기록 (최근 10건)')}
          </h2>
          {s.recentEvents.length === 0 ? (
            <p className="text-xs text-secondary">
              {t('portalApp.students.noClasses', '수업 기록이 없습니다.')}
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)] rounded-md border border-[var(--border-subtle)]">
              {s.recentEvents.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="w-40 shrink-0 text-xs text-secondary">
                    {fmtDT(e.startAt)}
                  </span>
                  <Link
                    to={`/portal/calendar/${e.id}`}
                    className="min-w-0 flex-1 truncate text-accent-700 hover:underline"
                  >
                    {e.title}
                  </Link>
                  <span className="shrink-0 rounded bg-[var(--gray-100)] px-1.5 py-0.5 text-[10px] text-secondary">
                    {t(`cal:category.${e.category}`, e.category)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </article>
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-secondary">{label}</dt>
      <dd className="text-primary">{children}</dd>
    </div>
  );
}
