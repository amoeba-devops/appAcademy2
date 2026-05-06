import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  School,
  BookOpen,
  BookOpenCheck,
  MessageCircleQuestion,
  GraduationCap,
  UserRound,
  UserCog,
  Briefcase,
  CalendarDays,
  LogOut,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { useAuthStore } from '@/stores/auth.store';

const NAV = [
  { to: '/admin/dashboard', icon: LayoutDashboard, key: 'dashboard' },
  { to: '/admin/csl', icon: Users, key: 'csl' },
  { to: '/admin/std', icon: UserRound, key: 'std' },
  { to: '/admin/cls', icon: GraduationCap, key: 'cls' },
  { to: '/admin/tch', icon: UserCog, key: 'tch' },
  { to: '/admin/stf', icon: Briefcase, key: 'stf' },
  { to: '/admin/cal', icon: CalendarDays, key: 'cal' },
  { to: '/admin/sch', icon: School, key: 'sch' },
  { to: '/admin/ref', icon: BookOpen, key: 'ref' },
  { to: '/admin/map', icon: BookOpenCheck, key: 'map' },
  { to: '/admin/qna', icon: MessageCircleQuestion, key: 'qna' },
] as const;

export function AppShell() {
  const { t } = useTranslation('common');
  const { t: tAuth } = useTranslation('auth');
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);
  const navigate = useNavigate();

  const onLogout = () => {
    clear();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-canvas text-primary">
      <header className="fixed inset-x-0 top-0 z-10 h-header bg-surface border-b border-[var(--border-subtle)] flex items-center justify-between px-6">
        <Link to="/" className="font-semibold text-lg text-accent-700">
          {t('app.name')}
        </Link>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          {user?.email && (
            <span className="text-sm text-secondary hidden sm:inline">
              {user.email}
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
      </header>

      <aside className="fixed left-0 top-header bottom-0 w-sidebar bg-surface border-r border-[var(--border-subtle)] py-4">
        <nav className="flex flex-col gap-1 px-2">
          {NAV.map(({ to, icon: Icon, key }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-accent-50 text-accent-700'
                    : 'text-secondary hover:bg-[var(--gray-100)]',
                )
              }
            >
              <Icon size={18} />
              {t(`nav.${key}`)}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="ml-sidebar mt-header p-6">
        <Outlet />
      </main>
    </div>
  );
}
