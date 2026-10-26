import { forgetDevicePush } from "@/modules/notifications/push-settings";
import { ChatUnreadLink } from "@/modules/talk/components/chat-unread-link";
import { useConfigAccess } from "@/modules/cfg/hooks/use-config-access";
import { apiClient } from "@/lib/api-client";
import { NotificationBell } from "@/modules/notifications/components-inbox";
import { AdminContentLayout } from "./admin-content-layout";
import { StudentNavigation } from "@/modules/std/components/student-navigation";
import { useEffect, useState } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  LayoutDashboard,
  FolderKanban,
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
  Wallet,
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
  Building2,
  CircleDot,
  ListTodo,
  ChevronDown,
  ChevronRight,
  KeyRound,
  Bookmark,
  ExternalLink,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { InstallAppNavButton } from "@/components/pwa/install-app";
import { clsx } from "clsx";
import { useQuery } from "@tanstack/react-query";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { AdminRealtime } from "@/components/layout/admin-realtime";
import { useAuthStore } from "@/stores/auth.store";
import { useMyMenus } from "@/modules/system/hooks/use-my-menus";
import { talkApi } from "@/modules/talk/api/talk-api";
import { useUiStore } from "@/stores/ui.store";
import { me as fetchMe } from "@/modules/auth/api/auth-api";
import { useIsDesktop, useIsMobile } from "@/hooks/use-media-query";

// REQ-261015C — 메뉴 그룹. 그룹 안 순서는 테넌트 저장 순서(기본: 표준 키 순서)를 따른다.
// REQ-261026 — bookmarks 는 테넌트 사용자 메뉴(북마크) 전용 그룹.
type NavGroup = "academy" | "work" | "bookmarks" | "settings";
const NAV_GROUPS: NavGroup[] = ["academy", "work", "bookmarks", "settings"];
const NAV = [
  { to: "/admin/dashboard", icon: LayoutDashboard, key: "dashboard", group: "academy" },
  { to: "/admin/csl", icon: Users, key: "csl", group: "academy" },
  { to: "/admin/std", icon: UserRound, key: "std", group: "academy" },
  { to: "/admin/std/parents", icon: Users2, key: "parents", group: "academy" },
  { to: "/admin/tch", icon: UserCog, key: "tch", group: "academy" },
  // PLN-260729-2 — 수업통계 대시보드
  { to: "/admin/cal-stats", icon: BarChart3, key: "calStats", group: "academy" },
  { to: "/admin/complaints", icon: MessageCircleQuestion, key: "complaints", group: "academy" },
  { to: "/admin/pay", icon: Wallet, key: "pay", group: "academy" },
  // CSL-PLN-260916 — 맵테스트 신청 목록
  { to: "/admin/test", icon: FileText, key: "mapApply", group: "academy" },
  { to: "/admin/cls", icon: GraduationCap, key: "cls", group: "academy" },
  { to: "/admin/stf", icon: Briefcase, key: "stf", group: "academy" },
  { to: "/admin/cal", icon: CalendarDays, key: "cal", group: "academy" },
  { to: "/admin/sch", icon: School, key: "sch", group: "academy" },
  { to: "/admin/ref", icon: BookOpen, key: "ref", group: "academy" },
  { to: "/admin/posts", icon: Newspaper, key: "posts", group: "academy" },
  { to: "/admin/notifications", icon: Bell, key: "notifications", group: "academy" },
  { to: "/admin/enrollments", icon: ClipboardList, key: "enrollments", group: "academy" },
  { to: "/admin/map", icon: BookOpenCheck, key: "map", group: "academy" },
  { to: "/admin/qna", icon: MessageCircleQuestion, key: "qna", group: "academy" },
  // REQ-260728C — 로비채팅 (운영자↔강사)
  { to: "/admin/chat", icon: MessagesSquare, key: "chat", group: "work" },
  // REQ-261015C — 내 업무 / 이슈 (ACM 프로젝트 이슈)
  { to: "/admin/my-work", icon: ListTodo, key: "myWork", group: "work" },
  { to: "/admin/issues", icon: CircleDot, key: "issues", group: "work" },
  { to: "/admin/projects", icon: FolderKanban, key: "projects", group: "work" },
  { to: "/admin/documents", icon: FolderKanban, key: "documents", group: "work" },
  { to: "/admin/drive", icon: FolderKanban, key: "drive", group: "work" },
  // REQ-261021B — 감사(테넌트 마스터·감사 조회 권한). 권한으로만 노출.
  { to: "/admin/audit", icon: ShieldCheck, key: "audit", group: "settings" },
  // REQ-261015C — 테넌트 설정(테넌트 마스터) / 서비스 설정(서비스 운영자). 권한으로만 노출.
  { to: "/admin/tenant", icon: Building2, key: "tenantConfig", group: "settings" },
  { to: "/admin/config", icon: Settings, key: "config", group: "settings" },
  // REQ-261017 — 비밀번호 재발급 요청(관리자 전용)
  { to: "/admin/password-requests", icon: KeyRound, key: "passwordRequests", group: "settings" },
] as const satisfies readonly {
  to: string;
  icon: unknown;
  key: string;
  group: NavGroup;
}[];
const GROUP_STATE_KEY = "acm.nav.collapsedGroups";
function readCollapsedGroups(): NavGroup[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(GROUP_STATE_KEY) ?? "[]");
    return Array.isArray(v) ? (v.filter((g) => NAV_GROUPS.includes(g)) as NavGroup[]) : [];
  } catch {
    return [];
  }
}

