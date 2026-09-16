import { useEffect, useState } from 'react';
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FileText,
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
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { useQuery } from '@tanstack/react-query';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { AdminRealtime } from '@/components/layout/admin-realtime';
import { useAuthStore } from '@/stores/auth.store';
import { useMyMenus } from '@/modules/system/hooks/use-my-menus';
import { talkApi } from '@/modules/talk/api/talk-api';
import { useUiStore } from '@/stores/ui.store';
import { me as fetchMe } from '@/modules/auth/api/auth-api';
import { useIsDesktop, useIsMobile } from '@/hooks/use-media-query';

const NAV = [
  { to: '/admin/dashboard', icon: LayoutDashboard, key: 'dashboard' },
  { to: '/admin/csl', icon: Users, key: 'csl' },
  // CSL-PLN-260916 — 맵테스트 신청 목록
  { to: '/admin/test', icon: FileText, key: 'mapApply' },
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
  const location = useLocation();

  // PLN-260914 — 3 모드: 모바일 드로어 / 태블릿 아이콘 고정 / 데스크톱 토글.
  const isMobile = useIsMobile();
  const isDesktop = useIsDesktop();
  const collapsedPref = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // 데스크톱은 사용자 선택, 태블릿(768~1023)은 항상 아이콘 모드.
  const iconOnly = isMobile ? false : isDesktop ? collapsedPref : true;

  // 라우트가 바뀌면 드로어를 닫는다 (메뉴 선택 후 그대로 열려 있으면 곤란).
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // 데스크톱/태블릿으로 넓어지면 드로어 상태를 정리한다.
  useEffect(() => {
    if (!isMobile) setDrawerOpen(false);
  }, [isMobile]);

  // ESC 로 드로어 닫기.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

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

  // FIX-260914 — 세션에 authSource 가 없는 사용자는 /me 로 한 번 보충한다.
  // 스토어가 localStorage 에 persist 되므로, 이 필드가 생기기 전에 로그인한
  // 사용자는 재로그인 전까지 AMA 전용 동작(상담 삭제)이 보이지 않는다.
  const setAuth = useAuthStore((s) => s.setAuth);
  const token = useAuthStore((s) => s.token);
  useEffect(() => {
    if (!token || !user || user.authSource) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetchMe();
        if (cancelled || !res.user.authSource) return;
        setAuth(token, { ...user, authSource: res.user.authSource });
      } catch {
        // 보충 실패는 조용히 넘긴다 — 다음 로그인에 정상 채워진다.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, user, setAuth]);

  // REQ-260903C — 사이드바 채팅 미읽음 배지 (전역, 이벤트 시 invalidate 로 갱신).
  const isTalkRole = user?.role === 'ADMIN' || user?.role === 'APP_ADMIN';
  const { data: talkChannels } = useQuery({
    queryKey: ['talk-channels', 'admin'],
    queryFn: () => talkApi.channels('admin'),
    enabled: isTalkRole,
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
  });
  const chatUnread = (talkChannels ?? []).reduce(
    (sum, c) => sum + (c.unreadCount ?? 0),
    0,
  );

  // REQ-260621 — force seeded/admin-reset accounts to rotate before any use.
  if (user?.mustChangePassword) {
    return <Navigate to="/admin/change-password" replace />;
  }

  return (
    <div className="min-h-screen bg-canvas text-primary">
      <AdminRealtime />
      <header className="fixed inset-x-0 top-0 z-30 h-header bg-surface border-b border-[var(--border-subtle)] flex items-center justify-between px-3 sm:px-6">
        <div className="flex items-center gap-2">
          {/* PLN-260914 — 모바일: 드로어 열기 / 데스크톱: 아이콘 모드 토글.
              태블릿은 항상 아이콘 모드라 토글을 노출하지 않는다. */}
          {isMobile ? (
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="-ml-1 rounded-md p-2 text-secondary hover:bg-[var(--gray-100)] hover:text-primary"
              aria-label={t('nav.openMenu', '메뉴 열기')}
              aria-expanded={drawerOpen}
            >
              <Menu size={20} />
            </button>
          ) : (
            isDesktop && (
              <button
                type="button"
                onClick={toggleSidebar}
                className="-ml-1 rounded-md p-2 text-secondary hover:bg-[var(--gray-100)] hover:text-primary"
                aria-label={
                  iconOnly
                    ? t('nav.expandMenu', '메뉴 펼치기')
                    : t('nav.collapseMenu', '메뉴 접기')
                }
                title={
                  iconOnly
                    ? t('nav.expandMenu', '메뉴 펼치기')
                    : t('nav.collapseMenu', '메뉴 접기')
                }
              >
                {iconOnly ? (
                  <PanelLeftOpen size={20} />
                ) : (
                  <PanelLeftClose size={20} />
                )}
              </button>
            )
          )}
          {/* REQ-260621 — brand now links to the admin home, label simplified to "ACM". */}
          <Link to="/admin" className="font-semibold text-lg text-accent-700">
            ACM
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
        </div>
      </header>

      {/* PLN-260914 — 모바일 드로어 오버레이. */}
      {isMobile && drawerOpen && (
        <div
          className="fixed inset-0 top-header z-20 bg-black/50"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={clsx(
          'fixed left-0 top-header bottom-0 z-20 bg-surface border-r border-[var(--border-subtle)] flex flex-col transition-[width,transform] duration-200',
          iconOnly ? 'w-sidebar-icon' : 'w-sidebar',
          // 모바일은 드로어 — 닫히면 화면 밖으로 밀어둔다.
          isMobile && (drawerOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'),
        )}
        aria-label={t('nav.mainMenu', '주 메뉴')}
        aria-hidden={isMobile && !drawerOpen}
      >
        {isMobile && (
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="absolute right-2 top-2 rounded-md p-1.5 text-secondary hover:bg-[var(--gray-100)]"
            aria-label={t('nav.closeMenu', '메뉴 닫기')}
          >
            <X size={18} />
          </button>
        )}
        <nav className="flex flex-col gap-1 px-2 py-4 flex-1 overflow-y-auto">
          {visibleNav.map(({ to, icon: Icon, key }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-md py-2 text-sm font-medium transition-colors',
                  iconOnly ? 'justify-center px-0' : 'px-3',
                  isActive
                    ? 'bg-accent-50 text-accent-700'
                    : 'text-secondary hover:bg-[var(--gray-100)]',
                )
              }
              title={iconOnly ? t(`nav.${key}`) : undefined}
              aria-label={iconOnly ? t(`nav.${key}`) : undefined}
            >
              <span className="relative shrink-0">
                <Icon size={18} />
                {/* 아이콘 모드에서는 숫자 배지가 들어갈 자리가 없어 점으로 줄인다. */}
                {iconOnly && key === 'chat' && chatUnread > 0 && (
                  <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" />
                )}
              </span>
              {!iconOnly && (
                <>
                  <span className="flex-1">{t(`nav.${key}`)}</span>
                  {key === 'chat' && chatUnread > 0 && (
                    <span className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-semibold text-white">
                      {chatUnread > 99 ? '99+' : chatUnread}
                    </span>
                  )}
                </>
              )}
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
                  'mb-2 flex items-center gap-3 rounded-md py-2 text-sm font-medium transition-colors',
                  iconOnly ? 'justify-center px-0' : 'px-3',
                  isActive
                    ? 'bg-accent-50 text-accent-700'
                    : 'text-secondary hover:bg-[var(--gray-100)]',
                )
              }
            >
              <ShieldCheck size={18} />
              {!iconOnly && t('nav.systemAdmin')}
            </NavLink>
          )}
          {/* 아이콘 모드에서는 이메일을 숨긴다 — 64px 안에서 읽을 수 없다. */}
          {user?.email && !iconOnly && (
            <div className="px-3 pb-2 text-xs text-secondary truncate" title={user.email}>
              {user.email}
            </div>
          )}
          <button
            type="button"
            onClick={onLogout}
            className={clsx(
              'flex w-full items-center gap-3 rounded-md py-2 text-sm font-medium text-secondary transition-colors hover:bg-[var(--gray-100)] hover:text-primary',
              iconOnly ? 'justify-center px-0' : 'px-3',
            )}
            aria-label={tAuth('session.logout')}
            title={iconOnly ? tAuth('session.logout') : undefined}
          >
            <LogOut size={18} />
            {!iconOnly && tAuth('session.logout')}
          </button>
        </div>
      </aside>

      <main
        className={clsx(
          'mt-header p-3 sm:p-4 lg:p-6 transition-[margin] duration-200',
          // 모바일은 드로어라 본문을 밀지 않는다.
          isMobile ? 'ml-0' : iconOnly ? 'ml-sidebar-icon' : 'ml-sidebar',
        )}
      >
        <Outlet />
      </main>
    </div>
  );
}
