import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CircleDot, Plus } from "lucide-react";
import { clsx } from "clsx";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { errorText, useScope } from "../project-page";
import type { Person, Project } from "../types";
import { IssueFormDialog } from "./issue-form-dialog";
import { IssueKanban } from "./issue-kanban";
import {
  day,
  ISSUE_SORTS,
  ISSUE_STATUSES,
  ISSUE_TYPES,
  issueBase,
  PRIORITIES,
  PRIORITY_BADGE,
  refLabel,
  STATUS_BADGE,
  type Issue,
  type IssueStatus,
} from "./issue-model";

const select = "min-h-9 rounded border bg-surface px-2 py-1.5 text-sm sm:min-h-0";

/** REQ-261015C — /admin/issues : 접근 가능한 전체 프로젝트의 이슈 (AMA 이슈 화면 구성). */
export function IssuesPage() {
  const { t } = useTranslation("common");
  const scope = useScope();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const get = (k: string) => params.get(k) ?? "";
  const patch = (values: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(values))
      if (v) next.set(k, v);
      else next.delete(k);
    if (!("page" in values)) next.delete("page");
    setParams(next, { replace: true });
  };
  const view = get("view") === "kanban" ? "kanban" : "list";
  const csv = (k: string) => get(k).split(",").filter(Boolean);
  const toggle = (k: string, v: string) => {
    const cur = csv(k);
    patch({ [k]: (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]).join(",") });
  };
  const [search, setSearch] = useState(get("q"));
  const [creating, setCreating] = useState(false);
  const limit = Number(get("limit")) || 20;
  const page = Number(get("page")) || 1;
  const query = {
    scope: get("scope") || "all",
    q: get("q") || undefined,
    types: get("types") || undefined,
    statuses: get("statuses") || undefined,
    priorities: get("priorities") || undefined,
    projectId: get("project") || undefined,
    assigneeId: get("assignee") || undefined,
    sort: get("sort") || "created_desc",
    // 칸반은 한 화면에 모아 본다.
    page: view === "kanban" ? 1 : page,
    limit: view === "kanban" ? 100 : limit,
  };
  const issues = useQuery({
    queryKey: ["prj", "issues", query, ...scope],
    queryFn: async () =>
      (
        await apiClient.get<{ items: Issue[]; total: number }>(
          `${issueBase}/issues`,
          { params: query },
        )
      ).data,
  });
  const projects = useQuery({
    queryKey: ["prj", ...scope],
    queryFn: async () =>
      (await apiClient.get<Project[]>(`${issueBase}/projects`)).data,
  });
  const people = useQuery({
    queryKey: ["prj-people", ...scope],
    queryFn: async () =>
      (await apiClient.get<Person[]>(`${issueBase}/people`)).data,
  });
  const move = useMutation({
    mutationFn: async (a: { id: string; status: IssueStatus }) =>
      apiClient.patch(`${issueBase}/issues/${a.id}/status`, { status: a.status }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["prj"] }),
  });
  const total = issues.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="min-w-0">
      <PageHeader
        icon={CircleDot}
        title={t("nav.issues")}
        description={t("pageHeader.issues.desc")}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus size={16} className="mr-1" />
            {t("issues.add")}
          </Button>
        }
      />
      <div className="grid min-w-0 gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded border p-0.5" role="tablist">
            {(["list", "kanban"] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => patch({ view: v === "list" ? "" : v })}
                className={clsx(
                  "min-h-9 rounded px-3 py-1 text-sm sm:min-h-0",
                  view === v ? "bg-accent-50 text-accent-700" : "text-secondary",
                )}
              >
                {t(`issues.view.${v}`)}
              </button>
            ))}
          </div>
          <div className="inline-flex rounded border p-0.5">
            {(["all", "assigned", "created"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={query.scope === v}
                onClick={() => patch({ scope: v === "all" ? "" : v })}
                className={clsx(
                  "min-h-9 rounded px-3 py-1 text-sm sm:min-h-0",
                  query.scope === v ? "bg-accent-50 text-accent-700" : "text-secondary",
                )}
              >
                {t(`issues.scope.${v}`)}
              </button>
            ))}
          </div>
          <form
            className="flex min-w-0 gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              patch({ q: search.trim() });
            }}
          >
            <Input
              className="w-48 max-w-full"
              value={search}
              placeholder={t("issues.searchPlaceholder")}
              aria-label={t("issues.searchPlaceholder")}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button type="submit" variant="outline">
              {t("issues.search")}
            </Button>
          </form>
        </div>
        <div className="grid gap-2 text-sm">
          <Chips
            label={t("issues.fields.type")}
            values={ISSUE_TYPES}
            active={csv("types")}
            text={(v) => t(`issues.type.${v}`)}
            onToggle={(v) => toggle("types", v)}
          />
          <Chips
            label={t("issues.fields.status")}
            values={ISSUE_STATUSES}
            active={csv("statuses")}
            text={(v) => t(`issues.status.${v}`)}
            onToggle={(v) => toggle("statuses", v)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <select
              className={select}
              aria-label={t("issues.fields.priority")}
              value={get("priorities")}
              onChange={(e) => patch({ priorities: e.target.value })}
            >
              <option value="">{t("issues.filters.allPriorities")}</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={String(p)}>
                  {t(`issues.priority.${p}`)}
                </option>
              ))}
            </select>
            <select
              className={select}
              aria-label={t("issues.fields.project")}
              value={get("project")}
              onChange={(e) => patch({ project: e.target.value })}
            >
              <option value="">{t("issues.filters.allProjects")}</option>
              {projects.data?.map((p) => (
                <option key={p.prj_id} value={p.prj_id}>
                  {p.prj_title}
                </option>
              ))}
            </select>
            <select
              className={select}
              aria-label={t("issues.fields.assignee")}
              value={get("assignee")}
              onChange={(e) => patch({ assignee: e.target.value })}
            >
              <option value="">{t("issues.filters.allAssignees")}</option>
              {people.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              className={clsx(select, "sm:ml-auto")}
              aria-label={t("issues.sortLabel")}
              value={query.sort}
              onChange={(e) => patch({ sort: e.target.value === "created_desc" ? "" : e.target.value })}
            >
              {ISSUE_SORTS.map((s) => (
                <option key={s} value={s}>
                  {t(`issues.sort.${s}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
        {issues.error && <p role="alert">{errorText(issues.error)}</p>}
        {move.error && <p role="alert">{errorText(move.error)}</p>}
        {issues.isLoading ? (
          <p>{t("issues.loading")}</p>
        ) : view === "kanban" ? (
          <IssueKanban
            items={issues.data?.items ?? []}
            onMove={(id, status) => move.mutate({ id, status })}
          />
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border bg-surface">
              <table className="w-full min-w-[56rem] text-left text-sm">
                <thead className="border-b text-xs text-secondary">
                  <tr>
                    {["type", "title", "project", "status", "priority", "assignee", "dueDate", "createdAt"].map((h) => (
                      <th key={h} className="whitespace-nowrap px-3 py-2">
                        {t(`issues.fields.${h}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {issues.data?.items.map((i) => (
                    <tr
                      key={i.pit_id}
                      className="cursor-pointer border-b last:border-0 hover:bg-[var(--gray-50)]"
                      onClick={() => navigate(`/admin/issues/${i.pit_id}`)}
                    >
                      <td className="whitespace-nowrap px-3 py-2">{t(`issues.type.${i.pit_issue_type}`)}</td>
                      <td className="max-w-xs px-3 py-2">
                        <Link
                          to={`/admin/issues/${i.pit_id}`}
                          className="line-clamp-2 font-medium text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {i.pit_ref_no && <span className="mr-1.5 font-mono text-xs font-normal text-gray-400">{refLabel(i.pit_ref_no)}</span>}
                          {i.pit_title}
                        </Link>
                      </td>
                      <td className="max-w-[10rem] truncate px-3 py-2 text-secondary">{i.prj_title}</td>
                      <td className="px-3 py-2"><StatusBadge status={i.pit_status} /></td>
                      <td className={clsx("whitespace-nowrap px-3 py-2", PRIORITY_BADGE[i.pit_priority])}>
                        {t(`issues.priority.${i.pit_priority}`)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">{i.assignee_name ?? t("issues.unassigned")}</td>
                      <td className="whitespace-nowrap px-3 py-2">{day(i.due_date) || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-secondary">{day(i.created_at)}</td>
                    </tr>
                  ))}
                  {issues.data?.items.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center text-secondary">
                        {t("issues.empty")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
              <span className="text-secondary">{t("issues.total", { count: total })}</span>
              <select
                className={select}
                aria-label={t("issues.pageSize")}
                value={limit}
                onChange={(e) => patch({ limit: e.target.value === "20" ? "" : e.target.value })}
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {t("issues.perPage", { count: n })}
                  </option>
                ))}
              </select>
              <Button variant="outline" disabled={page <= 1} onClick={() => patch({ page: String(page - 1) })}>
                ‹
              </Button>
              <span>
                {page} / {pages}
              </span>
              <Button variant="outline" disabled={page >= pages} onClick={() => patch({ page: String(page + 1) })}>
                ›
              </Button>
            </div>
          </>
        )}
        {creating && (
          <IssueFormDialog
            close={() => setCreating(false)}
            projectId={get("project") || undefined}
            onSaved={(id) => navigate(`/admin/issues/${id}`)}
          />
        )}
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: IssueStatus }) {
  const { t } = useTranslation("common");
  return (
    <span className={clsx("whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium", STATUS_BADGE[status])}>
      {t(`issues.status.${status}`)}
    </span>
  );
}

function Chips<T extends string>({
  label,
  values,
  active,
  text,
  onToggle,
}: {
  label: string;
  values: readonly T[];
  active: string[];
  text: (v: T) => string;
  onToggle: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs text-secondary">{label}</span>
      {values.map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={active.includes(v)}
          onClick={() => onToggle(v)}
          className={clsx(
            "min-h-9 rounded-full border px-2.5 py-0.5 text-xs sm:min-h-0",
            active.includes(v)
              ? "border-accent-500 bg-accent-50 text-accent-700"
              : "text-secondary hover:bg-[var(--gray-100)]",
          )}
        >
          {text(v)}
        </button>
      ))}
    </div>
  );
}
