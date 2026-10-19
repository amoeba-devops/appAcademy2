import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ListTodo, Loader2, Plus, Search } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { UnderlineTabs } from "@/components/ui/tabs";
import { useAuthStore } from "@/stores/auth.store";
import { todayYmd, useTenantTz } from "@/lib/tz";
import { errorText, useScope } from "../project-page";
import { IssueFormDialog } from "./issue-form-dialog";
import { day, issueBase, refLabel, type Issue } from "./issue-model";
import { MyWorkRow } from "./my-work/my-work-row";
import { ActionResultModal, CompleteConfirmModal, MAX_BULK_COMPLETE, type CompleteResult } from "./my-work/result-modals";
import { MyProjectsView, MyWorkKanban, WorkDetailPanel } from "./my-work/my-work-views";
import {
  byUrgency,
  ORIGIN_DOT,
  ORIGIN_ORDER,
  originOf,
  RELATIONS,
  toWorkItems,
  type Origin,
  type Reason,
  type Relation,
  type WorkItem,
} from "./my-work/work-display";

type ViewMode = "today" | "project" | "kanban";
const VIEW_MODES: ViewMode[] = ["today", "project", "kanban"];
/** 요약 카드 필터 — 사유(오늘 처리 구역 안) + 오늘 배정·7일 내 마감·오늘 완료(평면 목록) */
type CardFilter = Reason | "ASSIGNED_TODAY" | "WEEK" | "DONE_TODAY";
const isReasonFilter = (f: CardFilter | null): f is Reason => f === "OVERDUE" || f === "TODAY";

function addDays(ymd: string, n: number) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function stored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key) as T | null;
    return v && allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}
function store(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* ignore */
  }
}

/**
 * REQ-261016C — /admin/my-work. AMA 내 업무(MyWorkPage)와 같은 화면 구성·아이콘·색상.
 * 가운데: KPI → 관계 칩 → 필터 → 오늘 처리 → 출처별 섹션 / 우측: 업무 상세.
 * AMA 전용(오늘의 미션·할 일·알림 확인함·내 성과)은 1차 제외.
 */
