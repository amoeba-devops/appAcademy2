import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';

/**
 * Top dual tab — MAP TEST / ISEE.
 * Mirrors reference (tpi-index.mhtml `.dual-tab-section`).
 * The MAP TEST tab is always active on `/` (this landing). ISEE jumps to
 * `/programs` (no separate ISEE page exists yet — see REQ-260520 v2 §6).
 */
export function DualTabSection() {
  const { t } = useTranslation('portal');
  const { pathname } = useLocation();
  const isMapActive = pathname === '/' || pathname.startsWith('/news') || pathname.startsWith('/about');
  return (
    <section className="bg-white border-b border-slate-100">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex justify-center gap-2 sm:gap-8 pt-4 sm:pt-6">
          <Link
            to="/"
            className={clsx(
              'relative px-6 sm:px-10 py-3 text-sm sm:text-base font-bold transition-colors',
              isMapActive
                ? 'text-blue-700 after:absolute after:left-0 after:right-0 after:-bottom-px after:h-1 after:bg-blue-600 after:rounded-full'
                : 'text-slate-400 hover:text-slate-700',
            )}
          >
            {t('home.dual-tab.map-test')}
          </Link>
          <Link
            to="/programs"
            className={clsx(
              'relative px-6 sm:px-10 py-3 text-sm sm:text-base font-bold transition-colors',
              !isMapActive
                ? 'text-blue-700 after:absolute after:left-0 after:right-0 after:-bottom-px after:h-1 after:bg-blue-600 after:rounded-full'
                : 'text-slate-400 hover:text-slate-700',
            )}
          >
            {t('home.dual-tab.isee')}
          </Link>
        </div>
      </div>
    </section>
  );
}
