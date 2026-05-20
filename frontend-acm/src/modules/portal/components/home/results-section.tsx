import { useTranslation } from 'react-i18next';

/**
 * "TPI 는 결과로 증명합니다" results / social-proof section.
 * Mirrors reference (tpi-index.mhtml item #12, PC L3550 / mobile L3265).
 * Dark navy background (mobile #090528), centered H2 + paragraph.
 */
export function ResultsSection() {
  const { t } = useTranslation('portal');
  return (
    <section className="bg-[#090528] px-4 py-20 text-white sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-4xl text-center">
        <h2 className="text-2xl font-bold leading-snug sm:text-4xl lg:text-5xl">
          {t('home.results.title')}
        </h2>
        <div className="mx-auto mt-6 h-1 w-12 rounded-full bg-blue-400" aria-hidden="true" />
        <p className="mx-auto mt-8 max-w-3xl text-base leading-relaxed text-slate-200 sm:text-lg">
          {t('home.results.body')}
        </p>
      </div>
    </section>
  );
}
