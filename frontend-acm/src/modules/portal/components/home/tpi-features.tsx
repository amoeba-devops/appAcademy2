import { useTranslation } from 'react-i18next';
import {
  TPI_FEATURE_KEYS,
  TPI_FEATURE_IMAGES,
} from '@/modules/portal/content/tpi-content';

/**
 * "TPI 만의 차별화된 강점" — 5 strength cards with imagery.
 * Mirrors live tpi.co.kr 5-strengths section (cdn.imweb.me/upload/S20251104ec4c428bdd288/*.png).
 */
export function TpiFeatures() {
  const { t } = useTranslation('portal');
  return (
    <section className="bg-white px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">
          {t('home.features.title')}
        </h2>
        <div className="mx-auto mt-6 h-1 w-12 rounded-full bg-blue-500" aria-hidden="true" />
        <div className="mt-14 space-y-10 sm:space-y-14">
          {TPI_FEATURE_KEYS.map((key, idx) => {
            const isReversed = idx % 2 === 1;
            return (
              <article
                key={key}
                className={`flex flex-col items-center gap-6 rounded-3xl border border-slate-200 bg-slate-50 p-7 transition-all hover:border-blue-200 hover:bg-white hover:shadow-lg sm:p-10 lg:gap-12 lg:p-12 ${
                  isReversed ? 'lg:flex-row-reverse' : 'lg:flex-row'
                }`}
              >
                <div className="flex w-full max-w-md shrink-0 items-center justify-center lg:w-2/5">
                  <img
                    src={TPI_FEATURE_IMAGES[key]}
                    alt=""
                    className="h-auto w-full max-w-xs object-contain sm:max-w-sm"
                    loading="lazy"
                  />
                </div>
                <div className="flex-1 text-center lg:text-left">
                  <span
                    aria-hidden="true"
                    className="text-xs font-bold uppercase tracking-[0.25em] text-blue-600"
                  >
                    FEATURE {String(idx + 1).padStart(2, '0')}
                  </span>
                  <h3 className="mt-3 text-lg font-bold leading-snug text-slate-900 sm:text-xl lg:text-2xl">
                    {t(`home.features.${key}-title`)}
                  </h3>
                  <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
                    {t(`home.features.${key}-body`)}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
