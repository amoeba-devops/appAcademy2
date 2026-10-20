import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ExternalLink, Loader2, Search } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { useScope } from "../../project-page";
import type { Project } from "../../types";
import { issueBase, refLabel, type IssueStatusLog } from "../issue-model";
import { DueTag } from "./my-work-row";
import { age, byUrgency, REASON_CLASS, type WorkItem } from "./work-display";

/**
 * 우측 패널 ‘업무 상세’ (AMA WorkDetailPanel) — [상세] [이력].
 * 업무가 바뀌면 상위에서 key 로 다시 그려 [상세]로 돌아간다.
 */
export function WorkDetailPanel({
  item,
  tz,
  today,
  busy,
  onComplete,
  onOpenFull,
  onOpenIssue,
}: {
  item: WorkItem | null;
  tz: string;
  today: string;
  busy: boolean;
  onComplete: (i: WorkItem) => void;
  onOpenFull: (i: WorkItem) => void;
  onOpenIssue: (id: string) => void;
}) {
  const { t } = useTranslation("common");
  const [tab, setTab] = useState<"info" | "history">("info");
  if (!item) return <p className="px-1 py-8 text-center text-xs text-gray-400">{t("myWork.detail.empty")}</p>;
  const assigned = item.mine ? age(item.assigned_at, tz) : null;
  const created = age(item.created_at, tz);
  const ymd = (d: string) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  const ref = refLabel(item.pit_ref_no);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-0.5 rounded-lg bg-gray-100 p-0.5" role="tablist">
        {(["info", "history"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`flex-1 rounded-md px-2 py-1 text-xs ${tab === k ? "bg-white font-semibold text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            {t(`myWork.detailTab.${k}`)}
          </button>
        ))}
      </div>
      {tab === "history" ? (
        <StatusHistory id={item.pit_id} />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded bg-rose-50 px-1.5 py-0.5 text-xs font-semibold text-rose-600">
              {t("myWork.type.ISSUE")}
            </span>
            {item.mine && (
              <span className="rounded-full bg-accent-600 px-2 text-xs font-semibold text-white">{t("myWork.badge")}</span>
            )}
            <span className="rounded-full border border-gray-200 bg-gray-50 px-2 text-xs text-gray-600">
              {t(`issues.status.${item.pit_status}`)}
            </span>
            {item.reasons.map((r) => (
              <span key={r} className={`rounded-full border px-2 text-xs font-semibold ${REASON_CLASS[r]}`}>
                {t(`myWork.reason.${r}`)}
              </span>
            ))}
            {ref && <span className="font-mono text-xs text-gray-400">{ref}</span>}
          </div>
          <p className="break-words text-[15px] font-semibold leading-snug text-gray-900">{item.pit_title}</p>
          <dl className="grid grid-cols-[72px_1fr] gap-x-2 gap-y-1.5 text-xs">
            <dt className="text-gray-400">{t("myWork.detail.project")}</dt>
            <dd className="text-gray-700">{item.prj_title || t("myWork.noProject")}</dd>
            {item.pit_parent_id && (
              <>
                <dt className="text-gray-400">{t("myWork.detail.parentIssue")}</dt>
                <dd>
                  <button
                    type="button"
                    onClick={() => onOpenIssue(item.pit_parent_id!)}
                    className="text-left text-indigo-600 hover:underline"
                  >
                    {item.parent_title || refLabel(item.parent_ref_no)}
                  </button>
                </dd>
              </>
            )}
            {item.creator_name && (
              <>
                <dt className="text-gray-400">{t("myWork.detail.author")}</dt>
                <dd className="text-gray-700">{item.creator_name.trim()}</dd>
              </>
            )}
            <dt className="text-gray-400">{t("myWork.detail.roles")}</dt>
            <dd className="text-gray-700">{item.roles.map((r) => t(`myWork.role.${r}`)).join(", ") || "—"}</dd>
            <dt className="text-gray-400">{t("myWork.detail.due")}</dt>
            <dd>
              <DueTag due={item.due_date} today={today} className="text-left" />
            </dd>
            <dt className="text-gray-400">{t("myWork.detail.progress")}</dt>
            <dd className="flex items-center gap-2 text-gray-700">
              <span className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-100">
                <span className="block h-full rounded-full bg-green-500" style={{ width: `${item.pit_done_ratio}%` }} />
              </span>
              <span className="font-mono">{item.pit_done_ratio}%</span>
            </dd>
            {assigned && (
              <>
                <dt className="text-gray-400">{t("myWork.detail.assignedAt")}</dt>
                <dd className="text-gray-700">{t("myWork.detail.dateAge", { date: ymd(assigned.date), days: assigned.days })}</dd>
              </>
            )}
            {created && (
              <>
                <dt className="text-gray-400">{t("myWork.detail.createdAt")}</dt>
                <dd className="text-gray-700">{t("myWork.detail.dateAge", { date: ymd(created.date), days: created.days })}</dd>
              </>
            )}
          </dl>
          <div className="flex flex-wrap gap-1.5">
            {!item.doneToday && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onComplete(item)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:border-indigo-400 hover:text-indigo-600 disabled:opacity-50"
              >
                {t("myWork.detail.complete")}
              </button>
            )}
            <button
              type="button"
              onClick={() => onOpenFull(item)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:border-indigo-400 hover:text-indigo-600"
            >
              {t("myWork.detail.open")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusHistory({ id }: { id: string }) {
  const { t } = useTranslation("common");
  const scope = useScope();
  const logs = useQuery({
    queryKey: ["prj", "issue", id, "logs", ...scope],
    queryFn: async () => (await apiClient.get<IssueStatusLog[]>(`${issueBase}/issues/${id}/status-logs`)).data,
  });
  if (logs.isLoading)
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  return (
    <ol className="flex flex-col gap-2 text-xs">
      {logs.data?.map((l) => (
        <li key={l.psl_id} className="rounded-lg border border-gray-200 px-2.5 py-2">
          <p className="text-gray-400">
            {new Date(l.created_at).toLocaleString()} · {l.changed_by_name ?? "—"}
          </p>
          {l.psl_kind === "ASSIGNEE" ? (
            <p className="text-gray-700">
              {t("issues.historyAssignee", {
                from: l.from_user_name ?? t("issues.unassigned"),
                to: l.to_user_name ?? t("issues.unassigned"),
              })}
            </p>
          ) : (
            <p className="text-gray-700">
              {l.from_status ? t(`issues.status.${l.from_status}`) : t("issues.created")} →{" "}
              <strong>{t(`issues.status.${l.to_status}`)}</strong>
            </p>
          )}
          {l.psl_note && <p className="whitespace-pre-wrap text-gray-500">{l.psl_note}</p>}
        </li>
      ))}
    </ol>
  );
}

type KanbanColumn = "WAITING" | "DOING" | "DONE";
const COLUMN_TONE: Record<KanbanColumn, string> = {
  WAITING: "bg-blue-500",
  DOING: "bg-purple-500",
  DONE: "bg-green-500",
};
const columnOf = (i: WorkItem): KanbanColumn =>
  i.doneToday ? "DONE" : i.pit_status === "IN_PROGRESS" ? "DOING" : "WAITING";

/** 칸반 (AMA MyWorkKanban) — 내 담당 이슈 대기·진행중·완료 3열. 카드 클릭 → 우측 상세. */
export function MyWorkKanban({
  items,
  tz,
  today,
  selectedId,
  onSelect,
}: {
  items: WorkItem[];
  tz: string;
  today: string;
  selectedId: string | null;
  onSelect: (i: WorkItem) => void;
}) {
  const { t } = useTranslation("common");
  const me = useAuthStore((s) => s.user?.id);
  const columns = (["WAITING", "DOING", "DONE"] as KanbanColumn[]).map((col) => ({
    col,
    cards: items.filter((i) => i.mine && columnOf(i) === col).sort(byUrgency(today)),
  }));
  return (
    <div className="flex snap-x gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:overflow-visible">
      {columns.map(({ col, cards }) => (
        <section
          key={col}
          className="flex min-w-[260px] snap-start flex-col rounded-xl border border-gray-200 bg-gray-50 md:min-w-0"
        >
          <header className="border-b border-gray-200 px-3 py-2">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-gray-800">
              <span className={`h-2 w-2 rounded-full ${COLUMN_TONE[col]}`} />
              {t(`myWork.kanban.col.${col}`)}
              <span className="font-mono text-xs font-normal text-gray-400">{cards.length}</span>
            </div>
            <p className="mt-0.5 text-xs text-gray-400">{t(`myWork.kanban.colHint.${col}`)}</p>
          </header>
          <div className="flex flex-col gap-2 p-2">
            {cards.map((i) => {
              const a = age(i.assigned_at, tz);
              const own = i.created_by === me;
              const ref = refLabel(i.pit_ref_no);
              return (
                <button
                  key={i.pit_id}
                  type="button"
                  onClick={() => onSelect(i)}
                  className={`flex flex-col gap-1 rounded-lg border bg-white px-2.5 py-2 text-left shadow-sm hover:border-indigo-300 ${selectedId === i.pit_id ? "border-indigo-400 ring-1 ring-indigo-300" : "border-gray-200"}`}
                >
                  <div className="flex items-start gap-1.5 text-[13px] font-medium text-gray-900">
                    {ref && <span className="shrink-0 font-mono text-xs font-normal text-gray-400">{ref}</span>}
                    <span className="line-clamp-2">{i.pit_title}</span>
                  </div>
                  <div className="truncate text-xs text-gray-500">
                    {i.prj_title} · {t(`issues.status.${i.pit_status}`)}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                    <DueTag due={i.due_date} today={today} className="!min-w-0 text-left" />
                    {a && <span className="font-mono text-indigo-500">{t("myWork.kanban.assignedDays", { n: a.days })}</span>}
                    <span
                      className={`rounded-full px-1.5 text-xs font-semibold ${own ? "bg-gray-100 text-gray-600" : "bg-indigo-50 text-indigo-700"}`}
                    >
                      {t(own ? "myWork.kanban.own" : "myWork.kanban.assignedByOthers")}
                    </span>
                  </div>
                </button>
              );
            })}
            {!cards.length && <p className="px-2 py-6 text-center text-xs text-gray-400">{t("myWork.kanban.empty")}</p>}
          </div>
        </section>
      ))}
    </div>
  );
}

/**
 * 내 프로젝트 (AMA MyProjectsView) — 소속 프로젝트 표 + 선택 프로젝트의 내 업무.
 */
export function MyProjectsView({
  items,
  relationLabel,
  showFocus,
  selected,
  onSelect,
  renderRows,
}: {
  /** 현재 관계 칩 기준 미완료 업무 */
  items: WorkItem[];
  relationLabel: string;
  showFocus: boolean;
  selected: string | null;
  onSelect: (id: string) => void;
  renderRows: (items: WorkItem[]) => ReactNode;
}) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const scope = useScope();
  const me = useAuthStore((s) => s.user?.id);
  const projects = useQuery({
    queryKey: ["prj", ...scope],
    queryFn: async () => (await apiClient.get<Project[]>(`${issueBase}/projects`)).data,
  });
  const [activeOnly, setActiveOnly] = useState(true);
  const [q, setQ] = useState("");
  const stats = useMemo(() => {
    const m = new Map<string, { count: number; focus: number }>();
    for (const i of items) {
      const s = m.get(i.prj_id) ?? { count: 0, focus: 0 };
      s.count += 1;
      if (i.reasons.length) s.focus += 1;
      m.set(i.prj_id, s);
    }
    return m;
  }, [items]);
  const statOf = (k: string) => stats.get(k) ?? { count: 0, focus: 0 };
  const rows = (projects.data ?? [])
    .filter((p) => !activeOnly || p.prj_status === "ACTIVE")
    .filter((p) => !q.trim() || p.prj_title.toLowerCase().includes(q.trim().toLowerCase()));
  const fallback = [...rows].sort((a, b) => statOf(b.prj_id).count - statOf(a.prj_id).count)[0]?.prj_id ?? null;
  const current = selected && projects.data?.some((p) => p.prj_id === selected) ? selected : fallback;
  const currentProject = projects.data?.find((p) => p.prj_id === current) ?? null;
  const currentItems = items.filter((i) => i.prj_id === current);
  const roleOf = (p: Project) => (p.owner_id === me ? "OWNER" : p.can_manage ? "MANAGER" : "MEMBER");
  const rowCls = (k: string) =>
    `grid cursor-pointer grid-cols-[1fr_auto] items-center gap-2 border-b border-gray-100 px-3 py-2 text-xs last:border-b-0 sm:grid-cols-[1fr_88px_72px_64px_64px] ${
      current === k ? "bg-indigo-50/70" : "bg-white hover:bg-gray-50"
    }`;
  const num = (n: number, tone = "text-gray-900") => (
    <span className={`text-right font-mono ${n ? tone : "text-gray-300"}`}>{n}</span>
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[15px] font-bold text-gray-900">
          {t("myWork.projects.title")}{" "}
          <span className="font-mono text-xs font-normal text-gray-400">{projects.data?.length ?? 0}</span>
        </h2>
        <select
          value={activeOnly ? "active" : "all"}
          onChange={(e) => setActiveOnly(e.target.value === "active")}
          className="ml-auto rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700"
        >
          <option value="active">{t("myWork.projects.statusActive")}</option>
          <option value="all">{t("myWork.projects.statusAll")}</option>
        </select>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("myWork.projects.search")}
            aria-label={t("myWork.projects.search")}
            className="w-40 rounded-lg border border-gray-200 bg-white py-1 pl-7 pr-2 text-xs"
          />
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-gray-200">
        <div className="hidden grid-cols-[1fr_88px_72px_64px_64px] gap-2 border-b border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-500 sm:grid">
          <span>{t("myWork.projects.col.project")}</span>
          <span>{t("myWork.projects.col.status")}</span>
          <span>{t("myWork.projects.col.role")}</span>
          <span className="text-right">{showFocus ? t("myWork.projects.col.focus") : ""}</span>
          <span className="text-right">{relationLabel}</span>
        </div>
        {projects.isLoading ? (
          <div className="flex justify-center bg-white py-6">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : rows.length === 0 ? (
          <p className="bg-white px-3 py-4 text-center text-xs text-gray-400">{t("myWork.projects.empty")}</p>
        ) : (
          rows.map((p) => {
            const s = statOf(p.prj_id);
            return (
              <div
                key={p.prj_id}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(p.prj_id)}
                onKeyDown={(e) => e.key === "Enter" && onSelect(p.prj_id)}
                className={rowCls(p.prj_id)}
              >
                <span className="truncate font-medium text-gray-900">{p.prj_title}</span>
                <span className="hidden truncate text-gray-600 sm:block">{t(`myWork.projects.status.${p.prj_status}`)}</span>
                <span className="hidden text-gray-600 sm:block">{t(`myWork.projects.role.${roleOf(p)}`)}</span>
                <span className="hidden sm:block">{showFocus ? num(s.focus, "text-orange-600") : null}</span>
                {num(s.count)}
              </div>
            );
          })
        )}
      </div>
      {current && (
        <section className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900">
              {t("myWork.projects.selected", { name: currentProject?.prj_title ?? "", count: currentItems.length })}
            </h3>
            <button
              type="button"
              onClick={() => navigate(`/admin/projects/${current}`)}
              className="ml-auto inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
            >
              {t("myWork.projects.openProject")} <ExternalLink className="h-3 w-3" />
            </button>
          </div>
          {currentItems.length ? (
            <div className="overflow-hidden rounded-xl border border-gray-200">{renderRows(currentItems)}</div>
          ) : (
            <p className="rounded-lg border border-dashed border-gray-200 bg-white px-3 py-6 text-center text-xs text-gray-400">
              {t("myWork.projects.emptyWork")}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
