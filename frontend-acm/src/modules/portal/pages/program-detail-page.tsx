import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { portalApi } from '../api/portal-api';

const LEVEL_LABELS: Record<string, string> = {
  BEGINNER: 'Basic',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
};

function gradeRange(min: number | null, max: number | null): string {
  if (!min && !max) return '';
  if (min && max) return `G${min} – G${max}`;
  if (min) return `G${min}+`;
  return `~G${max}`;
}

export function ProgramDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation('portal');

  const formatFee = (amount: string | null) => {
    if (!amount) return t('programs.fee-inquiry');
    const n = Number(amount);
    return isNaN(n) ? amount : `₩${n.toLocaleString()}`;
  };

  const categoryLabel = (key: string) =>
    t(`programs.category.${key}`, { defaultValue: key });

  const { data: program, isLoading } = useQuery({
    queryKey: ['portal', 'program', id],
    queryFn: () => portalApi.program(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-20">
        <div className="h-56 animate-pulse rounded-xl bg-slate-100" />
        <div className="mt-8 h-40 animate-pulse rounded-xl bg-slate-100" />
      </div>
    );
  }

  if (!program) {
    return (
      <div className="py-32 text-center">
        <h2 className="text-2xl font-bold text-slate-900">
          {t('programs.not-found-title')}
        </h2>
        <Link
          to="/programs"
          className="mt-4 inline-block text-sm text-blue-600 hover:underline"
        >
          {t('programs.back-to-list')}
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Hero */}
      <section
        className={`px-4 py-16 text-white sm:px-6 sm:py-24 lg:px-8 ${
          program.category === 'MATH'
            ? 'bg-gradient-to-br from-red-600/90 to-red-800'
            : 'bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900'
        }`}
      >
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-wrap gap-2">
            {program.level && (
              <span className="rounded-full bg-blue-500/30 px-3 py-1 text-xs font-semibold text-blue-100">
                {LEVEL_LABELS[program.level] ?? program.level}
              </span>
            )}
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs">
              {categoryLabel(program.category)}
            </span>
            {(program.targetAgeMin || program.targetAgeMax) && (
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs">
                {gradeRange(program.targetAgeMin, program.targetAgeMax)}
              </span>
            )}
          </div>
          <h1 className="mt-4 text-3xl font-bold sm:text-5xl">{program.name}</h1>
          {program.description && (
            <p className="mt-4 max-w-2xl text-base text-white/85 sm:text-lg">
              {program.description}
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-4 text-lg text-blue-100 sm:text-xl">
            {program.setting?.sessionCount && program.durationWeeks && (
              <span>
                {t('programs.weekly-prefix')}{' '}
                {Math.round(program.setting.sessionCount / program.durationWeeks)}
                {t('programs.weekly-suffix')}
              </span>
            )}
            {program.durationWeeks && (
              <>
                <span>·</span>
                <span>
                  {program.durationWeeks}
                  {t('programs.weeks-suffix')}
                </span>
              </>
            )}
            {program.setting?.capacityMax && (
              <>
                <span>·</span>
                <span>
                  {t('programs.capacity', { count: program.setting.capacityMax })}
                </span>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[2fr_1fr]">
          {/* Left — Info */}
          <div className="space-y-10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">
                OVERVIEW
              </p>
              <h3 className="mt-2 text-xl font-bold text-slate-900">
                {t('programs.overview')}
              </h3>
              <p className="mt-4 text-sm leading-[1.8] text-slate-700">
                {program.description ?? t('programs.overview-placeholder')}
              </p>
            </div>
          </div>

          {/* Right — Enrollment card */}
          <aside>
            <div className="sticky top-24 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">
                ENROLLMENT
              </p>
              <div className="mt-2 text-3xl font-semibold text-blue-600">
                {formatFee(program.setting?.feeAmount ?? null)}
              </div>
              {program.durationWeeks && (
                <p className="mt-1 text-xs text-slate-500">
                  {t('programs.vat-note', { weeks: program.durationWeeks })}
                </p>
              )}

              <div className="mt-5 rounded-lg bg-slate-50 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  REFUND POLICY
                </p>
                <div className="mt-2 space-y-1 text-xs leading-relaxed text-slate-700">
                  <p className="font-semibold">{t('programs.refund-policy-title')}</p>
                  <p>{t('programs.refund-tier-1')}</p>
                  <p>{t('programs.refund-tier-2')}</p>
                  <p>{t('programs.refund-tier-3')}</p>
                  <p>{t('programs.refund-tier-4')}</p>
                </div>
              </div>

              <Link
                to="/web/contact"
                className="mt-5 flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                {t('programs.cta-book-consult')}
              </Link>
              <Link
                to="/web/test"
                className="mt-2 flex w-full items-center justify-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                {t('programs.cta-map-diagnosis')}
              </Link>
            </div>
          </aside>
        </div>

        <div className="mt-10 border-t border-slate-200 pt-6">
          <Link
            to="/programs"
            className="text-sm text-slate-700 transition-colors hover:text-blue-700"
          >
            {t('programs.back-to-list-full')}
          </Link>
        </div>
      </section>
    </>
  );
}
