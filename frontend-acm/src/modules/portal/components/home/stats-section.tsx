import { useTranslation } from 'react-i18next';

const STATS = ['districts', 'countries', 'students', 'institutions'] as const;

/**
 * Global stats highlight section — REQ-260520 v2 FR-01-A-003 (T1-P-03).
 * Mirrors reference (tpi-index.mhtml `.stats-section` data-count).
 * Real values: 4,500+ districts / 146 countries / 13M+ test-takers / 35,900+ institutions.
 */
export function StatsSection() {
  const { t } = useTranslation('portal');
  return (
    <section className="bg-white px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">
          {t('home.stats.title')}
        </h2>
        <div className="mx-auto mt-6 h-1 w-12 rounded-full bg-blue-500" aria-hidden="true" />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((key) => (
            <article
              key={key}
              className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm transition-shadow hover:shadow-md"
            >
              <p className="text-3xl font-bold text-blue-600 sm:text-4xl">
                {t(`home.stats.${key}.value`)}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {t(`home.stats.${key}.unit`)}
              </p>
              <p className="mt-3 text-sm font-medium text-slate-700">
                {t(`home.stats.${key}.label`)}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
