import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { LayoutDashboard, CreditCard, BarChart3, CalendarRange, LogOut } from 'lucide-react';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { useAuthStore } from '@/stores/auth.store';

const NAV: Array<{
  to: string;
  icon: typeof LayoutDashboard;
  key: string;
  end?: boolean;
}> = [
  { to: '/my', icon: LayoutDashboard, key: 'overview', end: true },
  { to: '/my/payments', icon: CreditCard, key: 'payments' },
  { to: '/my/scores', icon: BarChart3, key: 'scores' },
  { to: '/my/timetable', icon: CalendarRange, key: 'timetable' },
];

/** Parent (학부모) portal shell — `/my/*` 페이지의 공통 헤더 + sub-nav. */
export function ParentShell() {
  const { t } = useTranslation('portal');
  const { t: tAuth } = useTranslation('auth');
  const parent = useAuthStore((s) => s.parent.user);
  const clearParent = useAuthStore((s) => s.clearParent);
  const navigate = useNavigate();

  const onLogout = () => {
    clearParent();
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-primary">
      <header className="h-header sticky top-0 z-10 bg-surface border-b border-[var(--border-subtle)]">
        <div className="mx-auto max-w-6xl h-full flex items-center justify-between px-4 sm:px-6">
          <Link to="/" className="font-semibold text-lg text-accent-700">
            {t('site.name', { defaultValue: 'Trinity Prep Institute' })}
          </Link>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            {parent?.name && (
              <span className="text-sm text-secondary hidden sm:inline">
                {parent.name}
              </span>
            )}
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-primary px-2 py-1 rounded-md hover:bg-[var(--gray-100)]"
              aria-label={tAuth('session.logout')}
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">{tAuth('session.logout')}</span>
            </button>
          </div>
        </div>
      </header>

      <nav className="bg-surface border-b border-[var(--border-subtle)]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex gap-1 overflow-x-auto">
          {NAV.map(({ to, icon: Icon, key, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx(
                  'inline-flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                  isActive
                    ? 'border-accent-700 text-accent-700'
                    : 'border-transparent text-secondary hover:text-primary',
                )
              }
            >
              <Icon size={16} />
              {t(`my.tabs.${key}`, { defaultValue: key })}
            </NavLink>
          ))}
        </div>
      </nav>

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}
