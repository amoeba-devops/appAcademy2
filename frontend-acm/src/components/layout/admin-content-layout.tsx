import {
  createContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Lightbulb, PanelRightClose, PanelRightOpen } from "lucide-react";

import { useAuthStore } from "@/stores/auth.store";

function readPanelHidden(key: string | null): boolean {
  try {
    return key !== null && localStorage.getItem(key) === "hidden";
  } catch {
    return false;
  }
}

export const AdminSupportSlot = createContext<{
  target: HTMLDivElement | null;
  show: () => void;
} | null>(null);

type SupportBanner = { src: string; alt: string; href?: string };
export function AdminSupportPanel({
  banner,
  onHide,
  chatRef,
}: {
  banner?: SupportBanner;
  onHide: () => void;
  chatRef?: (node: HTMLDivElement | null) => void;
}) {
  const { pathname } = useLocation();
  const { t } = useTranslation("common");
  const module = pathname.split("/")[2];
  const tip =
    module === "std"
      ? "students"
      : module === "sch"
        ? "schools"
        : module === "cal-stats"
          ? "stats"
          : module === "cal"
            ? "calendar"
            : module === "config"
              ? "settings"
              : module === "chat"
                ? "chat"
                : module === "posts"
                  ? "posts"
                  : "general";
  const bannerImage = banner && (
    <img
      src={banner.src}
      alt={banner.alt}
      className="h-auto w-full rounded-lg"
    />
  );
  return (
    <aside
      id="admin-support-panel"
      className="admin-support-panel space-y-4"
      aria-label={t("adminLayout.support")}
    >
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onHide}
          aria-expanded={true}
          aria-controls="admin-support-panel"
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-secondary hover:bg-surface focus-visible:outline focus-visible:outline-2"
        >
          {t("adminLayout.hidePanel")}
          <PanelRightClose size={16} aria-hidden="true" />
        </button>
      </div>
      {chatRef ? (
        <div ref={chatRef} />
      ) : (
        <section className="rounded-lg border border-[var(--border-subtle)] bg-surface p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-primary">
            <Lightbulb size={16} aria-hidden="true" />
            {t("adminLayout.tips")}
          </h2>
          <p className="text-sm leading-6 text-secondary break-words">
            {t(`adminLayout.${tip}`)}
          </p>
        </section>
      )}
      {banner && (
        <section className="rounded-lg border border-[var(--border-subtle)] bg-surface p-3">
          {banner.href ? <a href={banner.href}>{bannerImage}</a> : bannerImage}
        </section>
      )}
    </aside>
  );
}

export function AdminContentLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { t } = useTranslation("common");
  const user = useAuthStore((state) => state.user);
  const storageKey = user ? `acm:admin-support:${user.entId}:${user.id}` : null;
  const [preference, setPreference] = useState(() => ({
    key: storageKey,
    hidden: readPanelHidden(storageKey),
  }));
  const hidden =
    preference.key === storageKey
      ? preference.hidden
      : readPanelHidden(storageKey);
  const setHidden = (value: boolean) => {
    setPreference({ key: storageKey, hidden: value });
    try {
      if (storageKey)
        localStorage.setItem(storageKey, value ? "hidden" : "visible");
    } catch {
      /* The control still works when browser storage is unavailable. */
    }
  };
  const [chatTarget, setChatTarget] = useState<HTMLDivElement | null>(null);
  const isChat = pathname.replace(/\/$/, "") === "/admin/chat";
  const containerRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(0);
  const isDashboard = [
    "/admin",
    "/admin/",
    "/admin/dashboard",
    "/admin/dashboard/",
  ].includes(pathname);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // Container containment would change fixed-position custom dialogs' viewport.
    // Measure the frame without introducing a containing block for those dialogs.
    const observer = new ResizeObserver(([entry]) =>
      setAvailableWidth(entry.contentRect.width),
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, [isDashboard]);
  if (isDashboard) return <>{children}</>;
  return (
    <AdminSupportSlot.Provider
      value={{
        target: isChat ? chatTarget : null,
        show: () => {
          setHidden(false);
          requestAnimationFrame(() =>
            chatTarget?.scrollIntoView({
              behavior: "smooth",
              block: "nearest",
            }),
          );
        },
      }}
    >
      <div
        ref={containerRef}
        className={`admin-content-container ${hidden ? "admin-support-hidden" : ""} ${availableWidth >= 1176 ? "admin-content-wide" : ""} ${availableWidth < 640 ? "admin-content-narrow" : ""}`}
      >
        {hidden && (
          <div className="mb-3 flex justify-end">
            <button
              type="button"
              onClick={() => setHidden(false)}
              aria-expanded={false}
              aria-controls="admin-support-panel"
              className="inline-flex items-center gap-1 rounded border border-[var(--border-subtle)] bg-surface px-3 py-1.5 text-sm text-secondary focus-visible:outline focus-visible:outline-2"
            >
              <PanelRightOpen size={16} aria-hidden="true" />
              {t("adminLayout.showPanel")}
            </button>
          </div>
        )}
        <div className="admin-content-grid">
          <div className="admin-page-content">{children}</div>
          <div hidden={hidden}>
            <AdminSupportPanel
              chatRef={isChat ? setChatTarget : undefined}
              onHide={() => setHidden(true)}
            />
          </div>
        </div>
      </div>
    </AdminSupportSlot.Provider>
  );
}
