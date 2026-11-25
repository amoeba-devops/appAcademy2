import {
  useVideoConfig,
  canEnterVideo,
} from "@/modules/cfg/hooks/use-video-config";
import { useMemo, useRef, useState } from "react";
import {
  Navigate,
  useNavigate,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Video } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { portalApi, type PortalCalEvent } from "../api/portal-api";
import { useAuthStore } from "@/stores/auth.store";
import { formatEventWhen, formatInTz, formatDualRange, tzCity } from "@/lib/tz";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useMyZones } from "@/modules/me/use-my-zones";
import { eventLine, eventStudentNames } from "@/modules/cal/lib/event-line";

type ViewMode = "month" | "week" | "day" | "list";
const STUDENT_COLORS = [
  "border-indigo-500 bg-indigo-50 text-indigo-950",
  "border-cyan-600 bg-cyan-50 text-cyan-950",
  "border-fuchsia-500 bg-fuchsia-50 text-fuchsia-950",
  "border-emerald-600 bg-emerald-50 text-emerald-950",
  "border-orange-600 bg-orange-50 text-orange-950",
];
// REQ-261125-CAL — 학생 이름은 일정 참석자로 등록된 시스템 학생만 (관리자 달력과 동일).
function studentNames(event: PortalCalEvent): string[] {
  return eventStudentNames(event);
}
function studentColor(event: PortalCalEvent) {
  const name = studentNames(event)[0] || event.title;
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return STUDENT_COLORS[hash % STUDENT_COLORS.length];
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function addDays(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}
function iso(d: Date) {
  return d.toISOString();
}
function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Inclusive range [from, to) for the current view/anchor. */
function rangeFor(mode: ViewMode, anchor: Date): { from: Date; to: Date } {
  if (mode === "day")
    return { from: startOfDay(anchor), to: addDays(startOfDay(anchor), 1) };
  if (mode === "week") {
    const from = addDays(startOfDay(anchor), -anchor.getDay());
    return { from, to: addDays(from, 7) };
  }
  // month — pad to full weeks
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const from = addDays(first, -first.getDay());
  const lastOfMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const to = addDays(lastOfMonth, 7 - lastOfMonth.getDay());
  return { from, to };
}

export function PortalCalendarPage() {
  const kind = useAuthStore((s) => s.portal.user?.kind);
  return kind === "TEACHER" ? (
    <TeacherCalendar />
  ) : (
    <Navigate to="/portal/notices" replace />
  );
}

function TeacherCalendar() {
  const { t, i18n } = useTranslation(["common", "cal"]);
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const [initialMode] = useState<ViewMode>(() =>
    window.matchMedia("(max-width: 639px)").matches ? "day" : "month",
  );
  const modeParam = params.get("view");
  const mode: ViewMode = ["month", "week", "day", "list"].includes(
    modeParam ?? "",
  )
    ? (modeParam as ViewMode)
    : initialMode;
  const rawDate = params.get("date");
  const parsedDate =
    rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
      ? new Date(rawDate + "T00:00:00")
      : new Date();
  const anchor = startOfDay(
    Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate,
  );
  const change = (key: string, value: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  const setMode = (next: ViewMode) => change("view", next);
  const setAnchor = (next: Date | ((d: Date) => Date)) => {
    const date = typeof next === "function" ? next(anchor) : next;
    change(
      "date",
      [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
      ].join("-"),
    );
  };
  const mobile = useMediaQuery("(max-width: 639px)");
  const [selected, setSelected] = useState<PortalCalEvent | null>(null);
  const navigate = useNavigate();
  // PLN-260729 3 — 일/주/리스트: 학생/수업종류 필터 + 모달 없이 바로 상세.
  const studentFilter = params.get("student") ?? "";
  const categoryFilter = params.get("category") ?? "";
  const setStudentFilter = (value: string) => change("student", value);
  const setCategoryFilter = (value: string) => change("category", value);
  const openDirect = (e: PortalCalEvent) =>
    navigate("/portal/calendar/" + e.id, {
      state: { from: location.pathname + location.search },
    });
  const user = useAuthStore((s) => s.portal.user);

  const { from, to } = useMemo(() => rangeFor(mode, anchor), [mode, anchor]);
  const {
    data: events = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: [
      "portal-cal",
      user?.entId,
      user?.refId,
      mode,
      from.toISOString(),
      to.toISOString(),
    ],
    queryFn: () => portalApi.calEvents(iso(from), iso(to)),
  });

  const studentOptions = useMemo(
    () => Array.from(new Set(events.flatMap(studentNames))).sort(),
    [events],
  );
  const filteredEvents = useMemo(
    () =>
      events.filter(
        (e) =>
          (!studentFilter || studentNames(e).includes(studentFilter)) &&
          (!categoryFilter || e.category === categoryFilter),
      ),
    [events, studentFilter, categoryFilter],
  );

  const step = (dir: number) => {
    if (mode === "day") setAnchor((a) => addDays(a, dir));
    else if (mode === "week") setAnchor((a) => addDays(a, dir * 7));
    else setAnchor((a) => new Date(a.getFullYear(), a.getMonth() + dir, 1));
  };

  const heading = new Intl.DateTimeFormat(i18n.language, {
    year: "numeric",
    month: "long",
    ...(mode === "week" || mode === "day" ? { day: "numeric" } : {}),
  }).format(anchor);

  return (
    <div>
      <h1 className="portal-title">{t("portalApp.nav.calendar")}</h1>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            aria-label={t("portalUi.previous")}
            className="min-h-11 min-w-11 rounded hover:bg-[var(--gray-100)]"
            onClick={() => step(-1)}
          >
            <ChevronLeft size={18} />
          </button>
          <span className="min-w-[9rem] text-center font-semibold text-primary">
            {heading}
          </span>
          <button
            aria-label={t("portalUi.next")}
            className="min-h-11 min-w-11 rounded hover:bg-[var(--gray-100)]"
            onClick={() => step(1)}
          >
            <ChevronRight size={18} />
          </button>
          <button
            className="ml-1 min-h-11 rounded border border-[var(--border-subtle)] px-3 py-2 text-sm"
            onClick={() => setAnchor(startOfDay(new Date()))}
          >
            {t("portalApp.cal.today")}
          </button>
        </div>
        <div className="flex rounded-md border border-[var(--border-subtle)] text-xs">
          {(["month", "week", "day", "list"] as ViewMode[]).map((m) => (
            <button
              key={m}
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={`min-h-11 px-3 py-2 ${mode === m ? "bg-accent-600 text-white" : "text-secondary"}`}
            >
              {t(`portalApp.cal.${m}`)}
            </button>
          ))}
        </div>
      </div>

      {
        <div className="portal-toolbar">
          <span className="text-secondary">
            {t("portalApp.cal.filterStudent", "학생")}:
          </span>
          <select
            aria-label={t("portalApp.cal.filterStudent")}
            value={studentFilter}
            onChange={(e) => setStudentFilter(e.target.value)}
            className="h-9 sm:h-7 rounded-md border border-[var(--border-subtle)] bg-canvas px-2"
          >
            <option value="">{t("portalApp.cal.all", "전체")}</option>
            {Array.from(
              new Set([
                ...(studentFilter ? [studentFilter] : []),
                ...studentOptions,
              ]),
            ).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <span className="text-secondary">
            {t("portalApp.cal.filterCategory", "수업종류")}:
          </span>
          <select
            aria-label={t("portalApp.cal.filterCategory")}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 sm:h-7 rounded-md border border-[var(--border-subtle)] bg-canvas px-2"
          >
            <option value="">{t("portalApp.cal.all", "전체")}</option>
            {[
              "REGULAR_CLASS",
              "DEMO_CLASS",
              "LEVEL_TEST",
              "MEETING",
              "OTHER",
            ].map((c) => (
              <option key={c} value={c}>
                {t(`cal:category.${c}`, c)}
              </option>
            ))}
          </select>
        </div>
      }

      {mobile && mode === "day" && (
        <div className="portal-week-strip" aria-label={t("portalApp.cal.week")}>
          {Array.from({ length: 7 }, (_, i) =>
            addDays(anchor, i - anchor.getDay()),
          ).map((day) => (
            <button
              key={day.toISOString()}
              type="button"
              aria-pressed={sameDay(day, anchor)}
              onClick={() => setAnchor(day)}
            >
              <span>
                {day.toLocaleDateString(i18n.language, { weekday: "short" })}
              </span>
              <b>{day.getDate()}</b>
            </button>
          ))}
        </div>
      )}
      {isError ? (
        <div role="alert" className="py-10 text-center text-sm">
          <p>{t("portalApp.cal.loadError")}</p>
          <button
            type="button"
            className="mt-2 rounded border px-3 py-2"
            onClick={() => void refetch()}
          >
            {t("portalApp.cal.retry")}
          </button>
        </div>
      ) : isLoading ? (
        <p className="py-10 text-center text-sm text-secondary">…</p>
      ) : mode === "month" ? (
        <MonthGrid
          from={from}
          anchorMonth={anchor.getMonth()}
          anchorYear={anchor.getFullYear()}
          events={filteredEvents}
          onSelect={setSelected}
        />
      ) : mode === "list" ? (
        <ListView
          events={filteredEvents}
          locale={i18n.language}
          emptyLabel={
            studentFilter || categoryFilter
              ? t("portalUi.noMatches")
              : t("portalApp.cal.empty")
          }
          onSelect={openDirect}
        />
      ) : (
        <Agenda
          days={mode === "week" ? 7 : 1}
          from={from}
          events={filteredEvents}
          emptyLabel={
            studentFilter || categoryFilter
              ? t("portalUi.noMatches")
              : t("portalApp.cal.empty")
          }
          onSelect={openDirect}
        />
      )}

      {!isLoading &&
        !isError &&
        mode === "month" &&
        filteredEvents.length === 0 && (
          <p role="status" className="mt-3 text-center text-sm text-secondary">
            {studentFilter || categoryFilter
              ? t("portalUi.noMatches")
              : t("portalApp.cal.empty")}
          </p>
        )}
      <EventDetailModal event={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function eventsOn(events: PortalCalEvent[], day: Date) {
  return events
    .filter((e) => {
      const s = new Date(e.startAt);
      const en = new Date(e.endAt);
      return s < addDays(day, 1) && en > day;
    })
    .sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));
}

// REQ-261125-CAL — 관리자 달력과 같은 24시간 "17:00" (hourCycle 은 ko 에서 "오후" 가 붙는 경우가 있어 hour12:false)
const HM = { hour: "2-digit", minute: "2-digit", hour12: false } as const;
/** REQ-261015C — 테넌트 기본 타임존 기준 시각 + 사용자 타임존 병기. */
function usePortalTime() {
  const { i18n } = useTranslation();
  const zones = useMyZones("portal");
  const locale = i18n.language;
  const label = (e: PortalCalEvent) =>
    e.allDay ? "" : formatInTz(e.startAt, zones.tenantTz, locale, HM);
  return {
    zones,
    locale,
    label,
    /** 사용자 타임존 시각(다를 때만). */
    userLabel: (e: PortalCalEvent) => {
      if (e.allDay || !zones.userTz || zones.userTz === zones.tenantTz)
        return "";
      const mine = formatInTz(e.startAt, zones.userTz, locale, HM);
      return mine === label(e) ? "" : `${mine} ${tzCity(zones.userTz)}`;
    },
    range: (e: PortalCalEvent) =>
      formatDualRange(e.startAt, e.endAt, zones, locale, HM),
  };
}

function MonthGrid({
  from,
  anchorMonth,
  anchorYear,
  events,
  onSelect,
}: {
  from: Date;
  anchorMonth: number;
  anchorYear: number;
  events: PortalCalEvent[];
  onSelect: (e: PortalCalEvent) => void;
}) {
  const video = useVideoConfig(true);
  const { t } = useTranslation("cal");
  const time = usePortalTime();
  const overflowTrigger = useRef<HTMLButtonElement | null>(null);
  const eventTrigger = useRef<HTMLButtonElement | null>(null);
  const [overflowDay, setOverflowDay] = useState<Date | null>(null);
  const [overflowEvent, setOverflowEvent] = useState<PortalCalEvent | null>(
    null,
  );
  const weeks = Math.ceil(
    (new Date(anchorYear, anchorMonth + 1, 0).getDate() +
      new Date(anchorYear, anchorMonth, 1).getDay()) /
      7,
  );
  const today = startOfDay(new Date());
  const cells = Array.from({ length: weeks * 7 }, (_, i) => addDays(from, i));
  return (
    <>
      <div className="grid grid-cols-7 overflow-hidden rounded-md border border-[var(--border-subtle)] text-xs">
        {cells.slice(0, 7).map((d, i) => (
          <div
            key={`h${i}`}
            className={
              "border-b border-[var(--border-subtle)] bg-[var(--gray-50)] p-2 text-center " +
              (i === 0
                ? "text-red-600"
                : i === 6
                  ? "text-blue-600"
                  : "text-secondary")
            }
          >
            {d.toLocaleDateString(time.locale, { weekday: "short" })}
          </div>
        ))}
        {cells.map((d, i) => {
          const dayEvents = eventsOn(events, d);
          const inMonth = d.getMonth() === anchorMonth;
          return (
            <div
              key={i}
              className={`min-h-[108px] border-b border-r border-[var(--border-subtle)] p-1 align-top ${
                inMonth ? "" : "bg-[var(--gray-50)] text-secondary"
              }`}
            >
              <div className="flex justify-end">
                <span
                  className={
                    "mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full " +
                    (sameDay(d, today)
                      ? "bg-accent-600 font-semibold text-white"
                      : !inMonth
                        ? "text-secondary"
                        : d.getDay() === 0
                          ? "text-red-600"
                          : d.getDay() === 6
                            ? "text-blue-600"
                            : "")
                  }
                >
                  {d.getDate()}
                </span>
              </div>
              {dayEvents.slice(0, 3).map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => onSelect(e)}
                  title={eventLine(time.range(e), e)}
                  className={
                    "mt-1 block w-full rounded border-l-[3px] px-1.5 py-1 text-left hover:brightness-95 " +
                    studentColor(e)
                  }
                >
                  {/* REQ-261125-CAL2 — 관리자 카드처럼 1줄 문구, 2줄 과목(일정 구분). 강사 줄 없음 */}
                  <span className="flex items-center gap-1">
                    {canEnterVideo(e, video.bodaEnabled) && (
                      <Video size={10} className="shrink-0" />
                    )}
                    <span className="truncate font-medium">{eventLine(time.label(e), e)}</span>
                    {/* PLN-260728F B — 캘린더 칸엔 수업완료만 */}
                    {e.classDone && (
                      <span className="shrink-0 rounded bg-emerald-100 px-0.5 text-[8px] font-semibold text-emerald-800">
                        ✓
                      </span>
                    )}
                  </span>
                  <span className="block truncate opacity-80">
                    {t(`category.${e.category}`, e.category)}
                  </span>
                </button>
              ))}
              {dayEvents.length > 3 && (
                <button
                  type="button"
                  className="mt-1 rounded px-1 text-accent-700 underline hover:bg-accent-50 focus-visible:outline focus-visible:outline-2"
                  onClick={(e) => {
                    overflowTrigger.current = e.currentTarget;
                    setOverflowDay(d);
                  }}
                  aria-label={t("overflow.open", {
                    date: d.toLocaleDateString(),
                    count: dayEvents.length,
                  })}
                >
                  {t("overflow.more", { count: dayEvents.length - 3 })}
                </button>
              )}
            </div>
          );
        })}
      </div>
      <Dialog
        open={!!overflowDay}
        onOpenChange={(open) => {
          if (!open) setOverflowDay(null);
        }}
      >
        <DialogContent
          className="max-w-lg"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            overflowTrigger.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {t("overflow.title", {
                date: overflowDay?.toLocaleDateString(),
                count: overflowDay ? eventsOn(events, overflowDay).length : 0,
              })}
            </DialogTitle>
          </DialogHeader>
          <ul className="max-h-[65vh] space-y-2 overflow-y-auto">
            {overflowDay &&
              eventsOn(events, overflowDay).map((event) => (
                <li key={event.id}>
                  <button
                    type="button"
                    onClick={(e) => {
                      eventTrigger.current = e.currentTarget;
                      setOverflowEvent(event);
                    }}
                    className="w-full rounded-md border border-[var(--border-subtle)] p-3 text-left hover:bg-accent-50 focus-visible:outline focus-visible:outline-2"
                  >
                    <span className="block text-xs text-secondary">
                      {event.allDay ? t("overflow.allDay") : time.range(event)}
                    </span>
                    <span className="block break-words font-medium">
                      {eventLine("", event)}
                    </span>
                    <span className="block text-sm text-secondary">
                      {t(`category.${event.category}`, event.category)}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
          <EventDetailModal
            event={overflowEvent}
            onClose={() => setOverflowEvent(null)}
            returnFocus={() => eventTrigger.current?.focus()}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function Agenda({
  days,
  from,
  events,
  emptyLabel,
  onSelect,
}: {
  days: number;
  from: Date;
  events: PortalCalEvent[];
  emptyLabel: string;
  onSelect: (e: PortalCalEvent) => void;
}) {
  const cols = Array.from({ length: days }, (_, i) => addDays(from, i));
  return (
    <div className="space-y-3">
      {cols.map((d, i) => {
        const dayEvents = eventsOn(events, d);
        return (
          <div
            key={i}
            className="rounded-md border border-[var(--border-subtle)]"
          >
            <div className="border-b border-[var(--border-subtle)] bg-[var(--gray-50)] px-3 py-1.5 text-sm font-medium text-primary">
              {d.toLocaleDateString([], {
                month: "long",
                day: "numeric",
                weekday: "short",
              })}
            </div>
            {dayEvents.length === 0 ? (
              <p className="px-3 py-3 text-sm text-secondary">{emptyLabel}</p>
            ) : (
              dayEvents.map((e) => (
                <EventRow key={e.id} e={e} onSelect={onSelect} />
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}

function EventRow({
  e,
  onSelect,
}: {
  e: PortalCalEvent;
  onSelect: (e: PortalCalEvent) => void;
}) {
  const video = useVideoConfig(true);
  const { t } = useTranslation("common");
  const time = usePortalTime();
  return (
    <button
      type="button"
      onClick={() => onSelect(e)}
      className="flex w-full items-center gap-3 border-b border-[var(--border-subtle)] px-3 py-2 text-left last:border-b-0 hover:bg-[var(--gray-50)]"
    >
      <span className="w-20 shrink-0 text-sm text-secondary">
        {time.label(e) || "—"}
        {time.userLabel(e) && (
          <span className="block text-xs">({time.userLabel(e)})</span>
        )}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-primary">
        {/* REQ-261125-CAL — 관리자 달력과 같은 "학생 | 제목" (시간은 왼쪽 칸) */}
        {eventLine("", e)}
        <span className="ml-1.5 text-secondary">
          · {t(`cal:category.${e.category}`, e.category)}
        </span>
      </span>
      {/* PLN-260729 3 — 피드백/과제 텍스트 표기 (아이콘은 월간뷰만) */}
      <span className="flex shrink-0 items-center gap-1.5 text-xs">
        {e.hasFeedback && (
          <span className="text-accent-700">
            {t("portalApp.review.textFeedback", "피드백")}
          </span>
        )}
        {e.homeworkStatus === "ASSIGNED" && (
          <span className="text-accent-700">
            {t("portalApp.review.textHomework", "과제제출")}
          </span>
        )}
        {e.homeworkStatus === "NONE" && (
          <span className="text-secondary">
            {t("portalApp.review.noHomework", "과제없음")}
          </span>
        )}
        {e.classDone && (
          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-800">
            {t("portalApp.review.done", "수업완료")}
          </span>
        )}
      </span>
      {e.assigneeName && (
        <span className="text-xs text-secondary">{e.assigneeName}</span>
      )}
      {canEnterVideo(e, video.bodaEnabled) && (
        <Video size={14} className="shrink-0 text-accent-700" />
      )}
    </button>
  );
}

// PLN-260718 — 리스트 보기: 기간 내 이벤트를 날짜별로 묶어 평면 리스트로 표시.
function ListView({
  events,
  locale,
  emptyLabel,
  onSelect,
}: {
  events: PortalCalEvent[];
  locale: string;
  emptyLabel: string;
  onSelect: (e: PortalCalEvent) => void;
}) {
  const sorted = [...events].sort(
    (a, b) => +new Date(a.startAt) - +new Date(b.startAt),
  );
  if (sorted.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-secondary">{emptyLabel}</p>
    );
  }
  // 날짜별 그룹 (이벤트가 있는 날만)
  const groups: { key: string; label: string; items: PortalCalEvent[] }[] = [];
  for (const e of sorted) {
    const d = new Date(e.startAt);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = {
        key,
        label: d.toLocaleDateString(locale, {
          month: "long",
          day: "numeric",
          weekday: "short",
        }),
        items: [],
      };
      groups.push(g);
    }
    g.items.push(e);
  }
  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <div
          key={g.key}
          className="rounded-md border border-[var(--border-subtle)]"
        >
          <div className="border-b border-[var(--border-subtle)] bg-[var(--gray-50)] px-3 py-1.5 text-sm font-medium text-primary">
            {g.label}
          </div>
          {g.items.map((e) => (
            <EventRow key={e.id} e={e} onSelect={onSelect} />
          ))}
        </div>
      ))}
    </div>
  );
}

// PLN-260715 — quick summary modal. Full content + BODA entry live on the
// dedicated detail page (/portal/calendar/:evtId).
function EventDetailModal({
  event,
  onClose,
  returnFocus,
}: {
  event: PortalCalEvent | null;
  onClose: () => void;
  returnFocus?: () => void;
}) {
  const video = useVideoConfig(true);
  const { t, i18n } = useTranslation("common");
  const navigate = useNavigate();
  const location = useLocation();
  const isBoda = !!event && canEnterVideo(event, video.bodaEnabled);
  // REQ-261125-CAL2 — 강의링크(참석 학생의 학생관리 수업 링크)는 상세 응답에만 있다.
  const detail = useQuery({
    enabled: !!event,
    queryKey: ["portal-cal-event", event?.id],
    queryFn: () => portalApi.calEvent(event!.id),
  });
  const classLinks = (detail.data?.classLinks ?? []).filter((c) => c.links.length);

  const zones = useMyZones("portal");
  const when = event
    ? formatEventWhen(
        event.startAt,
        event.endAt,
        event.allDay,
        zones,
        i18n.language,
      )
    : "";

  return (
    <Dialog open={!!event} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        onCloseAutoFocus={
          returnFocus
            ? (e) => {
                e.preventDefault();
                returnFocus();
              }
            : undefined
        }
      >
        {event && (
          <>
            <DialogHeader>
              <DialogTitle>{event.title}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-2 text-sm">
              <div>
                <span className="text-secondary">
                  {t("portalApp.cal.when", "일시")}
                </span>{" "}
                {when}
              </div>
              {/* REQ-261125-CAL2 — 과목(일정 구분) */}
              <div>
                <span className="text-secondary">
                  {t("portalApp.cal.subject", "과목")}
                </span>{" "}
                {t(`cal:category.${event.category}`, event.category)}
              </div>
              {/* REQ-261125-CAL2 — 강의링크 */}
              <div className="flex flex-wrap items-baseline gap-x-1">
                <span className="text-secondary">
                  {t("portalApp.cal.classLinks", "강의링크")}
                </span>
                {detail.isLoading ? (
                  <span className="text-secondary">…</span>
                ) : classLinks.length ? (
                  <ul className="grid gap-0.5">
                    {classLinks.flatMap((c) =>
                      c.links.map((l, i) => (
                        <li key={`${c.stdName}:${i}`}>
                          {c.stdName} ·{" "}
                          <a
                            href={l.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent-700 underline break-all"
                          >
                            {l.label || l.url}
                          </a>
                        </li>
                      )),
                    )}
                  </ul>
                ) : (
                  <span className="text-secondary">
                    {t("portalApp.cal.noClassLinks", "등록된 수업 링크 없음")}
                  </span>
                )}
              </div>
              {event.assigneeName && (
                <div>
                  <span className="text-secondary">
                    {t("portalApp.cal.teacher", "담당 강사")}
                  </span>{" "}
                  {event.assigneeName}
                </div>
              )}
              {event.locationText && (
                <div>
                  <span className="text-secondary">
                    {t("portalApp.cal.location", "장소")}
                  </span>{" "}
                  {event.locationText}
                </div>
              )}
              {event.description && (
                <p className="line-clamp-3 whitespace-pre-wrap text-primary">
                  {event.description}
                </p>
              )}

              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    navigate("/portal/calendar/" + event.id, {
                      state: { from: location.pathname + location.search },
                    })
                  }
                  className="inline-flex items-center gap-2 rounded-md bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700"
                >
                  {isBoda && <Video size={16} />}
                  {t("portalApp.cal.viewFull", "전체내용보기")}
                </button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
