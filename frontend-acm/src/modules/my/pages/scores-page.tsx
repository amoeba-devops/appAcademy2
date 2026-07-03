import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useScores } from '../hooks';

function formatDelta(value: number | null): string {
  if (value === null) return '-';
  if (value === 0) return '0';
  return value > 0 ? `+${value}` : `${value}`;
}

export function MyScoresPage() {
  const { t, i18n } = useTranslation(['portal', 'common']);
  const [params, setParams] = useSearchParams();
  const requestedStudentId = params.get('studentId') || undefined;

  const scoresQ = useScores(requestedStudentId);
  const data = scoresQ.data ?? null;
  const lng = i18n.resolvedLanguage ?? 'ko';

  const formatScore = (v: number | null) => (v === null ? '-' : v.toLocaleString(lng));
  const formatDate = (v: string | null | undefined) =>
    v
      ? new Intl.DateTimeFormat(lng, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }).format(new Date(v))
      : '-';

  const scoreCards = useMemo(() => {
    if (!data?.summary) return [];
    return [
      {
        label: t('portal:my.scores-page.card-latest-reading'),
        value: formatScore(data.summary.latestReadingScore),
        caption: formatDate(data.summary.latestAssessedAt),
      },
      {
        label: t('portal:my.scores-page.card-average-reading'),
        value: formatScore(data.summary.averageReadingScore),
        caption: t('portal:my.scores-page.card-assessments-count', {
          count: data.summary.assessmentsCount,
        }),
      },
      {
        label: t('portal:my.scores-page.card-best-reading'),
        value: formatScore(data.summary.bestReadingScore),
        caption: t('portal:my.scores-page.card-best-caption'),
      },
      {
        label: t('portal:my.scores-page.card-reading-delta'),
        value: formatDelta(data.summary.readingDelta),
        caption: t('portal:my.scores-page.card-delta-caption'),
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, lng]);

  const selectedStudentId = data?.selectedStudentId ?? requestedStudentId ?? '';
  const onStudentChange = (next: string) => {
    const p = new URLSearchParams(params);
    if (next) p.set('studentId', next);
    else p.delete('studentId');
    setParams(p, { replace: true });
  };

  if (scoresQ.isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-secondary animate-pulse">
        {t('portal:my.loading')}
      </div>
    );
  }
  if (scoresQ.error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
        {t('portal:my.scores-page.fetch-error')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-primary">
            {t('portal:my.scores-page.title')}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">
            {t('portal:my.scores-page.lead')}
            {data?.accessMode === 'PARENT_UNBOUND' &&
              t('portal:my.scores-page.parent-unbound-note')}
          </p>
        </div>
        <div className="w-full max-w-sm space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-secondary">
            Student
          </label>
          <select
            value={selectedStudentId}
            onChange={(e) => onStudentChange(e.target.value)}
            className="w-full rounded-md border border-[var(--border-subtle)] bg-surface px-3 py-2 text-sm text-primary outline-none focus:border-accent-700"
          >
            {data?.students.length ? (
              data.students.map((s) => (
                <option key={s.studentId} value={s.studentId}>
                  {s.studentName}
                  {s.gradeLevel ? ` · ${s.gradeLevel}` : ''}
                </option>
              ))
            ) : (
              <option value="">{t('portal:my.scores-page.no-students-option')}</option>
            )}
          </select>
        </div>
      </header>

      {!data?.students.length ? (
        <div className="rounded-lg border border-dashed border-[var(--border-subtle)] bg-surface px-6 py-12 text-center text-sm text-secondary">
          {t('portal:my.scores-page.unbound-empty')}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {scoreCards.map((card) => (
              <div
                key={card.label}
                className="rounded-lg bg-surface border border-[var(--border-subtle)] p-5"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-secondary">
                  {card.label}
                </p>
                <p className="mt-3 text-3xl font-semibold text-primary">{card.value}</p>
                <p className="mt-2 text-sm text-secondary">{card.caption}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
            <article className="rounded-lg bg-surface border border-[var(--border-subtle)] p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-primary">
                    {t('portal:my.scores-page.trend-title')}
                  </h2>
                  <p className="mt-1 text-sm text-secondary">
                    {t('portal:my.scores-page.trend-lead')}
                  </p>
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider text-secondary">
                  {data?.scores.length ?? 0} Records
                </span>
              </div>

              <div className="mt-6 space-y-3">
                {data?.scores.length ? (
                  data.scores.map((score, index) => {
                    const previous = index > 0 ? data.scores[index - 1] : null;
                    const delta =
                      previous != null &&
                      previous.readingScore !== null &&
                      score.readingScore !== null
                        ? score.readingScore - previous.readingScore
                        : null;
                    return (
                      <div
                        key={score.id}
                        className="grid gap-3 rounded-md bg-[var(--gray-50)] px-4 py-3 md:grid-cols-[120px_1fr_110px] md:items-center"
                      >
                        <div>
                          <p className="text-xs uppercase tracking-wider text-secondary">
                            Assessed
                          </p>
                          <p className="mt-1 text-sm font-medium text-primary">
                            {formatDate(score.assessedAt)}
                          </p>
                        </div>
                        <div>
                          <div className="h-2 rounded-full bg-[var(--gray-200)]">
                            <div
                              className="h-2 rounded-full bg-accent-700"
                              style={{
                                width: `${Math.max(6, Math.min(score.readingScore ?? 0, 100))}%`,
                              }}
                            />
                          </div>
                          <div className="mt-3 flex flex-wrap gap-3 text-sm text-secondary">
                            <span>Reading {formatScore(score.readingScore)}</span>
                            <span>Math {formatScore(score.mathScore)}</span>
                            <span>Language {formatScore(score.languageScore)}</span>
                          </div>
                        </div>
                        <div className="text-left md:text-right">
                          <p className="text-xs uppercase tracking-wider text-secondary">
                            Delta
                          </p>
                          <p className="mt-1 text-lg font-semibold text-primary">
                            {formatDelta(delta)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-md border border-dashed border-[var(--border-subtle)] bg-[var(--gray-50)] px-5 py-10 text-center text-sm text-secondary">
                    {t('portal:my.scores-page.trend-empty')}
                  </div>
                )}
              </div>
            </article>

            <article className="rounded-lg bg-surface border border-[var(--border-subtle)] p-6">
              <h2 className="text-lg font-semibold text-primary">
                {t('portal:my.scores-page.student-info-title')}
              </h2>
              <div className="mt-4 rounded-md bg-[var(--gray-50)] p-4">
                <p className="text-xs uppercase tracking-wider text-secondary">
                  Selected Student
                </p>
                <p className="mt-2 text-2xl font-semibold text-primary">
                  {data?.selectedStudentName ?? '-'}
                </p>
                <div className="mt-3 space-y-1 text-sm text-secondary">
                  {data?.students
                    .filter((s) => s.studentId === data.selectedStudentId)
                    .map((s) => (
                      <div key={s.studentId} className="space-y-1">
                        <p>
                          {t('portal:my.scores-page.student-grade')}: {s.gradeLevel ?? '-'}
                        </p>
                        <p>
                          {t('portal:my.scores-page.student-school')}: {s.school ?? '-'}
                        </p>
                      </div>
                    ))}
                </div>
              </div>

              <div className="mt-4 rounded-md border border-[var(--border-subtle)] bg-[var(--gray-50)] px-4 py-3 text-sm leading-6 text-secondary">
                {data?.accessMode === 'PARENT'
                  ? t('portal:my.scores-page.access-mode-parent')
                  : data?.accessMode === 'ACADEMY_PREVIEW'
                    ? t('portal:my.scores-page.access-mode-preview')
                    : t('portal:my.scores-page.access-mode-unbound')}
              </div>
            </article>
          </div>
        </>
      )}
    </div>
  );
}
