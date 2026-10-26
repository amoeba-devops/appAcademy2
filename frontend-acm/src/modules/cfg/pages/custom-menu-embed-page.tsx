import { useState } from "react";
import { useParams } from "react-router-dom";
import { clsx } from "clsx";
import { useTranslation } from "react-i18next";
import { ExternalLink } from "lucide-react";
import { useMyMenus } from "@/modules/system/hooks/use-my-menus";

const GOOGLE_DOC =
  /^https:\/\/docs\.google\.com\/(spreadsheets|document|presentation)\/d\/([\w-]+)/;
const VIEW_KEY = "acm.embed.view";

/**
 * 구글 문서는 iframe 안 편집 화면이 구글 로그인(서드파티 쿠키)을 요구한다.
 * 로그인되지 않은 브라우저를 위해 보기 전용 주소를 만든다. 구글 문서가 아니면 null.
 */
export function googleViewUrl(url: string): string | null {
  const m = GOOGLE_DOC.exec(url);
  if (!m) return null;
  const base = `https://docs.google.com/${m[1]}/d/${m[2]}`;
  if (m[1] !== "spreadsheets") return `${base}/preview`;
  const gid = /[#?&]gid=(\d+)/.exec(url)?.[1];
  return `${base}/htmlview${gid ? `?gid=${gid}` : ""}`;
}

function readViewMode(id: string): boolean {
  try {
    return (
      JSON.parse(localStorage.getItem(VIEW_KEY) ?? "[]") as unknown[]
    ).includes(id);
  } catch {
    return false;
  }
}
function writeViewMode(id: string, view: boolean) {
  try {
    const ids = (
      JSON.parse(localStorage.getItem(VIEW_KEY) ?? "[]") as unknown[]
    ).filter((x) => x !== id);
    localStorage.setItem(VIEW_KEY, JSON.stringify(view ? [...ids, id] : ids));
  } catch {
    // 저장 실패는 무시 — 다음 방문엔 편집 화면으로 시작한다.
  }
}

/**
 * REQ-261026B — 사용자 메뉴 '화면 안에 열기'. 본문 영역 전체 높이 iframe.
 * 사이드바와 같은 목록(등급 필터 적용)에서 찾으므로 볼 수 없는 항목은 '메뉴 없음'.
 */
export function CustomMenuEmbedPage() {
  const { t } = useTranslation("common");
  const { id } = useParams();
  const { data, isLoading } = useMyMenus();
  const item = data?.custom.find((c) => c.id === id && c.openMode === "EMBED");
  // 구글 문서: 편집 화면 ↔ 보기 화면 전환(브라우저별로 기억).
  const [viewIds, setViewIds] = useState<Record<string, boolean>>({});
  const viewUrl = item ? googleViewUrl(item.url) : null;
  const viewOnly =
    !!item && !!viewUrl && (viewIds[item.id] ?? readViewMode(item.id));
  const setViewOnly = (view: boolean) => {
    if (!item) return;
    writeViewMode(item.id, view);
    setViewIds((old) => ({ ...old, [item.id]: view }));
  };
  const src = item && viewOnly && viewUrl ? viewUrl : item?.url;

  if (isLoading) return <p role="status">{t("configAccess.loading")}</p>;
  if (!item)
    return (
      <p role="alert" className="text-sm text-secondary">
        {t("tenantConfig.customMenus.embedNotFound")}
      </p>
    );
  return (
    // 본문(main) 위아래 여백(p-3/p-4/p-6)과 헤더(56px)를 뺀 높이.
    <div className="flex h-[calc(100dvh-56px-24px)] min-w-0 flex-col gap-2 sm:h-[calc(100dvh-56px-32px)] lg:h-[calc(100dvh-56px-48px)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="truncate text-xl font-semibold text-primary">
          {item.name}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          {viewUrl && (
            <div
              role="group"
              aria-label={t("tenantConfig.customMenus.viewModeLabel")}
              className="inline-flex rounded-md border border-[var(--border-subtle)] p-0.5"
            >
              {([false, true] as const).map((view) => (
                <button
                  key={String(view)}
                  type="button"
                  aria-pressed={viewOnly === view}
                  onClick={() => setViewOnly(view)}
                  className={clsx(
                    "min-h-8 rounded px-3 text-sm",
                    viewOnly === view
                      ? "bg-accent-50 font-medium text-accent-700"
                      : "text-secondary hover:text-primary",
                  )}
                >
                  {t(
                    view
                      ? "tenantConfig.customMenus.viewModeView"
                      : "tenantConfig.customMenus.viewModeEdit",
                  )}
                </button>
              ))}
            </div>
          )}
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-9 items-center gap-1 rounded-md border border-[var(--border-subtle)] px-3 text-sm text-secondary hover:bg-[var(--gray-50)] hover:text-primary"
          >
            <ExternalLink size={14} />
            {t("tenantConfig.customMenus.openNewTab")}
          </a>
        </div>
      </div>
      <iframe
        key={src}
        src={src}
        title={item.name}
        className="min-h-0 w-full flex-1 rounded-lg border border-[var(--border-subtle)] bg-surface"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
        referrerPolicy="no-referrer-when-downgrade"
        allow="clipboard-read; clipboard-write; fullscreen"
      />
      <p className="text-xs text-secondary">
        {t(
          viewUrl
            ? "tenantConfig.customMenus.embedHintGoogle"
            : "tenantConfig.customMenus.embedHint",
        )}
      </p>
    </div>
  );
}
