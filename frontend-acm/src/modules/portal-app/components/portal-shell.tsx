import { forgetDevicePush } from "@/modules/notifications/push-settings";
import { ChatUnreadLink } from "@/modules/talk/components/chat-unread-link";
import { NotificationBell } from "@/modules/notifications/components-inbox";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Bell,
  CalendarRange,
  FolderOpen,
  LogOut,
  MessagesSquare,
  Users,
  UserCircle,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { apiClient } from "@/lib/api-client";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { useScrollHint } from "@/hooks/use-scroll-hint";

/**
 * PLN-260706 Phase 2 — unified portal shell for student/parent/teacher.
 * PLN-260719 C — 강사(TEACHER)에게는 수업일정 아래 "수강생관리" 메뉴 추가.
 */
const NAV = [
  { to: "/portal/notices", icon: Bell, key: "notices", end: false },
  { to: "/portal/calendar", icon: CalendarRange, key: "calendar", end: false },
  {
    to: "/portal/students",
    icon: Users,
    key: "students",
    end: false,
    teacherOnly: true,
  },
  { to: "/portal/materials", icon: FolderOpen, key: "materials", end: false },
  // REQ-260728C — 로비채팅 (강사 전용)
  {
    to: "/portal/chat",
    icon: MessagesSquare,
    key: "chat",
    end: false,
    teacherOnly: true,
  },
  // REQ-261015C — 마이페이지(사용자 타임존)
  { to: "/portal/me", icon: UserCircle, key: "me", end: false },
];

export function PortalShell() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.portal.user);
  const clearPortal = useAuthStore((s) => s.clearPortal);
  // TST-261019 M7 — 휴대폰 가로 메뉴: 오른쪽 흐림 표시 + 현재 메뉴 자동 스크롤.
  const { pathname } = useLocation();
  const { ref: navRef, hasMore: navHasMore } =
    useScrollHint<HTMLElement>(pathname);

  const logout = () => {
    forgetDevicePush("portal"); // REQ-261020C — 직접 로그아웃만 이 기기 푸시 해제
    // REQ-261021B — 접속 로그에 로그아웃 기록(토큰을 직접 실어 보낸 뒤 바로 정리, 실패해도 로그아웃)
    const current = useAuthStore.getState().portal.token;
    if (current)
      void apiClient
        .post("/portal/auth/logout", null, { headers: { Authorization: `Bearer ${current}` } })
        .catch(() => undefined);
    clearPortal();
    navigate("/portal/login", { replace: true });
  };

  const roleLabel = user ? t(`portalApp.role.${user.kind}`) : "";

  return (
    <div className="min-h-screen bg-canvas">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] bg-surface px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-primary">
            {t("portalApp.title")}
          </span>
          {user && (
            <span className="rounded-full bg-[var(--gray-100)] px-2 py-0.5 text-xs text-secondary">
              {roleLabel} · {user.loginId}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* REQ-260728B FR-6 — 포털 앱에서도 언어 선택 (ko/en/vi/zh-CN) */}
          {user?.kind === "TEACHER" && (
            <>
              <ChatUnreadLink mode="portal" />
              <NotificationBell mode="portal" />
            </>
          )}
          <LanguageSwitcher />
          <button
            onClick={logout}
            className="inline-flex items-center gap-1 text-sm text-secondary hover:text-primary"
          >
            <LogOut size={14} /> {t("portalApp.logout")}
          </button>
        </div>
      </header>

      {/* PLN-260719 R1 — 중앙정렬(mx-auto) 제거, 화면 좌측 붙임. */}
      <div className="flex max-w-5xl flex-col gap-4 px-3 py-4 sm:flex-row">
        <div className="relative w-full shrink-0 sm:w-40">
          <nav
            ref={navRef}
            className="flex w-full shrink-0 gap-1 overflow-x-auto sm:block sm:w-40 sm:space-y-1"
          >
            {NAV.filter((n) => !n.teacherOnly || user?.kind === "TEACHER").map(
              (n) => {
                const Icon = n.icon;
                return (
                  <NavLink
                    key={n.key}
                    to={n.to}
                    end={n.end}
                    className={({ isActive }) =>
                      `flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm ${
                        isActive
                          ? "bg-accent-600 text-white"
                          : "text-secondary hover:bg-[var(--gray-100)]"
                      }`
                    }
                  >
                    <Icon size={16} /> {t(`portalApp.nav.${n.key}`)}{" "}
                    {n.key === "chat" && (
                      <ChatUnreadLink mode="portal" badgeOnly />
                    )}
                  </NavLink>
                );
              },
            )}
          </nav>
          {navHasMore && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-canvas to-transparent sm:hidden"
            />
          )}
        </div>
        {/* PLN-260728E — 우측 컨텐츠 영역 흰 배경(채팅 페이지 참조). */}
        <main className="min-w-0 flex-1 rounded-lg border border-[var(--border-subtle)] bg-surface p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
