'use client';

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState, startTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTranslation } from 'react-i18next';
import { api, ApiClientError } from '@/lib/api-client';
import type { PortalMapScoreHistory } from '@/types/map';

function formatDelta(value: number | null) {
  if (value === null) {
    return '-';
  }

  if (value === 0) {
    return '0';
  }

  return value > 0 ? `+${value}` : `${value}`;
}

export default function PortalScoresPage() {
  return (
    <Suspense fallback={null}>
      <PortalScoresContent />
    </Suspense>
  );
}

function PortalScoresContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedStudentId = Number(searchParams.get('studentId') ?? '') || undefined;
  const { t, i18n } = useTranslation('portal');

  const lng = i18n.resolvedLanguage ?? 'ko';
  const formatScore = (value: number | null) =>
    value === null ? '-' : value.toLocaleString(lng);

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(lng, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(value));

  const [data, setData] = useState<PortalMapScoreHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      setLoading(false);
      setData(null);
      return;
    }

    if (status !== 'authenticated') {
      return;
    }

    let disposed = false;

    const fetchScores = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (requestedStudentId) {
          params.set('studentId', String(requestedStudentId));
        }

        const response = await api.get<PortalMapScoreHistory>(
          `/portal/my/scores${params.toString() ? `?${params.toString()}` : ''}`,
        );

        if (!disposed) {
          setData(response.data ?? null);
        }
      } catch (fetchError) {
        if (!disposed) {
          setError(
            fetchError instanceof ApiClientError
              ? fetchError.message
              : t('my.scores-page.fetch-error'),
          );
        }
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    };

    void fetchScores();

    return () => {
      disposed = true;
    };
  }, [requestedStudentId, status, t]);

  const selectedStudentId = data?.selectedStudentId ?? requestedStudentId ?? '';
  const scoreCards = useMemo(() => {
    if (!data?.summary) {
      return [];
    }

    return [
      {
        label: t('my.scores-page.card-latest-reading'),
        value: formatScore(data.summary.latestReadingScore),
        caption: formatDate(data.summary.latestAssessedAt),
      },
      {
        label: t('my.scores-page.card-average-reading'),
        value: formatScore(data.summary.averageReadingScore),
        caption: t('my.scores-page.card-assessments-count', { count: data.summary.assessmentsCount }),
      },
      {
        label: t('my.scores-page.card-best-reading'),
        value: formatScore(data.summary.bestReadingScore),
        caption: t('my.scores-page.card-best-caption'),
      },
      {
        label: t('my.scores-page.card-reading-delta'),
        value: formatDelta(data.summary.readingDelta),
        caption: t('my.scores-page.card-delta-caption'),
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, i18n.resolvedLanguage]);

  const handleStudentChange = (nextStudentId: string) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (nextStudentId) {
        params.set('studentId', nextStudentId);
      } else {
        params.delete('studentId');
      }

      router.replace(`/my/scores${params.toString() ? `?${params.toString()}` : ''}`);
    });
  };

  if (status === 'loading' || loading) {
    return (
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-16 lg:px-10">
        <div className="h-8 w-48 animate-pulse rounded-full bg-navy/10" />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-3xl bg-white shadow-sm ring-1 ring-navy/5" />
          ))}
        </div>
        <div className="h-80 animate-pulse rounded-3xl bg-white shadow-sm ring-1 ring-navy/5" />
      </section>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <section className="mx-auto flex min-h-[60vh] w-full max-w-3xl flex-col items-center justify-center gap-6 px-6 py-16 text-center">
        <span className="rounded-full border border-heraldic-gold/30 bg-heraldic-gold/10 px-4 py-1 text-xs font-semibold tracking-[0.2em] text-navy">
          PARENT PORTAL
        </span>
        <div className="space-y-3">
          <h1 className="font-display text-4xl text-navy">{t('my.scores-page.unauthenticated-title')}</h1>
          <p className="text-sm leading-7 text-navy/70">
            {t('my.scores-page.unauthenticated-lead')}
          </p>
        </div>
        <Link
          href="/login"
          className="rounded-full bg-navy px-6 py-3 text-sm font-semibold text-cream transition hover:bg-navy/90"
        >
          {t('my.scores-page.login-cta')}
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-12 lg:px-10">
      <div className="flex flex-col gap-4 rounded-[32px] bg-white/90 p-6 shadow-[0_24px_80px_rgba(11,13,20,0.08)] ring-1 ring-navy/5 md:flex-row md:items-end md:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-heraldic-gold/30 bg-heraldic-gold/10 px-3 py-1 text-[11px] font-semibold tracking-[0.2em] text-navy">
              MAP SCORE PORTAL
            </span>
            {data?.accessMode === 'ACADEMY_PREVIEW' && (
              <span className="rounded-full border border-navy/10 bg-navy/5 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-navy/70">
                PREVIEW MODE
              </span>
            )}
          </div>
          <div>
            <h1 className="font-display text-4xl text-navy">{t('my.scores-page.title')}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-navy/70">
              {t('my.scores-page.lead')}
              {data?.accessMode === 'PARENT_UNBOUND' && t('my.scores-page.parent-unbound-note')}
            </p>
          </div>
        </div>

        <div className="w-full max-w-sm space-y-2">
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-navy/50">
            Student
          </label>
          <select
            value={selectedStudentId}
            onChange={(event) => handleStudentChange(event.target.value)}
            className="w-full rounded-2xl border border-navy/10 bg-cream px-4 py-3 text-sm text-navy outline-none transition focus:border-heraldic-gold"
          >
            {data?.students.length ? (
              data.students.map((student) => (
                <option key={student.studentId} value={student.studentId}>
                  {student.studentName}
                  {student.gradeLevel ? ` · ${student.gradeLevel}` : ''}
                </option>
              ))
            ) : (
              <option value="">{t('my.scores-page.no-students-option')}</option>
            )}
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!data?.students.length && !error ? (
        <div className="rounded-[32px] border border-dashed border-navy/15 bg-white/70 px-6 py-12 text-center text-sm leading-7 text-navy/65">
          {t('my.scores-page.unbound-empty')}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {scoreCards.map((card) => (
              <article
                key={card.label}
                className="rounded-[28px] bg-white p-5 shadow-[0_18px_60px_rgba(11,13,20,0.06)] ring-1 ring-navy/5"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-navy/45">{card.label}</p>
                <p className="mt-4 font-display text-4xl text-navy">{card.value}</p>
                <p className="mt-3 text-sm text-navy/60">{card.caption}</p>
              </article>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
            <article className="rounded-[32px] bg-white p-6 shadow-[0_20px_70px_rgba(11,13,20,0.07)] ring-1 ring-navy/5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-2xl text-navy">{t('my.scores-page.trend-title')}</h2>
                  <p className="mt-2 text-sm text-navy/60">{t('my.scores-page.trend-lead')}</p>
                </div>
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-navy/40">
                  {data?.scores.length ?? 0} Records
                </span>
              </div>

              <div className="mt-8 space-y-4">
                {data?.scores.length ? (
                  data.scores.map((score, index) => {
                    const previous = index > 0 ? data.scores[index - 1] : null;
                    const delta =
                      previous != null && previous.readingScore !== null && score.readingScore !== null
                        ? score.readingScore - previous.readingScore
                        : null;

                    return (
                      <div
                        key={score.id}
                        className="grid gap-3 rounded-3xl bg-cream px-5 py-4 md:grid-cols-[120px_1fr_110px] md:items-center"
                      >
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-navy/40">Assessed</p>
                          <p className="mt-1 text-sm font-medium text-navy">{formatDate(score.assessedAt)}</p>
                        </div>

                        <div>
                          <div className="h-2 rounded-full bg-navy/8">
                            <div
                              className="h-2 rounded-full bg-gradient-to-r from-heraldic-gold to-navy"
                              style={{ width: `${Math.max(6, Math.min(score.readingScore ?? 0, 100))}%` }}
                            />
                          </div>
                          <div className="mt-3 flex flex-wrap gap-3 text-sm text-navy/65">
                            <span>Reading {formatScore(score.readingScore)}</span>
                            <span>Math {formatScore(score.mathScore)}</span>
                            <span>Language {formatScore(score.languageScore)}</span>
                          </div>
                        </div>

                        <div className="text-left md:text-right">
                          <p className="text-xs uppercase tracking-[0.18em] text-navy/40">Delta</p>
                          <p className="mt-1 text-lg font-semibold text-navy">{formatDelta(delta)}</p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-3xl border border-dashed border-navy/15 bg-cream px-5 py-10 text-center text-sm text-navy/60">
                    {t('my.scores-page.trend-empty')}
                  </div>
                )}
              </div>
            </article>

            <article className="rounded-[32px] bg-white p-6 shadow-[0_20px_70px_rgba(11,13,20,0.07)] ring-1 ring-navy/5">
              <h2 className="font-display text-2xl text-navy">{t('my.scores-page.student-info-title')}</h2>
              <div className="mt-6 rounded-3xl bg-cream p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-navy/40">Selected Student</p>
                <p className="mt-2 font-display text-3xl text-navy">{data?.selectedStudentName ?? '-'}</p>
                <div className="mt-4 space-y-2 text-sm text-navy/65">
                  {data?.students
                    .filter((student) => student.studentId === data.selectedStudentId)
                    .map((student) => (
                      <div key={student.studentId} className="space-y-2">
                        <p>{t('my.scores-page.student-grade')}: {student.gradeLevel ?? '-'}</p>
                        <p>{t('my.scores-page.student-school')}: {student.school ?? '-'}</p>
                      </div>
                    ))}
                </div>
              </div>

              <div className="mt-6 rounded-3xl border border-navy/10 bg-navy px-5 py-5 text-cream">
                <p className="text-xs uppercase tracking-[0.18em] text-cream/55">Account</p>
                <p className="mt-2 text-sm text-cream/85">{session?.user?.email ?? '-'}</p>
                <p className="mt-3 text-sm leading-6 text-cream/70">
                  {data?.accessMode === 'PARENT'
                    ? t('my.scores-page.access-mode-parent')
                    : data?.accessMode === 'ACADEMY_PREVIEW'
                      ? t('my.scores-page.access-mode-preview')
                      : t('my.scores-page.access-mode-unbound')}
                </p>
              </div>
            </article>
          </div>
        </>
      )}
    </section>
  );
}
