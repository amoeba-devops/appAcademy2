import { Link, NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Users2,
  School,
  BookOpen,
  BookOpenCheck,
  MessageCircleQuestion,
  MessagesSquare,
  Newspaper,
  Bell,
  ClipboardList,
  GraduationCap,
  UserRound,
  UserCog,
  Briefcase,
  CalendarDays,
  BarChart3,
  Settings,
  ShieldCheck,
  LogOut,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { useAuthStore } from '@/stores/auth.store';
import { useMyMenus } from '@/modules/system/hooks/use-my-menus';

const NAV = [
  { to: '/admin/dashboard', icon: LayoutDashboard, key: 'dashboard' },
  { to: '/admin/csl', icon: Users, key: 'csl' },
  { to: '/admin/std', icon: UserRound, key: 'std' },
  { to: '/admin/std/parents', icon: Users2, key: 'parents' },
  { to: '/admin/cls', icon: GraduationCap, key: 'cls' },
  { to: '/admin/tch', icon: UserCog, key: 'tch' },
  { to: '/admin/stf', icon: Briefcase, key: 'stf' },
  { to: '/admin/cal', icon: CalendarDays, key: 'cal' },
  // PLN-260729-2 — 수업통계 대시보드
  { to: '/admin/cal-stats', icon: BarChart3, key: 'calStats' },
  { to: '/admin/sch', icon: School, key: 'sch' },
  { to: '/admin/ref', icon: BookOpen, key: 'ref' },
  { to: '/admin/posts', icon: Newspaper, key: 'posts' },
  { to: '/admin/notifications', icon: Bell, key: 'notifications' },
  { to: '/admin/enrollments', icon: ClipboardList, key: 'enrollments' },
  { to: '/admin/map', icon: BookOpenCheck, key: 'map' },
  { to: '/admin/qna', icon: MessageCircleQuestion, key: 'qna' },
  // REQ-260728C — 로비채팅 (운영자↔강사)
  { to: '/admin/chat', icon: MessagesSquare, key: 'chat' },
  { to: '/admin/config', icon: Settings, key: 'config' },
] as const;

export function AppShell() {
  const { t } = useTranslation('common');
  const { t: tAuth } = useTranslation('auth');
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);
  const navigate = useNavigate();

  // REQ-260621 v1.1 / PLN-260728E — per-tenant 메뉴 가시성 + 순서(UI-only).
  // Fail-open: 로딩/오류 시 전체 표시·기본(NAV) 순서.
  const { data: menus } = useMyMenus();
  const hiddenSet = new Set(menus?.hidden ?? []);
  // 표시 순서: 백엔드 order(관리 키) 기준, NAV 에만 있는 키(예: chat)는
  // 원래 NAV 이웃 뒤에 삽입해 위치 보존.
  const orderedKeys: string[] = (() => {
    const base = menus?.order ?? [];
    if (base.length === 0) return NAV.map((n) => n.key);
    const keys = [...base];
    NAV.forEach((n, i) => {
      if (keys.includes(n.key)) return;
      const prev = NAV[i - 1]?.key;
      const at = prev ? keys.indexOf(prev) : -1;
      if (at >= 0) keys.splice(at + 1, 0, n.key);
      else keys.push(n.key);
    });
    return keys;
  })();
  const rank = new Map(orderedKeys.map((k, i) => [k, i]));
  const visibleNav = NAV.filter((n) => !hiddenSet.has(n.key))
    .slice()
    .sort((a, b) => (rank.get(a.key) ?? 999) - (rank.get(b.key) ?? 999));

  const onLogout = () => {
    clear();
    navigate('/login', { replace: true });
  };

  // REQ-260621 — force seeded/admin-reset accounts to rotate before any use.
  if (user?.mustChangePassword) {
    return <Navigate to="/admin/change-password" replace />;
  }

  return (
    <div className="min-h-screen bg-canvas text-primary">
      <header className="fixed inset-x-0 top-0 z-10 h-header bg-surface border-b border-[var(--border-subtle)] flex items-center justify-between px-6">
        {/* REQ-260621 — brand now links to the admin home, label simplified to "ACM". */}
        <Link to="/admin" className="font-semibold text-lg text-accent-700">
          ACM
        </Link>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
        </div>
      </header>

      <aside className="fixed left-0 top-header bottom-0 w-sidebar bg-surface border-r border-[var(--border-subtle)] flex flex-col">
        <nav className="flex flex-col gap-1 px-2 py-4 flex-1 overflow-y-auto">
          {visibleNav.map(({ to, icon: Icon, key }) => (
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

        {/* REQ-260621 — user info + logout pinned to the sidebar bottom. */}
        <div className="border-t border-[var(--border-subtle)] px-2 py-3">
          {user?.role === 'APP_ADMIN' && (
            <NavLink
              to="/system/admin"
              className={({ isActive }) =>
                clsx(
                  'mb-2 flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-accent-50 text-accent-700'
                    : 'text-secondary hover:bg-[var(--gray-100)]',
                )
              }
            >
              <ShieldCheck size={18} />
              {t('nav.systemAdmin')}
            </NavLink>
          )}
          {user?.email && (
            <div className="px-3 pb-2 text-xs text-secondary truncate" title={user.email}>
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