export function AppShell() {
  const { t } = useTranslation("common");
  const { t: tAuth } = useTranslation("auth");
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
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  // REQ-260621 v1.1 / PLN-260728E — per-tenant 메뉴 가시성 + 순서(UI-only).
  // Fail-open: 로딩/오류 시 전체 표시·기본(NAV) 순서.
  const { data: menus } = useMyMenus();
  const configAccess = useConfigAccess();
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
  const visibleNav = NAV.filter(
    (n) =>
      (n.key === "config"
        ? configAccess.allowed
        : n.key === "tenantConfig"
          ? configAccess.tenantAllowed
          : n.key === "audit"
            ? configAccess.auditAllowed
            : n.key === "passwordRequests"
            ? ["ADMIN", "APP_ADMIN"].includes(user?.role ?? "")
            : !hiddenSet.has(n.key)) &&
      (n.key !== "pay" ||
        // REQ-261015C — 테넌트 마스터는 허가된 메뉴를 모두 본다.
        configAccess.tenantAllowed ||
        ["ADMIN", "APP_ADMIN", "STAFF"].includes(user?.role ?? "")),
  )
    .slice()
    .sort((a, b) => (rank.get(a.key) ?? 999) - (rank.get(b.key) ?? 999));

  const [collapsedGroups, setCollapsedGroups] =
    useState<NavGroup[]>(readCollapsedGroups);
  const toggleGroup = (g: NavGroup) =>
    setCollapsedGroups((prev) => {
      const next = prev.includes(g)
        ? prev.filter((x) => x !== g)
        : [...prev, g];
      try {
        localStorage.setItem(GROUP_STATE_KEY, JSON.stringify(next));
      } catch {
        // 저장 실패는 무시 — 다음 방문에 기본(펼침)으로 보인다.
      }
      return next;
    });
  // 현재 경로가 접힌 그룹 안에 있으면 그 그룹은 펼친 것으로 본다.
  const activeGroup = visibleNav.find((n) =>
    location.pathname.startsWith(n.to),
  )?.group;

  const onLogout = () => {
    forgetDevicePush("admin"); // REQ-261020C — 직접 로그아웃만 이 기기 푸시 해제
    // REQ-261021B — 접속 로그에 로그아웃 기록(토큰을 직접 실어 보낸 뒤 바로 정리, 실패해도 로그아웃)
    const current = useAuthStore.getState().token;
    if (current)
      void apiClient
        .post("/acm/auth/logout", null, { headers: { Authorization: `Bearer ${current}` } })
        .catch(() => undefined);
    clear();
    navigate("/login", { replace: true });
  };

  // FIX-260914 — 세션에 authSource 가 없는 사용자는 /me 로 한 번 보충한다.
  // 스토어가 localStorage 에 persist 되므로, 이 필드가 생기기 전에 로그인한
  // 사용자는 재로그인 전까지 AMA 전용 동작(상담 삭제)이 보이지 않는다.
  const setAuth = useAuthStore((s) => s.setAuth);
  const token = useAuthStore((s) => s.token);
  useEffect(() => {
    // REQ-261017 — 이름(좌측 하단 표시)도 없으면 함께 보충한다.
    if (!token || !user || (user.authSource && user.name)) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetchMe();
        if (cancelled) return;
        setAuth(token, {
          ...user,
          authSource: res.user.authSource ?? user.authSource,
          name: res.user.name || user.name || user.email?.split("@")[0],
        });
      } catch {
        // 보충 실패는 조용히 넘긴다 — 다음 로그인에 정상 채워진다.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, user, setAuth]);

  // REQ-260903C — 사이드바 채팅 미읽음 배지 (전역, 이벤트 시 invalidate 로 갱신).
  const isTalkRole = user?.role === "ADMIN" || user?.role === "APP_ADMIN";
  const { data: talkChannels } = useQuery({
    queryKey: [
      "talk-channels",
      "admin",
      `${user?.entId ?? ""}:${user?.id ?? ""}`,
      "active",
    ],
    queryFn: () => talkApi.channels("admin"),
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
    <div className="admin-shell min-h-screen bg-canvas text-primary">
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
              aria-label={t("nav.openMenu", "메뉴 열기")}
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
                    ? t("nav.expandMenu", "메뉴 펼치기")
                    : t("nav.collapseMenu", "메뉴 접기")
                }
                title={
                  iconOnly
                    ? t("nav.expandMenu", "메뉴 펼치기")
                    : t("nav.collapseMenu", "메뉴 접기")
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
          <Link to="/admin" className="inline-flex min-h-10 items-center px-1 font-semibold text-lg text-accent-700 sm:min-h-0 sm:px-0">
            ACM
          </Link>
        </div>
        <div className="flex min-w-0 items-center gap-1 sm:gap-3">
          <ChatUnreadLink mode="admin" />
          <NotificationBell />
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
          "fixed left-0 top-header bottom-0 z-20 bg-surface border-r border-[var(--border-subtle)] flex flex-col transition-[width,transform] duration-200",
          iconOnly ? "w-sidebar-icon" : "w-sidebar",
          // 모바일은 드로어 — 닫히면 화면 밖으로 밀어둔다.
          isMobile &&
            (drawerOpen ? "translate-x-0 shadow-xl" : "-translate-x-full"),
        )}
        aria-label={t("nav.mainMenu", "주 메뉴")}
        aria-hidden={isMobile && !drawerOpen}
      >
        {isMobile && (
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="absolute right-2 top-2 rounded-md p-1.5 text-secondary hover:bg-[var(--gray-100)]"
            aria-label={t("nav.closeMenu", "메뉴 닫기")}
          >
            <X size={18} />
          </button>
        )}
        <nav className="flex flex-col gap-1 px-2 py-4 flex-1 overflow-y-auto">
          {NAV_GROUPS.map((group) => {
            const items = visibleNav.filter((n) => n.group === group);
            const bookmarks = group === "bookmarks" ? (menus?.custom ?? []) : [];
            if (!items.length && !bookmarks.length) return null;
            const collapsed =
              !iconOnly &&
              group !== "settings" &&
              collapsedGroups.includes(group) &&
              activeGroup !== group;
            return (
              <div key={group} className="flex flex-col gap-1">
                {iconOnly || group === "settings" ? (
                  <div className="mx-2 my-1 border-t border-[var(--border-subtle)]" />
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group)}
                    aria-expanded={!collapsed}
                    className="mt-2 flex items-center justify-between rounded-md px-3 py-1 text-xs font-semibold uppercase tracking-wide text-secondary hover:bg-[var(--gray-100)] first:mt-0"
                  >
                    {t(`nav.group.${group}`)}
                    {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  </button>
                )}
                {!collapsed &&
          items.map(({ to, icon: Icon, key }) =>
            key === "std" ? (
              <StudentNavigation
                key={to}
                iconOnly={iconOnly}
                onNavigate={() => setDrawerOpen(false)}
              />
            ) : (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  clsx(
                    "flex items-center gap-3 rounded-md py-2 text-sm font-medium transition-colors",
                    iconOnly ? "justify-center px-0" : "px-3",
                    isActive
                      ? "bg-accent-50 text-accent-700"
                      : "text-secondary hover:bg-[var(--gray-100)]",
                  )
                }
                title={iconOnly ? t(`nav.${key}`) : undefined}
                aria-label={iconOnly ? t(`nav.${key}`) : undefined}
              >
                <span className="relative shrink-0">
                  <Icon size={18} />
                  {/* 아이콘 모드에서는 숫자 배지가 들어갈 자리가 없어 점으로 줄인다. */}
                  {iconOnly && key === "chat" && chatUnread > 0 && (
                    <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" />
                  )}
                </span>
                {!iconOnly && (
                  <>
                    <span className="flex-1">{t(`nav.${key}`)}</span>
                    {key === "chat" && chatUnread > 0 && (
                      <span className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-semibold text-white">
                        {chatUnread > 99 ? "99+" : chatUnread}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            ),
          )}
                {!collapsed &&
                  bookmarks.map((b) => (
                    <BookmarkLink
                      key={b.id}
                      item={b}
                      iconOnly={iconOnly}
                      active={location.pathname + location.search === b.url}
                    />
                  ))}
              </div>
            );
          })}
        </nav>

        {/* REQ-260621 — user info + logout pinned to the sidebar bottom. */}
        <div className="border-t border-[var(--border-subtle)] px-2 py-3">
          {user?.role === "APP_ADMIN" && (
            <NavLink
              to="/system/admin"
              className={({ isActive }) =>
                clsx(
                  "mb-2 flex items-center gap-3 rounded-md py-2 text-sm font-medium transition-colors",
                  iconOnly ? "justify-center px-0" : "px-3",
                  isActive
                    ? "bg-accent-50 text-accent-700"
                    : "text-secondary hover:bg-[var(--gray-100)]",
                )
              }
            >
              <ShieldCheck size={18} />
              {!iconOnly && t("nav.systemAdmin")}
            </NavLink>
          )}
          {/* REQ-261017 — 이메일 대신 이름 + 옆에 ‘마이페이지’ 텍스트. 아이콘 모드는 사용자 아이콘만. */}
          {user &&
            (iconOnly ? (
              <Link
                to="/admin/me"
                className="mb-1 flex justify-center rounded-md py-2 text-secondary hover:bg-[var(--gray-100)] hover:text-primary"
                aria-label={t("nav.myPage")}
                title={user.name || user.email}
              >
                <UserRound size={18} />
              </Link>
            ) : (
              <div className="flex items-center gap-2 px-3 pb-2 text-xs">
                <UserRound size={14} className="shrink-0 text-secondary" />
                <span className="min-w-0 truncate font-medium text-primary" title={user.email}>
                  {user.name || user.email?.split("@")[0]}
                </span>
                <Link
                  to="/admin/me"
                  className="ml-auto shrink-0 text-accent-700 hover:underline"
                >
                  {t("nav.myPage")}
                </Link>
              </div>
            ))}
          {/* REQ-261018D — 앱 설치(설치 가능할 때만) */}
          <InstallAppNavButton iconOnly={iconOnly} />
          <button
            type="button"
            onClick={onLogout}
            className={clsx(
              "flex w-full items-center gap-3 rounded-md py-2 text-sm font-medium text-secondary transition-colors hover:bg-[var(--gray-100)] hover:text-primary",
              iconOnly ? "justify-center px-0" : "px-3",
            )}
            aria-label={tAuth("session.logout")}
            title={iconOnly ? tAuth("session.logout") : undefined}
          >
            <LogOut size={18} />
            {!iconOnly && tAuth("session.logout")}
          </button>
        </div>
      </aside>

      <main
        className={clsx(
          "mt-header p-3 sm:p-4 lg:p-6 transition-[margin] duration-200",
          // 모바일은 드로어라 본문을 밀지 않는다.
          isMobile ? "ml-0" : iconOnly ? "ml-sidebar-icon" : "ml-sidebar",
        )}
      >
        <AdminContentLayout>
          <Outlet />
        </AdminContentLayout>
      </main>
    </div>
  );
}

/** REQ-261026 — 사용자 메뉴(북마크). 내부 경로는 SPA 이동, 외부·새 탭은 일반 링크. */
function BookmarkLink({
  item,
  iconOnly,
  active,
}: {
  item: { name: string; url: string; newTab: boolean };
  iconOnly: boolean;
  active: boolean;
}) {
  const external = /^https?:\/\//.test(item.url);
  const Icon = external ? ExternalLink : Bookmark;
  const className = clsx(
    "flex items-center gap-3 rounded-md py-2 text-sm font-medium transition-colors",
    iconOnly ? "justify-center px-0" : "px-3",
    active
      ? "bg-accent-50 text-accent-700"
      : "text-secondary hover:bg-[var(--gray-100)]",
  );
  const body = (
    <>
      <Icon size={18} className="shrink-0" />
      {!iconOnly && <span className="flex-1 truncate">{item.name}</span>}
    </>
  );
  const label = iconOnly ? item.name : undefined;
  if (!external && !item.newTab)
    return (
      <Link to={item.url} className={className} title={label} aria-label={label}>
        {body}
      </Link>
    );
  return (
    <a
      href={item.url}
      className={className}
      title={label}
      aria-label={label}
      {...(item.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {body}
    </a>
  );
}
