import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { portalApi } from '../api/portal-api';

const CATEGORY_VALUES = ['', 'ENGLISH', 'MATH', 'SCIENCE', 'OTHER'] as const;

const LEVEL_LABELS: Record<string, string> = {
  BEGINNER: 'Basic',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
};

const LEVEL_COLORS: Record<string, string> = {
  BEGINNER: 'bg-yellow-100 text-yellow-800',
  INTERMEDIATE: 'bg-blue-100 text-blue-700',
  ADVANCED: 'bg-red-100 text-red-700',
};

function gradeRange(min: number | null, max: number | null): string {
  if (!min && !max) return '';
  if (min && max) return `G${min}–G${max}`;
  if (min) return `G${min}+`;
  return `~G${max}`;
}

export function ProgramsPage() {
  const [category, setCategory] = useState<string>('');
  const { t } = useTranslation('portal');

  const formatFee = (amount: number | string | null) => {
    if (!amount) return t('programs.fee-inquiry');
    const n = Number(amount);
    return isNaN(n) ? amount : `₩${n.toLocaleString()}`;
  };

  const categoryLabel = (key: string) =>
    key === ''
      ? t('programs.category-all')
      : t(`programs.category.${key}`, { defaultValue: key });

  const { data: programs = [], isLoading } = useQuery({
    queryKey: ['portal', 'programs', category],
    queryFn: () => portalApi.programs(category || undefined),
  });

  return (
    <>
      {/* Header */}
      <section className="border-b border-slate-200 bg-slate-50 px-4 pb-8 pt-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">
                CURRICULUM
              </p>
              <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
                {t('programs.find-title')}
              </h1>
            </div>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_VALUES.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCategory(value)}
                  className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                    category === value
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {categoryLabel(value)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Grid */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-72 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : programs.length === 0 ? (
          <div className="py-20 text-center text-slate-500">
            <p className="text-lg">{t('programs.empty-title')}</p>
            <p className="mt-1 text-sm">{t('programs.empty-hint')}</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {programs.map((prog) => (
              <Link
                key={prog.id}
                to={`/programs/${prog.id}`}
                className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                {/* Thumbnail band */}
                <div
                  className={`flex h-28 items-center justify-center ${
                    prog.category === 'MATH'
                      ? 'bg-gradient-to-br from-red-500/80 to-red-700'
                      : 'bg-gradient-to-br from-slate-800 to-slate-900'
                  } px-4 text-white`}
                >
                  <span className="text-sm font-medium tracking-wider">
                    {categoryLabel(prog.category)}
                    {prog.targetAgeMin || prog.targetAgeMax
                      ? ` · ${gradeRange(prog.targetAgeMin, prog.targetAgeMax)}`
                      : ''}
                  </span>
                </div>

                <div className="p-5">
                  <div className="flex items-center justify-between">
                    {prog.level && (
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ${
                          LEVEL_COLORS[prog.level] ?? 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {LEVEL_LABELS[prog.level] ?? prog.level}
                      </span>
                    )}
                    {prog.durationWeeks && prog.setting?.sessionCount && (
                      <span className="text-xs text-slate-500">
                        {t('programs.weekly-per-duration', {
                          perWeek: Math.round(
                            prog.setting.sessionCount / prog.durationWeeks,
                          ),
                          weeks: prog.durationWeeks,
                        })}
                      </span>
                    )}
                  </div>

                  <h3 className="mt-2 text-lg font-semibold text-slate-900 transition-colors group-hover:text-blue-700">
                    {prog.name}
                  </h3>

                  {prog.description && (
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-600">
                      {prog.description}
                    </p>
                  )}

                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xl font-semibold text-blue-600">
                      {formatFee(prog.setting?.feeAmount ?? null)}
                    </span>
                    <span className="text-xs font-medium text-slate-700 transition-colors group-hover:text-blue-700">
                      {t('programs.detail-link')}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
