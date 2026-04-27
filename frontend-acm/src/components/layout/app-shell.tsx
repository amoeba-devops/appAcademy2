import { Link, NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  School,
  BookOpen,
  MessageCircleQuestion,
  GraduationCap,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { LanguageSwitcher } from '@/components/layout/language-switcher';

const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, key: 'dashboard' },
  { to: '/csl', icon: Users, key: 'csl' },
  { to: '/cls', icon: GraduationCap, key: 'cls' },
  { to: '/sch', icon: School, key: 'sch' },
  { to: '/ref', icon: BookOpen, key: 'ref' },
  { to: '/qna', icon: MessageCircleQuestion, key: 'qna' },
] as const;

export function AppShell() {
  const { t } = useTranslation('common');

  return (
    <div className="min-h-screen bg-canvas text-primary">
      <header className="fixed inset-x-0 top-0 z-10 h-header bg-surface border-b border-[var(--border-subtle)] flex items-center justify-between px-6">
        <Link to="/" className="font-semibold text-lg text-accent-700">
          {t('app.name')}
        </Link>
        <LanguageSwitcher />
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