export function MyWorkPage() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const qc = useQueryClient();
  const scope = useScope();
  const tz = useTenantTz();
  const me = useAuthStore((s) => s.user?.id);
  const work = useQuery({
    queryKey: ["prj", "my-work", ...scope],
    queryFn: async () => (await apiClient.get<Issue[]>(`${issueBase}/my-work`)).data,
  });

  const [view, setView] = useState<ViewMode>(() => stored("acm-mywork-view", VIEW_MODES, "today"));
  const [relation, setRelation] = useState<Relation>(() => stored("acm-mywork-relation", RELATIONS, "ASSIGNED"));
  useEffect(() => store("acm-mywork-view", view), [view]);
  useEffect(() => store("acm-mywork-relation", relation), [relation]);
  const [projectFilter, setProjectFilter] = useState("");
  const [search, setSearch] = useState("");
  const [cardFilter, setCardFilter] = useState<CardFilter | null>(null);
  const [collapsed, setCollapsed] = useState<Set<Origin>>(() => new Set<Origin>(["DONE_TODAY"]));
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [projectKey, setProjectKey] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [completeTargets, setCompleteTargets] = useState<WorkItem[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; title: string; message: string } | null>(null);
  const closeResult = useCallback(() => setResult(null), []);

  const today = todayYmd(tz);
  const weekEnd = addDays(today, 7);
  const urgency = byUrgency(today);
  const all = useMemo(() => toWorkItems(work.data ?? [], me, tz), [work.data, me, tz]);
  const byId = useMemo(() => new Map(all.map((i) => [i.pit_id, i])), [all]);
  const selected = selectedId ? (byId.get(selectedId) ?? null) : null;

  const projectOptions = useMemo(
    () =>
      [...new Map(all.map((i) => [i.prj_id, i.prj_title])).entries()]
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [all],
  );
  const needle = search.trim().toLowerCase();
  const filtered = all.filter(
    (i) =>
      (!projectFilter || i.prj_id === projectFilter) &&
      (!needle ||
        i.pit_title.toLowerCase().includes(needle) ||
        i.prj_title.toLowerCase().includes(needle) ||
        refLabel(i.pit_ref_no).toLowerCase().includes(needle)),
  );
  const open = filtered.filter((i) => !i.doneToday);
  const mineOpen = all.filter((i) => i.mine && !i.doneToday);

  const focusAll = filtered.filter((i) => i.reasons.length).sort(urgency);
  const focusIds = new Set(focusAll.map((i) => i.pit_id));
  const reasonFilter = isReasonFilter(cardFilter) ? cardFilter : null;
  const focusShown = reasonFilter ? focusAll.filter((i) => i.reasons.includes(reasonFilter)) : focusAll;

  const assignedToday = (i: WorkItem) =>
    i.mine && !i.doneToday && !!i.assigned_at && todayYmd(tz, new Date(i.assigned_at)) === today;
  const dueThisWeek = (i: WorkItem) =>
    i.mine && !i.doneToday && !!day(i.due_date) && day(i.due_date) >= today && day(i.due_date) <= weekEnd;
  const doneToday = (i: WorkItem) => i.mine && i.doneToday;
  const CARD_LIST: Record<"ASSIGNED_TODAY" | "WEEK" | "DONE_TODAY", (i: WorkItem) => boolean> = {
    ASSIGNED_TODAY: assignedToday,
    WEEK: dueThisWeek,
    DONE_TODAY: doneToday,
  };

  const relationItems = (r: Relation) =>
    r === "ASSIGNED" ? open.filter((i) => i.mine) : open.filter((i) => !i.mine && i.roles.includes(r));
  const sectionItems = (sec: Origin) =>
    filtered.filter((i) => !focusIds.has(i.pit_id) && originOf(i, me) === sec).sort(urgency);
  const hasRest = ORIGIN_ORDER.some((sec) => sectionItems(sec).length > 0);

  const resetFilters = () => {
    setProjectFilter("");
    setSearch("");
    setCardFilter(null);
    setRelation("ASSIGNED");
  };
  const focusOn = (f: CardFilter) => {
    setView("today");
    setRelation("ASSIGNED");
    setCardFilter((prev) => (prev === f ? null : f));
  };

  // ── 동작 ──
  const refresh = () => qc.invalidateQueries({ queryKey: ["prj"] });
  const togglePick = (i: WorkItem) => {
    if (i.doneToday) return;
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(i.pit_id)) next.delete(i.pit_id);
      else next.add(i.pit_id);
      return next;
    });
  };
  const toggleSelectAll = (items: WorkItem[]) => {
    const selectable = items.filter((i) => i.mine && !i.doneToday);
    const allOn = selectable.every((i) => picked.has(i.pit_id));
    setPicked((prev) => {
      const next = new Set(prev);
      selectable.forEach((i) => (allOn ? next.delete(i.pit_id) : next.add(i.pit_id)));
      return next;
    });
  };
  const pickedItems = [...picked].map((id) => byId.get(id)).filter((i): i is WorkItem => !!i);
  const finishComplete = ({ okIds, failed }: CompleteResult) => {
    const total = completeTargets?.length ?? 0;
    setCompleteTargets(null);
    void refresh();
    setPicked((prev) => {
      const next = new Set(prev);
      okIds.forEach((id) => next.delete(id));
      return next;
    });
    if (!failed.length) {
      setResult({ ok: true, title: t("myWork.complete.doneTitle"), message: t("myWork.complete.doneMsg", { count: okIds.length }) });
      return;
    }
    const lines = failed.map((f) => t("myWork.complete.failLine", { title: f.item.pit_title, reason: f.reason }));
    if (total > 1) lines.push(t("myWork.complete.keepPicked"));
    setResult({
      ok: false,
      title: okIds.length ? t("myWork.complete.partialTitle") : t("myWork.complete.failedTitle"),
      message: [t("myWork.complete.partialMsg", { ok: okIds.length, fail: failed.length }), ...lines].join("\n"),
    });
  };
  const start = async (i: WorkItem) => {
    setBusyId(i.pit_id);
    try {
      await apiClient.patch(`${issueBase}/issues/${i.pit_id}/status`, { status: "IN_PROGRESS" });
      await refresh();
      setResult({ ok: true, title: t("myWork.started.title"), message: t("myWork.started.msg", { title: i.pit_title }) });
    } catch (err) {
      setResult({ ok: false, title: t("myWork.started.failTitle"), message: errorText(err) });
    } finally {
      setBusyId(null);
    }
  };
  const openIssue = (id: string) => navigate(`/admin/issues/${id}`);

  const renderRow = (
    i: WorkItem,
    o: { muted?: boolean; showReasons?: boolean; showAssignee?: boolean; selectable?: boolean } = {},
  ) => (
    <MyWorkRow
      key={i.pit_id}
      item={i}
      tz={tz}
      today={today}
      selectable={o.selectable ?? (i.mine && !o.muted)}
      muted={o.muted ?? !i.mine}
      showReasons={o.showReasons}
      showAssignee={o.showAssignee}
      picked={picked.has(i.pit_id)}
      selected={selectedId === i.pit_id}
      busy={busyId === i.pit_id}
      onTogglePick={togglePick}
      onComplete={(x) => setCompleteTargets([x])}
      onStart={(x) => void start(x)}
      onSelect={(x) => setSelectedId(x.pit_id)}
      onOpenIssue={openIssue}
    />
  );

  const kpis: { id: string; label: string; value: number; sub: string; tone: string; strong?: boolean; filter?: CardFilter }[] = [
    { id: "issues", label: t("myWork.kpi.assignedIssues"), value: mineOpen.length, sub: t("myWork.kpi.assignedIssuesSub"), tone: "bg-indigo-500", strong: true },
    { id: "assignedToday", label: t("myWork.kpi.assignedToday"), value: all.filter(assignedToday).length, sub: t("myWork.kpi.assignedTodaySub"), tone: "bg-violet-500", filter: "ASSIGNED_TODAY" },
    { id: "overdue", label: t("myWork.kpi.overdue"), value: all.filter((i) => i.reasons.includes("OVERDUE")).length, sub: t("myWork.kpi.overdueSub"), tone: "bg-red-500", filter: "OVERDUE" },
    { id: "today", label: t("myWork.kpi.today"), value: all.filter((i) => i.reasons.includes("TODAY")).length, sub: t("myWork.kpi.todaySub"), tone: "bg-orange-500", filter: "TODAY" },
    { id: "week", label: t("myWork.kpi.week"), value: all.filter(dueThisWeek).length, sub: t("myWork.kpi.weekSub"), tone: "bg-sky-500", filter: "WEEK" },
    { id: "done", label: t("myWork.kpi.doneToday"), value: all.filter(doneToday).length, sub: t("myWork.kpi.doneTodaySub"), tone: "bg-green-500", filter: "DONE_TODAY" },
  ];

  // 오늘 처리 구역 — 사유 순 평면 목록
  const focusSelectable = focusShown.filter((i) => i.mine && !i.doneToday);
  const focusAllOn = focusSelectable.length > 0 && focusSelectable.every((i) => picked.has(i.pit_id));
  const restOpenMine = open.filter((i) => i.mine && !focusIds.has(i.pit_id));
  const focusSection = (
    <section className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 text-[15px] font-bold text-gray-900">
          {t("myWork.focus.title")}
          <span className="rounded-full bg-accent-600 px-2 text-xs font-semibold text-white">{focusShown.length}</span>
        </h2>
        <span className="text-xs text-gray-500">{t("myWork.focus.hint")}</span>
        {reasonFilter && (
          <button
            type="button"
            onClick={() => setCardFilter(null)}
            className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11.5px] text-indigo-700 hover:bg-indigo-100"
          >
            {t("myWork.focus.filtered", { reason: t(`myWork.reason.${reasonFilter}`) })} · {t("myWork.focus.clearFilter")} ✕
          </button>
        )}
        {focusSelectable.length > 0 && (
          <button type="button" onClick={() => toggleSelectAll(focusShown)} className="ml-auto text-[11.5px] text-indigo-600 hover:underline">
            {focusAllOn ? t("myWork.deselectAll") : t("myWork.selectAll")}
          </button>
        )}
      </div>
      {focusShown.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-indigo-200">
          {focusShown.map((i) => renderRow(i, { showReasons: true, muted: false, selectable: i.mine }))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white px-3 py-6 text-center">
          <p className="text-sm text-gray-600">{t("myWork.focus.empty")}</p>
          <p className="mt-1 text-xs text-gray-400">
            {t("myWork.focus.emptyStats", { open: restOpenMine.length, noDue: restOpenMine.filter((i) => !i.due_date).length })}
          </p>
          {reasonFilter ? (
            <button type="button" onClick={() => setCardFilter(null)} className="mt-2 text-xs text-indigo-600 hover:underline">
              {t("myWork.focus.clearFilter")}
            </button>
          ) : (
            hasRest && (
              <button
                type="button"
                onClick={() => document.getElementById("mywork-rest")?.scrollIntoView({ behavior: "smooth" })}
                className="mt-2 text-xs text-indigo-600 hover:underline"
              >
                {t("myWork.focus.showRest")}
              </button>
            )
          )}
        </div>
      )}
    </section>
  );

  const assignedView = (
    <>
      {focusSection}
      {hasRest && (
        <div id="mywork-rest" className="flex flex-wrap items-center gap-2 pt-2">
          <h2 className="text-[15px] font-bold text-gray-900">{t("myWork.rest.title")}</h2>
          <span className="text-xs text-gray-500">{t("myWork.rest.hint")}</span>
          <span className="ml-auto text-xs text-gray-400">{t("myWork.rest.legend")}</span>
        </div>
      )}
      {ORIGIN_ORDER.map((sec) => {
        const items = sectionItems(sec);
        if (!items.length) return null;
        const isCollapsed = collapsed.has(sec);
        const createdOnly = sec === "CREATED_AWAITING";
        const selectable = createdOnly ? [] : items.filter((i) => i.mine && !i.doneToday);
        const allOn = selectable.length > 0 && selectable.every((i) => picked.has(i.pit_id));
        const overdueN = items.filter((i) => i.reasons.includes("OVERDUE")).length;
        const todayN = items.filter((i) => i.reasons.includes("TODAY")).length;
        return (
          <section key={sec} className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setCollapsed((prev) => {
                    const next = new Set(prev);
                    if (next.has(sec)) next.delete(sec);
                    else next.add(sec);
                    return next;
                  })
                }
                className="flex items-center gap-2 text-[13px] font-semibold text-gray-800"
                aria-expanded={!isCollapsed}
              >
                <span className="w-2.5 text-[9px] text-gray-400">{isCollapsed ? "▶" : "▼"}</span>
                <span className={`h-2 w-2 rounded-full ${ORIGIN_DOT[sec]}`} />
                {t(`myWork.origin.${sec}`)}
                <span className="font-mono text-xs font-normal text-gray-400">{items.length}</span>
                <span className="text-[11.5px] font-normal text-gray-400">{t(`myWork.originHint.${sec}`)}</span>
              </button>
              {(overdueN > 0 || todayN > 0) && sec !== "DONE_TODAY" && (
                <span className="text-[11.5px] font-semibold">
                  {overdueN > 0 && <span className="text-red-600">{t("myWork.originSummary.overdue", { count: overdueN })}</span>}
                  {overdueN > 0 && todayN > 0 && <span className="text-gray-300"> · </span>}
                  {todayN > 0 && <span className="text-orange-600">{t("myWork.originSummary.today", { count: todayN })}</span>}
                </span>
              )}
              {sec !== "DONE_TODAY" && selectable.length > 0 && (
                <button type="button" onClick={() => toggleSelectAll(items)} className="ml-auto text-[11.5px] text-indigo-600 hover:underline">
                  {allOn ? t("myWork.deselectAll") : t("myWork.selectAll")}
                </button>
              )}
            </div>
            {!isCollapsed && (
              <div className="overflow-hidden rounded-xl border border-gray-200">
                {items.map((i) => renderRow(i, { muted: createdOnly, showAssignee: createdOnly }))}
              </div>
            )}
          </section>
        );
      })}
    </>
  );

  const relationView = (r: Exclude<Relation, "ASSIGNED">) => {
    const items = relationItems(r).sort(urgency);
    return (
      <>
        <p className="text-xs text-gray-500">{t(`myWork.relationList.${r}`)}</p>
        {items.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-gray-200">
            {items.map((i) => renderRow(i, { muted: true, showAssignee: r === "REPORTER" }))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-gray-200 px-3 py-8 text-center text-sm text-gray-400">{t("myWork.emptyInvolved")}</p>
        )}
      </>
    );
  };

  const cardList = (f: "ASSIGNED_TODAY" | "WEEK" | "DONE_TODAY") => {
    const list = filtered.filter(CARD_LIST[f]).sort(urgency);
    return (
      <section className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCardFilter(null)}
            className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
          >
            {t(`myWork.card.${f}`, { count: list.length })} · {t("myWork.card.clear")} ✕
          </button>
        </div>
        {list.length ? (
          <div className="overflow-hidden rounded-xl border border-indigo-200">
            {list.map((i) => renderRow(i, { showReasons: true, muted: false, selectable: f !== "DONE_TODAY" }))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-gray-200 bg-white px-3 py-8 text-center text-sm text-gray-400">{t("myWork.card.empty")}</p>
        )}
      </section>
    );
  };

  const todayView =
    relation === "ASSIGNED"
      ? cardFilter && !isReasonFilter(cardFilter)
        ? cardList(cardFilter)
        : assignedView
      : relationView(relation);
  // 업무는 있는데 필터로 다 가려진 경우만 (진짜 빈 상태는 오늘 처리 구역의 빈 안내)
  const nothingShown =
    all.length > 0 && (!!needle || !!projectFilter) && relation === "ASSIGNED" && !cardFilter && !focusAll.length && !hasRest;

  return (
    <div className="min-w-0">
      <PageHeader
        icon={ListTodo}
        title={t("nav.myWork")}
        description={t("pageHeader.myWork.desc")}
        meta={<span>{t("myWork.subtitle", { total: mineOpen.length, overdue: mineOpen.filter((i) => i.reasons.includes("OVERDUE")).length })}</span>}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus size={14} className="mr-1" />
            {t("myWork.newWork")}
          </Button>
        }
        tabs={
          <UnderlineTabs
            label={t("nav.myWork")}
            items={VIEW_MODES.map((v) => ({ key: v, label: t(`myWork.view.${v}`) }))}
            value={view}
            onChange={setView}
          />
        }
      />
      <div className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-surface lg:min-h-[calc(100dvh-14rem)] lg:flex-row">
        {/* 가운데 */}
        <div className="flex min-w-0 flex-1 flex-col bg-gray-50/60">
          <div className="flex flex-col gap-3 px-4 pb-4 pt-4 sm:px-5">
            {/* KPI */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 2xl:grid-cols-6">
              {kpis.map((k) => (
                <StatCard
                  key={k.id}
                  label={
                    <span className="flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${k.tone}`} aria-hidden="true" />
                      {k.label}
                    </span>
                  }
                  value={k.value}
                  hint={k.sub}
                  tone={k.strong ? "accent" : "default"}
                  onClick={k.filter ? () => focusOn(k.filter!) : undefined}
                  active={!!k.filter && cardFilter === k.filter}
                />
              ))}
            </div>

            {/* 관계 칩 — 칸반은 내 담당 이슈 전용이라 제외 */}
            {view !== "kanban" && (
              <div className="flex items-center gap-2 overflow-x-auto">
                <span className="shrink-0 text-xs text-gray-500">{t("myWork.relation.label")}</span>
                <div className="flex shrink-0 gap-1" role="tablist" title={t("myWork.relation.hint")}>
                  {RELATIONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      role="tab"
                      aria-selected={relation === r}
                      onClick={() => {
                        setRelation(r);
                        setCardFilter(null);
                      }}
                      className={`rounded-full border px-3 py-1 text-xs ${relation === r ? "border-indigo-600 bg-accent-600 font-semibold text-white" : "border-gray-200 bg-white text-gray-600 hover:border-indigo-300"}`}
                    >
                      {t(`myWork.relation.${r}`)} <span className="font-mono opacity-80">{relationItems(r).length}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 필터 */}
            <div className="flex flex-wrap items-center gap-2">
              {projectOptions.length > 0 && view !== "project" && (
                <select
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                  className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700"
                  aria-label={t("myWork.filter.project")}
                >
                  <option value="">
                    {t("myWork.filter.project")} · {t("myWork.filter.all")}
                  </option>
                  {projectOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("myWork.searchPlaceholder")}
                  aria-label={t("myWork.searchPlaceholder")}
                  className="w-48 rounded-lg border border-gray-200 bg-white py-1.5 pl-7 pr-2 text-xs text-gray-700"
                />
              </div>
            </div>

            {work.error ? (
              <p role="alert" className="text-sm text-red-600">
                {errorText(work.error)}
              </p>
            ) : work.isLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : view === "kanban" ? (
              <>
                <p className="text-xs text-gray-500">{t("myWork.kanban.notice")}</p>
                <MyWorkKanban items={filtered} tz={tz} today={today} selectedId={selectedId} onSelect={(i) => setSelectedId(i.pit_id)} />
              </>
            ) : nothingShown ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-white px-3 py-8 text-center">
                <p className="text-sm text-gray-600">{t("myWork.filterEmpty")}</p>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-2 rounded-lg border border-indigo-200 px-3 py-1 text-xs text-indigo-600 hover:bg-indigo-50"
                >
                  {t("myWork.resetFilter")}
                </button>
              </div>
            ) : view === "today" ? (
              todayView
            ) : (
              <MyProjectsView
                items={relationItems(relation).sort(urgency)}
                relationLabel={t(`myWork.relation.${relation}`)}
                showFocus={relation === "ASSIGNED"}
                selected={projectKey}
                onSelect={setProjectKey}
                renderRows={(items) =>
                  items.map((i) => renderRow(i, relation === "ASSIGNED" ? {} : { muted: true, showAssignee: relation === "REPORTER" }))
                }
              />
            )}
          </div>

          {/* 선택 바 */}
          {pickedItems.length > 0 && (
            <div className="sticky bottom-0 z-10 mt-auto flex flex-wrap items-center gap-3 border-t border-gray-200 bg-white px-5 py-3 shadow-[0_-6px_16px_rgba(0,0,0,0.06)]">
              <span className="text-sm text-gray-800">{t("myWork.saveBar.selected", { count: pickedItems.length })}</span>
              <button
                type="button"
                onClick={() => setPicked(new Set())}
                className="ml-auto rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
              >
                {t("myWork.saveBar.clear")}
              </button>
              <button
                type="button"
                disabled={!pickedItems.some((i) => !i.doneToday) || pickedItems.length > MAX_BULK_COMPLETE}
                title={pickedItems.length > MAX_BULK_COMPLETE ? t("myWork.complete.tooMany", { max: MAX_BULK_COMPLETE }) : undefined}
                onClick={() => setCompleteTargets(pickedItems.filter((i) => !i.doneToday))}
                className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {t("myWork.saveBar.complete")}
              </button>
            </div>
          )}
        </div>

        {/* 우측 패널 */}
        <aside className="flex w-full shrink-0 flex-col border-t border-gray-200 bg-white lg:w-[340px] lg:border-l lg:border-t-0">
          <div className="flex border-b border-gray-200">
            <span className="flex-1 border-b-2 border-indigo-600 py-2.5 text-center text-xs font-semibold text-indigo-600">
              {t("myWork.panel.detail")}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <WorkDetailPanel
              key={selected?.pit_id ?? "none"}
              item={selected}
              tz={tz}
              today={today}
              busy={!!selected && busyId === selected.pit_id}
              onComplete={(i) => setCompleteTargets([i])}
              onOpenFull={(i) => openIssue(i.pit_id)}
              onOpenIssue={openIssue}
            />
          </div>
        </aside>

        {creating && (
          <IssueFormDialog
            close={() => setCreating(false)}
            onSaved={(id, title) => {
              setSelectedId(id);
              setResult({ ok: true, title: t("myWork.created.title"), message: t("myWork.created.msg", { title }) });
            }}
          />
        )}
        {completeTargets && (
          <CompleteConfirmModal targets={completeTargets} onClose={() => setCompleteTargets(null)} onFinished={finishComplete} />
        )}
        <ActionResultModal result={result} onClose={closeResult} />
      </div>
    </div>
  );
}
