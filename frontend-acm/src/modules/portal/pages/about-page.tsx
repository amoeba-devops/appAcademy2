import { useTranslation } from 'react-i18next';

const TIMELINE_KEYS = ['y2014', 'y2017', 'y2020', 'y2026'] as const;
const PRINCIPLE_PARAGRAPH_KEYS = ['p1', 'p2'] as const;

export function AboutPage() {
  const { t } = useTranslation('portal');
  return (
    <>
      {/* Hero — OMNIBUS OMNIA */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 px-4 py-28 text-center text-white sm:px-6 sm:py-36 lg:px-8 lg:py-44">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(96,165,250,0.18),transparent_60%)]"
        />
        <div className="relative mx-auto max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-300 sm:text-sm">
            {t('about.hero.eyebrow')}
          </p>
          <h1 className="mt-5 whitespace-pre-line text-5xl font-bold leading-tight tracking-[0.04em] sm:text-7xl lg:text-8xl">
            {t('about.hero.title')}
          </h1>
          <p className="mx-auto mt-8 max-w-2xl text-lg italic leading-relaxed text-white/90 sm:text-xl">
            &ldquo;{t('about.hero.verse')}&rdquo;
          </p>
          <p className="mt-3 text-sm text-white/60">{t('about.hero.verse-ref')}</p>
        </div>
      </section>

      {/* Story + Principle Grid */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Timeline */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">
              {t('about.story.eyebrow')}
            </p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
              {t('about.story.title')}
            </h2>
            <div className="mt-8 space-y-0">
              {TIMELINE_KEYS.map((key) => (
                <div
                  key={key}
                  className="relative flex gap-5 border-l-2 border-blue-200 py-6 pl-6"
                >
                  <span className="absolute -left-[11px] top-7 h-5 w-5 rounded-full border-2 border-blue-500 bg-white" />
                  <div>
                    <span className="text-lg font-bold text-blue-600">
                      {t(`about.timeline.${key}.year`)}
                    </span>
                    <h3 className="mt-1 text-base font-semibold text-slate-900">
                      {t(`about.timeline.${key}.heading`)}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      {t(`about.timeline.${key}.body`)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Principle */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">
              {t('about.principle.eyebrow')}
            </p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
              {t('about.principle.title')}
            </h2>
            <div className="mt-6 space-y-4">
              {PRINCIPLE_PARAGRAPH_KEYS.map((key) => (
                <p
                  key={key}
                  className="text-sm leading-[1.8] text-slate-700 sm:text-base"
                >
                  {t(`about.principle.${key}`)}
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
