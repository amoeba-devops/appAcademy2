import { useState, useLayoutEffect, useRef } from "react";
import { NavLink, Link, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Bell,
  CalendarRange,
  FolderOpen,
  Link2,
  MessagesSquare,
  Users,
  UserCircle,
  MoreHorizontal,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { NotificationBell } from "@/modules/notifications/components-inbox";
import { PushEnableBanner } from "@/modules/notifications/push-settings";
import { ChatUnreadLink } from "@/modules/talk/components/chat-unread-link";
import { useAuthStore } from "@/stores/auth.store";
import { usePortalMenus, usePortalMenuSync } from "../hooks/use-portal-menus";
import { usePortalLogout } from "../hooks/use-portal-logout";
import "./portal-ui.css";

const NAV = [
  {
    to: "/portal/calendar",
    icon: CalendarRange,
    key: "calendar",
    teacherOnly: true,
  },
  { to: "/portal/links", icon: Link2, key: "links", learnerOnly: true },
  { to: "/portal/students", icon: Users, key: "students", teacherOnly: true },
  { to: "/portal/materials", icon: FolderOpen, key: "materials" },
  { to: "/portal/chat", icon: MessagesSquare, key: "chat", teacherOnly: true },
  { to: "/portal/notices", icon: Bell, key: "notices" },
  { to: "/portal/me", icon: UserCircle, key: "me" },
];

export function PortalShell() {
  const { t } = useTranslation("common");
  const user = useAuthStore((s) => s.portal.user);
  const location = useLocation();
  const logout = usePortalLogout();
  const scrollPositions = useRef(new Map<string, number>());
  const previousPath = useRef(location.pathname);
  useLayoutEffect(() => {
    const key = [
      user?.entId,
      user?.id,
      location.pathname,
      location.search,
    ].join(":");
    if (previousPath.current !== location.pathname) {
      window.scrollTo(0, scrollPositions.current.get(key) ?? 0);
    }
    previousPath.current = location.pathname;
    return () => {
      scrollPositions.current.set(key, window.scrollY);
    };
  }, [location.pathname, location.search, user?.entId, user?.id]);

  const [moreOpen, setMoreOpen] = useState(false);
  const moreTrigger = useRef<HTMLButtonElement>(null);
  usePortalMenuSync();
  const menus = usePortalMenus();
  // Account access stays available; failed settings must never reveal other menus.
  const visible = new Set<string>(
    menus.isError ? [] : (menus.data?.visible ?? []),
  );
  visible.add("me");
  const nav = NAV.filter(
    (n) =>
      visible.has(n.key) &&
      (!n.teacherOnly || user?.kind === "TEACHER") &&
      (!n.learnerOnly || user?.kind !== "TEACHER"),
  );
  const teacher = user?.kind === "TEACHER";
  const primary = teacher
    ? nav.filter((n) => !["me", "notices"].includes(n.key))
    : nav;
  const extra = teacher
    ? nav.filter((n) => ["me", "notices"].includes(n.key))
    : [];
  const chatOpen =
    location.pathname === "/portal/chat" &&
    new URLSearchParams(location.search).has("channelId");
  const moreActive = extra.some((n) => location.pathname.startsWith(n.to));
  const item = (n: (typeof NAV)[number], close = false) => {
    const Icon = n.icon;
    return (
      <NavLink
        key={n.key}
        to={n.to}
        title={t("portalApp.nav." + n.key)}
        onClick={() => {
          if (close) setMoreOpen(false);
        }}
        className={({ isActive }) =>
          "portal-nav-item " + (isActive ? "is-active" : "")
        }
      >
        <Icon size={20} aria-hidden />
        <span>{t("portalApp.nav." + n.key)}</span>
        {n.key === "chat" && <ChatUnreadLink mode="portal" badgeOnly />}
      </NavLink>
    );
  };
  return (
    <div className={"portal-workspace " + (chatOpen ? "portal-chat-open" : "")}>
      <a className="portal-skip" href="#portal-content">
        {t("portalUi.skip")}
      </a>
      <header className="portal-header">
        <strong className="text-primary">{t("portalApp.title")}</strong>
        {user && (
          <span className="portal-role">
            {t("portalApp.role." + user.kind)}
          </span>
        )}
        <div className="portal-header-tools">
          {teacher && <NotificationBell mode="portal" showPushPrompt={false} />}
          <LanguageSwitcher />
          <Link
            to="/portal/me"
            className="portal-account"
            aria-label={t("portalApp.nav.me")}
          >
            <UserCircle size={24} aria-hidden />
            <span>{t("portalApp.nav.me")}</span>
          </Link>
        </div>
      </header>
      <div className="portal-body">
        <aside className="portal-sidebar">
          <nav aria-label={t("portalUi.navigation")}>
            {nav.map((n) => item(n))}
          </nav>
          <button className="portal-logout" type="button" onClick={logout}>
            {t("portalApp.logout")}
          </button>
        </aside>
        <main id="portal-content" tabIndex={-1} className="portal-content">
          {teacher && !chatOpen && (
            <div className="portal-push">
              <PushEnableBanner mode="portal" />
            </div>
          )}
          {menus.isError && location.pathname === "/portal/me" && (
            <div role="alert" className="portal-settings-error">
              {t("portalUi.menuError")}
              <button type="button" onClick={() => void menus.refetch()}>
                {t("portalApp.cal.retry")}
              </button>
            </div>
          )}
          <Outlet />
        </main>
      </div>
      <nav
        className="portal-bottom"
        aria-label={t("portalUi.mobileNavigation")}
      >
        {primary.map((n) => item(n))}
        {extra.length > 0 && (
          <button
            ref={moreTrigger}
            type="button"
            className={"portal-nav-item " + (moreActive ? "is-active" : "")}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen(true)}
          >
            <MoreHorizontal size={20} aria-hidden />
            <span>{t("portalUi.more")}</span>
          </button>
        )}
      </nav>
      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent
          className="portal-more"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            moreTrigger.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("portalUi.more")}</DialogTitle>
          </DialogHeader>
          <nav aria-label={t("portalUi.more")}>
            {extra.map((n) => item(n, true))}
          </nav>
          <button type="button" className="portal-logout" onClick={logout}>
            {t("portalApp.logout")}
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
