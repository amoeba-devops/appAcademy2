import { useTranslation } from 'react-i18next';

const BG_IMAGE =
  'https://cdn.imweb.me/thumbnail/20251106/907e0c00a7bd6.jpg';

/**
 * Transition heading between FeatureSection and TpiFeatures.
 * Mirrors live tpi.co.kr — fixed background image (mobile banner BG) with
 * centered overlay heading: "MAP TEST 성적 향상은 / 목표 달성의 핵심입니다."
 */
export function ValuePropositionHeading() {
  const { t } = useTranslation('portal');
  return (
    <section className="relative isolate overflow-hidden px-4 py-20 sm:px-6 sm:py-28 lg:px-8 lg:py-32">
      <div className="absolute inset-0 -z-10">
        <img
          src={BG_IMAGE}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-slate-900/55 via-slate-900/45 to-slate-900/75"
        />
      </div>
      <div className="mx-auto max-w-4xl text-center text-white">
        <h2 className="text-2xl font-bold leading-snug drop-shadow-lg sm:text-4xl lg:text-5xl">
          {t('home.value-proposition.line1')}
          <br />
          <span className="text-blue-300">
            {t('home.value-proposition.line2-highlight')}
          </span>
          {t('home.value-proposition.line2-suffix')}
        </h2>
      </div>
    </section>
  );
}
