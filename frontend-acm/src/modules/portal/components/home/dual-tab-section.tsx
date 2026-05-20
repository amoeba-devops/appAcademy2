import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';

const NAVY = '#152448';

/**
 * Full-width dual tab — MAP TEST / ISEE.
 * Mirrors live tpi.co.kr — two equal half-width filled buttons (active navy
 * with white text, inactive light gray with muted text) and a thin navy
 * divider strip at the bottom.
 * Active state is path-driven: `/` and portal landing routes show MAP TEST as
 * active; `/programs` (ISEE proxy) flips highlight.
 */
export function DualTabSection() {
  const { t } = useTranslation('portal');
  const { pathname } = useLocation();
  const isMapActive =
    pathname === '/' || pathname.startsWith('/news') || pathname.startsWith('/about');

  return (
    <section className="bg-white">
      <div className="grid grid-cols-2" role="tablist">
        <Link
          to="/"
          role="tab"
          aria-selected={isMapActive}
          className={clsx(
            'flex items-center justify-center px-4 py-6 text-base font-semibold tracking-wide transition-colors sm:text-xl sm:py-8',
            isMapActive
              ? 'text-white'
              : 'bg-slate-200 text-slate-400 hover:bg-slate-300 hover:text-slate-600',
          )}
          style={isMapActive ? { backgroundColor: NAVY } : undefined}
        >
          {t('home.dual-tab.map-test')}
        </Link>
        <Link
          to="/programs"
          role="tab"
          aria-selected={!isMapActive}
          className={clsx(
            'flex items-center justify-center px-4 py-6 text-base font-semibold tracking-wide transition-colors sm:text-xl sm:py-8',
            !isMapActive
              ? 'text-white'
              : 'bg-slate-200 text-slate-400 hover:bg-slate-300 hover:text-slate-600',
          )}
          style={!isMapActive ? { backgroundColor: NAVY } : undefined}
        >
          {t('home.dual-tab.isee')}
        </Link>
      </div>
      <div className="h-3" style={{ backgroundColor: NAVY }} aria-hidden="true" />
    </section>
  );
}
