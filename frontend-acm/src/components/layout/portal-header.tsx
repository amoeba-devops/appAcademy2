import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Portal landing header. Mirrors live tpi.co.kr:
 *   • Left:  "TRINITY PREP INSTITUTE" serif wordmark (links to /)
 *   • Right: 2 inline text CTAs (consult + map-test register)
 *   • Far right (extras): LanguageSwitcher, parent login / mypage, admin shortcut
 * Kept the auth shortcuts compact so they do not crowd the simple line.
 */
export function PortalHeader() {
  const { t } = useTranslation(['portal', 'auth']);
  const parent = useAuthStore((s) => s.parent.user);
  const admin = useAuthStore((s) => s.user);
  const clearParent = useAuthStore((s) => s.clearParent);

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
        <Link
          to="/"
          aria-label="Trinity Prep Institute home"
          className="font-serif text-base font-semibold tracking-[0.25em] text-slate-900 sm:text-lg"
        >
          TRINITY PREP INSTITUTE
        </Link>

        <div className="flex items-center gap-4 text-xs sm:gap-7 sm:text-sm">
          <Link
            to="/web/contact"
            className="hidden font-semibold text-slate-800 transition-colors hover:text-blue-700 sm:inline"
          >
            {t('portal:home.header.menu-consult')}
          </Link>
          <Link
            to="/web/test"
            className="hidden font-semibold text-slate-800 transition-colors hover:text-blue-700 sm:inline"
          >
            {t('portal:home.header.menu-test')}
          </Link>

          {/* Mobile-compact CTA */}
          <Link
            to="/web/contact"
            className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 sm:hidden"
          >
            {t('portal:home.header.btn-consult')}
          </Link>

          {parent ? (
            <>
              <Link to="/my" className="text-slate-600 hover:text-blue-700">
                {t('portal:nav.my')}
              </Link>
              <button
                type="button"
                onClick={() => clearParent()}
                className="text-slate-500 hover:text-slate-800"
              >
                {t('auth:session.logout')}
              </button>
            </>
          ) : (
            <Link
              to="/parent/login"
              className="text-slate-500 hover:text-blue-700"
            >
              {t('portal:nav.login')}
            </Link>
          )}
          {admin && (
            <Link
              to="/admin/dashboard"
              className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
            >
              Admin →
            </Link>
          )}
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
