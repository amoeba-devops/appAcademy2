import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TPI_IMPORTANCE_KEYS } from '@/modules/portal/content/tpi-content';

/**
 * "Why MAP TEST?" — checklist style.
 * Replaces v1 `MapTestImportance` (card grid).
 * Mirrors reference (tpi-index.mhtml `.feature-section` rows with check-icon).
 */
export function FeatureSection() {
  const { t } = useTranslation('portal');
  return (
    <section className="bg-slate-50 px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">
          {t('home.importance.title')}
        </h2>
        <div className="mx-auto mt-6 h-1 w-12 rounded-full bg-blue-500" aria-hidden="true" />
        <ul className="mt-12 space-y-3 sm:space-y-4">
          {TPI_IMPORTANCE_KEYS.map((key) => (
            <li
              key={key}
              className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm sm:items-center sm:px-7 sm:py-5"
            >
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                <Check size={18} strokeWidth={3} aria-hidden="true" />
              </span>
              <span className="text-sm font-medium leading-relaxed text-slate-800 sm:text-base">
                {t(`home.importance.${key}`)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
