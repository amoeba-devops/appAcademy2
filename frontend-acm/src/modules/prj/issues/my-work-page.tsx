import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ListTodo, Plus } from "lucide-react";
import { clsx } from "clsx";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { todayYmd, useTenantTz } from "@/lib/tz";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errorText, useScope } from "../project-page";
import { IssueFormDialog } from "./issue-form-dialog";
import { StatusBadge } from "./issues-page";
import {
  day,
  issueBase,
  PRIORITY_BADGE,
  type Issue,
  type IssueStatus,
} from "./issue-model";

type Kpi = "assigned" | "overdue" | "today" | "week" | "doneToday";
type Bucket = "OVERDUE" | "TODAY" | "UPCOMING" | "NO_DUE" | "DONE_TODAY";

function addDays(ymd: string, n: number) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * REQ-261015C WP4 — /admin/my-work. AMA 내 업무를 ACM 이슈로 축소 적용.
 * 날짜 구분은 테넌트 타임존 기준.
 */
export function MyWorkPage() {
  const { t } = useTranslation("common");
  const scope = useScope();
  const qc = useQueryClient();
  const tz = useTenantTz();
  const me = useAuthStore((s) => s.user?.id);
  const work = useQuery({
    queryKey: ["prj", "my-work", ...scope],
    queryFn: async () =>
      (await apiClient.get<Issue[]>(`${issueBase}/my-work`)).data,
  });
  const [relations, setRelations] = useState({ assigned: true, created: true });
  const [kpi, setKpi] = useState<Kpi | null>(null);
  const [project, setProject] = useState("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const move = useMutation({
    mutationFn: async (a: { id: string; status: IssueStatus }) =>
      apiClient.patch(`${issueBase}/issues/${a.id}/status`, { status: a.status }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["prj"] }),
  });

  const today = todayYmd(tz);
  const weekEnd = addDays(today, 6);
  const bucketOf = (i: Issue): Bucket | null => {
    if (i.pit_status === "DONE")
      return i.pit_done_at && todayYmd(tz, new Date(i.pit_done_at)) === today
        ? "DONE_TODAY"
        : null;
    const due = day(i.due_date);
    if (!due) return "NO_DUE";
    if (due < today) return "OVERDUE";
    if (due === today) return "TODAY";
    return "UPCOMING";
  };
  const rows = (work.data ?? [])
    .map((i) => ({ ...i, bucket: bucketOf(i) }))
    .filter((i): i is Issue & { bucket: Bucket } => i.bucket !== null);
  const related = rows.filter(
    (i) =>
      (relations.assigned && i.assignee_id === me) ||
      (relations.created && i.created_by === me),
  );
  const open = related.filter((i) => i.bucket !== "DONE_TODAY");
  const kpis: Record<Kpi, (i: (typeof rows)[number]) => boolean> = {
    assigned: (i) => i.bucket !== "DONE_TODAY" && i.assignee_id === me,
    overdue: (i) => i.bucket === "OVERDUE",
    today: (i) => i.bucket === "TODAY",
    week: (i) =>
      i.bucket !== "DONE_TODAY" && !!i.due_date && day(i.due_date) >= today && day(i.due_date) <= weekEnd,
    doneToday: (i) => i.bucket === "DONE_TODAY",
  };
  const needle = q.trim().toLowerCase();
  const visible = related.filter(
    (i) =>
      (!kpi || kpis[kpi](i)) &&
      (!project || i.prj_id === project) &&
      (!needle ||
        i.pit_title.toLowerCase().includes(needle) ||
        i.prj_title.toLowerCase().includes(needle)),
  );
  const projects = [...new Map(rows.map((i) => [i.prj_id, i.prj_title])).entries()];
  const now = visible.filter((i) => i.bucket === "OVERDUE" || i.bucket === "TODAY");
  const later = visible.filter((i) => i.bucket === "UPCOMING" || i.bucket === "NO_DUE");
  const done = visible.filter((i) => i.bucket === "DONE_TODAY");
  const current = rows.find((i) => i.pit_id === selected);

  const row = (i: (typeof rows)[number]) => (
    <li
      key={i.pit_id}
      className={clsx(
        "grid cursor-pointer gap-1 border-b px-3 py-2 last:border-0 hover:bg-[var(--gray-50)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center",
        selected === i.pit_id && "bg-accent-50/50",
      )}
      onClick={() => setSelected(i.pit_id)}
    >
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          {i.bucket === "OVERDUE" && (
            <span className="shrink-0 rounded bg-rose-50 px-1.5 text-xs text-rose-700">{t("myWork.bucket.OVERDUE")}</span>
          )}
          {i.bucket === "TODAY" && (
            <span className="shrink-0 rounded bg-amber-50 px-1.5 text-xs text-amber-700">{t("myWork.bucket.TODAY")}</span>
          )}
          <StatusBadge status={i.pit_status} />
          <span className="truncate font-medium">{i.pit_title}</span>
        </div>
        <p className="truncate text-xs text-secondary">
          {i.prj_title} · {day(i.due_date) ? t("myWork.due", { date: day(i.due_date) }) : t("myWork.noDue")} ·{" "}
          <span className={PRIORITY_BADGE[i.pit_priority]}>{t(`issues.priority.${i.pit_priority}`)}</span>
          {i.assignee_id !== me && ` · ${i.assignee_name ?? t("issues.unassigned")}`}
        </p>
      </div>
      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
        {i.pit_status === "OPEN" && (
          <Button variant="outline" disabled={move.isPending} onClick={() => move.mutate({ id: i.pit_id, status: "IN_PROGRESS" })}>
            {t("myWork.start")}
          </Button>
        )}
        {(i.pit_status === "OPEN" || i.pit_status === "IN_PROGRESS") && (
          <Button variant="outline" disabled={move.isPending} onClick={() => move.mutate({ id: i.pit_id, status: "DONE" })}>
            {t("myWork.complete")}
          </Button>
        )}
      </div>
    </li>
  );

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="grid min-w-0 content-start gap-4">
        <header className="flex flex-wrap items-center gap-2">
          <ListTodo size={20} className="text-accent-700" />
          <h1 className="text-xl font-semibold text-primary">{t("myWork.title")}</h1>
          <span className="text-sm text-secondary">
            {t("myWork.subtitle", { total: open.length, overdue: open.filter((i) => i.bucket === "OVERDUE").length })}
          </span>
          <Button className="ml-auto" onClick={() => setCreating(true)}>
            <Plus size={16} className="mr-1" />
            {t("issues.add")}
          </Button>
        </header>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {(Object.keys(kpis) as Kpi[]).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kpi === k}
              onClick={() => setKpi(kpi === k ? null : k)}
              className={clsx(
                "rounded-lg border bg-surface p-3 text-left",
                kpi === k && "border-accent-500 bg-accent-50",
              )}
            >
              <span className="block text-xs text-secondary">{t(`myWork.kpi.${k}`)}</span>
              <span className={clsx("text-xl font-semibold", k === "overdue" && "text-rose-700")}>
                {rows.filter(kpis[k]).length}
              </span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {(["assigned", "created"] as const).map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={relations[r]}
              onClick={() => setRelations((x) => ({ ...x, [r]: !x[r] }))}
              className={clsx(
                "rounded-full border px-3 py-1 text-xs",
                relations[r] ? "border-accent-500 bg-accent-50 text-accent-700" : "text-secondary",
              )}
            >
              {t(`myWork.relation.${r}`)}
            </button>
          ))}
          <select
            className="rounded border bg-surface px-2 py-1.5"
            aria-label={t("issues.fields.project")}
            value={project}
            onChange={(e) => setProject(e.target.value)}
          >
            <option value="">{t("issues.filters.allProjects")}</option>
            {projects.map(([id, title]) => (
              <option key={id} value={id}>
                {title}
              </option>
            ))}
          </select>
          <Input
            className="w-48 max-w-full"
            value={q}
            placeholder={t("issues.searchPlaceholder")}
            aria-label={t("issues.searchPlaceholder")}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {work.error && <p role="alert">{errorText(work.error)}</p>}
        {move.error && <p role="alert">{errorText(move.error)}</p>}
        {work.isLoading ? (
          <p>{t("issues.loading")}</p>
        ) : (
          <>
            <Section title={t("myWork.sections.now", { count: now.length })}>
              {now.length ? <ul>{now.map(row)}</ul> : <Empty text={t("myWork.emptyNow")} />}
            </Section>
            <Section title={t("myWork.sections.later", { count: later.length })}>
              {later.length ? <ul>{later.map(row)}</ul> : <Empty text={t("myWork.empty")} />}
            </Section>
            <section className="rounded-lg border bg-surface">
              <button
                type="button"
                aria-expanded={showDone}
                onClick={() => setShowDone((v) => !v)}
                className="w-full px-3 py-2 text-left text-sm font-semibold"
              >
                {showDone ? "▾" : "▸"} {t("myWork.sections.done", { count: done.length })}
              </button>
              {showDone && (done.length ? <ul>{done.map(row)}</ul> : <Empty text={t("myWork.empty")} />)}
            </section>
          </>
        )}
      </div>
      <aside className="h-fit rounded-lg border bg-surface p-4 text-sm xl:sticky xl:top-20">
        {current ? (
          <div className="grid gap-2">
            <h2 className="break-words font-semibold">{current.pit_title}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={current.pit_status} />
              <span className="text-secondary">{t(`issues.type.${current.pit_issue_type}`)}</span>
              <span className={PRIORITY_BADGE[current.pit_priority]}>{t(`issues.priority.${current.pit_priority}`)}</span>
            </div>
            <p className="text-secondary">
              {current.prj_title} · {current.assignee_name ?? t("issues.unassigned")}
            </p>
            <p className="text-secondary">
              {day(current.start_date) || "—"} ~ {day(current.due_date) || "—"}
            </p>
            {current.pit_body && (
              <p className="line-clamp-[12] whitespace-pre-wrap break-words">{current.pit_body}</p>
            )}
            <Link className="text-accent-700 hover:underline" to={`/admin/issues/${current.pit_id}`}>
              {t("myWork.openFull")} →
            </Link>
          </div>
        ) : (
          <p className="text-secondary">{t("myWork.selectHint")}</p>
        )}
      </aside>
      {creating && <IssueFormDialog close={() => setCreating(false)} />}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border bg-surface">
      <h2 className="border-b px-3 py-2 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}
function Empty({ text }: { text: string }) {
  return <p className="px-3 py-6 text-center text-sm text-secondary">{text}</p>;
}
