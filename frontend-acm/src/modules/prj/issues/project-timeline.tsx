import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import {
  ArrowRightLeft,
  FilePlus2,
  MessageSquare,
  Plus,
  RefreshCw,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { statusName } from "../types";
import { plainText } from "./issue-rich-text";
import { refLabel } from "./issue-model";

/** REQ-261112F — 프로젝트 타임라인(서버 project-timeline.ts 와 같은 종류). */
export const TIMELINE_KINDS = [
  "CREATE",
  "STATUS",
  "ASSIGNEE",
  "PROJECT",
  "COMMENT",
  "DOCUMENT",
] as const;
type Kind = (typeof TIMELINE_KINDS)[number];

export interface TimelineEvent {
  kind: Kind;
  eid: string;
  at: string;
  pit_id: string;
  prj_id?: string;
  prj_title?: string;
  pit_title: string;
  pit_ref_no: number | null;
  pit_kind: string;
  document_type: string | null;
  actor_name: string | null;
  from_status: string | null;
  to_status: string | null;
  from_user_name: string | null;
  to_user_name: string | null;
  note: string | null;
  body: string | null;
}
interface Page {
  items: TimelineEvent[];
  next: { before: string; beforeId: string } | null;
}

const ICONS: Record<Kind, LucideIcon> = {
  CREATE: Plus,
  STATUS: RefreshCw,
  ASSIGNEE: UserRound,
  PROJECT: ArrowRightLeft,
  COMMENT: MessageSquare,
  DOCUMENT: FilePlus2,
};

/** 오늘은 n분/n시간 전, 그 외 월/일 시:분 */
export function timelineTime(at: string, now = new Date()) {
  const d = new Date(at);
  const min = Math.floor((now.getTime() - d.getTime()) / 60000);
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay && min < 1) return { key: "justNow" as const };
  if (sameDay && min < 60) return { key: "minutesAgo" as const, count: min };
  if (sameDay) return { key: "hoursAgo" as const, count: Math.floor(min / 60) };
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    text: `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

const docKind = (e: TimelineEvent) =>
  e.document_type ?? (e.pit_kind === "FILE" ? "FILE" : "MEMO");

/**
 * projectId 만 주면 프로젝트 타임라인(REQ-261112F),
 * all 이면 접근 가능한 전체 프로젝트 이슈 타임라인 — projectId 는 화면 프로젝트 필터(REQ-261112G).
 */
export function ProjectTimeline({
  projectId,
  all = false,
}: {
  projectId?: string;
  all?: boolean;
}) {
  const { t } = useTranslation("prj");
  const [kind, setKind] = useState<Kind | "">("");
  const title = t(all ? "timeline.issuesTitle" : "timeline.title");
  const q = useInfiniteQuery({
    queryKey: ["prj", "timeline", all ? "all" : "project", projectId ?? "", kind],
    initialPageParam: null as Page["next"],
    queryFn: async ({ pageParam }) =>
      (
        await apiClient.get<Page>(
          all ? "/acm/prj/timeline" : `/acm/prj/projects/${projectId}/timeline`,
          {
            params: {
              kind: kind || undefined,
              projectId: all ? projectId || undefined : undefined,
              ...(pageParam ?? {}),
            },
          },
        )
      ).data,
    getNextPageParam: (last) => last.next,
  });
  const events = q.data?.pages.flatMap((p) => p.items) ?? [];
  const who = (name: string | null) => name ?? t("timeline.unknownUser");
  const detail = (e: TimelineEvent) => {
    switch (e.kind) {
      case "STATUS":
        return `${e.from_status ? statusName(e.from_status) : "—"} → ${statusName(e.to_status)}${e.note ? ` · ${e.note}` : ""}`;
      case "ASSIGNEE":
        return `${e.from_user_name ?? t("timeline.none")} → ${e.to_user_name ?? t("timeline.none")}`;
      case "PROJECT":
        return e.note ?? "";
      case "COMMENT": {
        const text = plainText(e.body ?? "").replace(/\s+/g, " ").trim();
        return text.length > 80 ? `${text.slice(0, 80)}…` : text;
      }
      case "DOCUMENT":
        return t(`docType.${docKind(e)}`);
      default:
        return "";
    }
  };
  return (
    <aside
      aria-label={title}
      className="flex max-h-[calc(100vh-7rem)] min-w-0 flex-col rounded-lg border border-[var(--border-subtle)] bg-surface xl:sticky xl:top-4"
    >
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] px-4 py-3">
        <h2 className="text-[15px] font-semibold text-primary">
          {title}
        </h2>
        <select
          aria-label={t("timeline.kindFilter")}
          className="admin-field !h-8 !px-2"
          value={kind}
          onChange={(e) => setKind(e.target.value as Kind | "")}
        >
          <option value="">{t("timeline.kind.ALL")}</option>
          {TIMELINE_KINDS.map((k) => (
            <option key={k} value={k}>
              {t(`timeline.kind.${k}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        {q.isLoading ? (
          <p className="py-6 text-sm text-secondary">{t("common.loading")}</p>
        ) : q.isError ? (
          <p role="alert" className="py-6 text-sm text-red-700">
            {t("timeline.error")}
          </p>
        ) : !events.length ? (
          <p className="py-6 text-sm text-secondary">{t("timeline.empty")}</p>
        ) : (
          <ol className="relative py-3">
            {events.map((e) => {
              const Icon = ICONS[e.kind] ?? RefreshCw;
              const time = timelineTime(e.at);
              const target =
                e.pit_kind === "ISSUE"
                  ? `/admin/issues/${e.pit_id}`
                  : `/admin/projects/${e.prj_id ?? projectId}?tab=documents&type=${docKind(e).toLowerCase()}`;
              const text = detail(e);
              return (
                <li key={e.eid} className="group relative flex gap-3 pb-4 last:pb-1">
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 left-[13px] top-7 w-px bg-[var(--border-subtle)] group-last:hidden"
                  />
                  <span className="relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-50 text-accent-700">
                    <Icon size={14} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="flex flex-wrap items-baseline gap-x-1.5">
                      <span className="font-medium text-primary">
                        {who(e.actor_name)}
                      </span>
                      <span className="text-secondary">
                        {t(`timeline.action.${e.kind}`)}
                      </span>
                      <time
                        dateTime={e.at}
                        title={new Date(e.at).toLocaleString()}
                        className="ml-auto shrink-0 text-xs text-secondary"
                      >
                        {"text" in time
                          ? time.text
                          : t(`timeline.${time.key}`, { count: time.count })}
                      </time>
                    </p>
                    <Link
                      to={target}
                      className="mt-0.5 block truncate text-primary hover:text-accent-700 hover:underline"
                    >
                      {e.pit_ref_no && e.pit_kind === "ISSUE" && (
                        <span className="mr-1 text-xs text-secondary">
                          {refLabel(e.pit_ref_no)}
                        </span>
                      )}
                      {e.pit_title}
                    </Link>
                    {all && e.prj_title && (
                      <p className="mt-0.5 truncate text-xs text-accent-700">
                        {e.prj_title}
                      </p>
                    )}
                    {text && (
                      <p className="mt-0.5 break-words text-xs text-secondary">
                        {text}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        {q.hasNextPage && (
          <div className="pb-4">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              disabled={q.isFetchingNextPage}
              onClick={() => void q.fetchNextPage()}
            >
              {t("timeline.more")}
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}
