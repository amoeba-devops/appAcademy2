import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell, CalendarRange, FolderOpen, LogOut, Users } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { LanguageSwitcher } from '@/components/layout/language-switcher';

/**
 * PLN-260706 Phase 2 — unified portal shell for student/parent/teacher.
 * PLN-260719 C — 강사(TEACHER)에게는 수업일정 아래 "수강생관리" 메뉴 추가.
 */
const NAV = [
  { to: '/portal/notices', icon: Bell, key: 'notices', end: false },
  { to: '/portal/calendar', icon: CalendarRange, key: 'calendar', end: false },
  { to: '/portal/students', icon: Users, key: 'students', end: false, teacherOnly: true },
  { to: '/portal/materials', icon: FolderOpen, key: 'materials', end: false },
];

export function PortalShell() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.portal.user);
  const clearPortal = useAuthStore((s) => s.clearPortal);

  const logout = () => {
    clearPortal();
    navigate('/portal/login', { replace: true });
  };

  const roleLabel = user ? t(`portalApp.role.${user.kind}`) : '';

  return (
    <div className="min-h-screen bg-canvas">
      <header className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-surface px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-primary">{t('portalApp.title')}</span>
          {user && (
            <span className="rounded-full bg-[var(--gray-100)] px-2 py-0.5 text-xs text-secondary">
              {roleLabel} · {user.loginId}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* REQ-260728B FR-6 — 포털 앱에서도 언어 선택 (ko/en/vi/zh-CN) */}
          <LanguageSwitcher />
          <button
            onClick={logout}
            className="inline-flex items-center gap-1 text-sm text-secondary hover:text-primary"
          >
            <LogOut size={14} /> {t('portalApp.logout')}
          </button>
        </div>
      </header>

      {/* PLN-260719 R1 — 중앙정렬(mx-auto) 제거, 화면 좌측 붙임. */}
      <div className="flex max-w-5xl gap-4 px-3 py-4">
        <nav className="w-40 shrink-0 space-y-1">
          {NAV.filter((n) => !n.teacherOnly || user?.kind === 'TEACHER').map((n) => {
            const Icon = n.icon;
            return (
              <NavLink
                key={n.key}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                    isActive
                      ? 'bg-accent-600 text-white'
                      : 'text-secondary hover:bg-[var(--gray-100)]'
                  }`
                }
              >
                <Icon size={16} /> {t(`portalApp.nav.${n.key}`)}
              </NavLink>
            );
          })}
        </nav>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
