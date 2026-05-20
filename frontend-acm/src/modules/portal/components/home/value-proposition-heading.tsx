import { useTranslation } from 'react-i18next';

/**
 * Transition heading between FeatureSection and TpiFeatures.
 * Mirrors reference (tpi-index.mhtml item #7, line 1973 PC / 1067 mobile):
 * "MAP TEST 성적 향상은 / 목표 달성의 핵심입니다."
 * Single centered H2 on white background.
 */
export function ValuePropositionHeading() {
  const { t } = useTranslation('portal');
  return (
    <section className="bg-white px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-4xl text-center">
        <h2 className="text-2xl font-bold leading-snug text-slate-900 sm:text-4xl lg:text-5xl">
          {t('home.value-proposition.line1')}
          <br />
          <span className="text-blue-700">
            {t('home.value-proposition.line2-highlight')}
          </span>
          {t('home.value-proposition.line2-suffix')}
        </h2>
      </div>
    </section>
  );
}
