import { Link, NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { ShieldCheck, Users, Building2, ArrowLeft, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { useAuthStore } from '@/stores/auth.store';

const NAV = [
  { to: '/system/admin', icon: Users, key: 'users' },
  { to: '/system/tenants', icon: Building2, key: 'tenants' },
] as const;

/**
 * REQ-260621 — System administration shell (APP_ADMIN). Visually distinct from
 * the tenant admin console (slate header + "SYSTEM" badge) so it is obvious the
 * operator is in a cross-tenant context.
 */
export function SystemShell() {
  const { t } = useTranslation('system');
  const { t: tAuth } = useTranslation('auth');
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);
  const navigate = useNavigate();

  const onLogout = () => {
    clear();
    navigate('/login', { replace: true });
  };

  // REQ-260621 — force password rotation before any system-admin action.
  if (user?.mustChangePassword) {
    return <Navigate to="/admin/change-password" replace />;
  }

  return (
    <div className="min-h-screen bg-canvas text-primary">
      <header className="fixed inset-x-0 top-0 z-10 flex h-header items-center justify-between border-b border-[var(--border-subtle)] bg-slate-900 px-6 text-white">
        <div className="flex items-center gap-2">
          <ShieldCheck size={20} className="text-amber-400" />
          <span className="text-lg font-semibold">ACM</span>
          <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-900">
            {t('badge')}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
        </div>
      </header>

      <aside className="fixed bottom-0 left-0 top-header flex w-sidebar flex-col border-r border-[var(--border-subtle)] bg-surface">
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 py-4">
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

        <div className="border-t border-[var(--border-subtle)] px-2 py-3">
          <Link
            to="/admin/dashboard"
            className="mb-2 flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-secondary transition-colors hover:bg-[var(--gray-100)] hover:text-primary"
          >
            <ArrowLeft size={18} />
            {t('backToAdmin')}
          </Link>
          {user?.email && (
            <div className="truncate px-3 pb-2 text-xs text-secondary" title={user.email}>
              {user.email}
            </div>
          )}
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-secondary transition-colors hover:bg-[var(--gray-100)] hover:text-primary"
            aria-label={tAuth('session.logout')}
          >
            <LogOut size={18} />
            {tAuth('session.logout')}
          </button>
        </div>
      </aside>

      <main className="ml-sidebar mt-header p-6">
        <Outlet />
      </main>
    </div>
  );
}
