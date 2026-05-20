import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TPI_HERO_BG } from '@/modules/portal/content/tpi-content';

export function HeroSection() {
  const { t } = useTranslation('portal');
  return (
    <section className="relative isolate overflow-hidden bg-slate-900 text-white">
      <div className="absolute inset-0 -z-10">
        <img
          src={TPI_HERO_BG}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-40"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-br from-blue-900/85 via-slate-900/75 to-slate-900/90"
        />
      </div>

      <div className="mx-auto max-w-5xl px-4 py-24 text-center sm:px-6 sm:py-32 lg:px-8 lg:py-40">
        <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
          {t('home.hero.title')}
        </h1>
        <p className="mx-auto mt-6 max-w-3xl text-base leading-relaxed text-white/85 sm:text-lg">
          {t('home.hero.subtitle')}
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <Link
            to="/web/contact"
            className="inline-flex items-center justify-center rounded-full bg-blue-500 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition-colors hover:bg-blue-400 sm:text-base"
          >
            {t('home.hero.cta-consult')}
          </Link>
          <Link
            to="/web/test"
            className="inline-flex items-center justify-center rounded-full border border-white/70 bg-white/10 px-7 py-3 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white hover:text-slate-900 sm:text-base"
          >
            {t('home.hero.cta-test')}
          </Link>
        </div>
      </div>
    </section>
  );
}
