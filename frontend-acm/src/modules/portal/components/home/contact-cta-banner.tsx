import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';

/**
 * Bottom contact CTA banner — large clickable card linking to /web/contact.
 * Mirrors reference (tpi-index.mhtml item #13, PC L3620 / mobile L3325).
 * Reference uses a single large image link; we use a typographic banner
 * to stay i18n-friendly across 4 locales.
 */
export function ContactCtaBanner() {
  const { t } = useTranslation('portal');
  return (
    <section className="bg-gradient-to-br from-blue-700 via-blue-600 to-blue-500 px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <Link
          to="/web/contact"
          className="group flex flex-col items-center gap-6 rounded-3xl bg-white/10 px-8 py-12 text-center backdrop-blur transition-all hover:bg-white/15 sm:flex-row sm:justify-between sm:text-left"
        >
          <div className="text-white">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-100">
              {t('home.contact-cta.eyebrow')}
            </p>
            <h2 className="mt-3 text-2xl font-bold leading-tight sm:text-3xl lg:text-4xl">
              {t('home.contact-cta.title')}
            </h2>
            <p className="mt-3 text-sm text-blue-100 sm:text-base">
              {t('home.contact-cta.body')}
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 text-sm font-semibold text-blue-700 shadow-lg transition-transform group-hover:translate-x-1 sm:text-base">
            {t('home.contact-cta.button')}
            <ArrowRight size={18} strokeWidth={2.5} aria-hidden="true" />
          </span>
        </Link>
      </div>
    </section>
  );
}
