import { todayYmd } from "@/lib/tz";
import { day, type Issue } from "../issue-model";

/**
 * REQ-261016C — AMA 내 업무(workDisplay·groupMyWork)를 ACM 이슈 모델로 옮긴 표시 규칙.
 * 날짜는 테넌트 타임존 기준.
 */
export type Relation = "ASSIGNED" | "REPORTER" | "PARTICIPANT";
export const RELATIONS: Relation[] = ["ASSIGNED", "REPORTER", "PARTICIPANT"];
export type Role = "ASSIGNEE" | "REPORTER" | "PARTICIPANT";
export type Reason = "OVERDUE" | "TODAY";
export type Origin = "ASSIGNED_BY_OTHERS" | "MY_OWN" | "CREATED_AWAITING" | "DONE_TODAY";
export const ORIGIN_ORDER: Origin[] = ["ASSIGNED_BY_OTHERS", "MY_OWN", "CREATED_AWAITING", "DONE_TODAY"];
export const ORIGIN_DOT: Record<Origin, string> = {
  ASSIGNED_BY_OTHERS: "bg-indigo-600",
  MY_OWN: "bg-sky-500",
  CREATED_AWAITING: "bg-gray-400",
  DONE_TODAY: "bg-green-500",
};
export const REASON_CLASS: Record<Reason, string> = {
  OVERDUE: "bg-red-50 text-red-700 border-red-200",
  TODAY: "bg-orange-50 text-orange-700 border-orange-200",
};

export interface WorkItem extends Issue {
  mine: boolean;
  roles: Role[];
  reasons: Reason[];
  doneToday: boolean;
}

const dayDiff = (a: string, b: string) =>
  Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);

/** 백엔드 my-work 행 → 표시용 항목. 오늘 이전에 완료된 이슈는 뺀다. */
export function toWorkItems(rows: Issue[], me: string | undefined, tz: string): WorkItem[] {
  const today = todayYmd(tz);
  return rows.flatMap((i) => {
    const doneToday =
      i.pit_status === "DONE" && !!i.pit_done_at && todayYmd(tz, new Date(i.pit_done_at)) === today;
    if (i.pit_status === "DONE" && !doneToday) return [];
    if (i.pit_status === "REJECTED") return [];
    const mine = !!me && i.assignee_id === me;
    const roles: Role[] = [];
    if (mine) roles.push("ASSIGNEE");
    if (i.created_by === me) roles.push("REPORTER");
    if (me && i.participant_ids?.includes(me)) roles.push("PARTICIPANT");
    const due = day(i.due_date);
    const reasons: Reason[] =
      mine && !doneToday && due ? (due < today ? ["OVERDUE"] : due === today ? ["TODAY"] : []) : [];
    return [{ ...i, mine, roles, reasons, doneToday }];
  });
}

export function originOf(i: WorkItem, me: string | undefined): Origin | null {
  if (i.doneToday) return i.mine ? "DONE_TODAY" : null;
  if (i.mine) return i.created_by === me ? "MY_OWN" : "ASSIGNED_BY_OTHERS";
  if (i.roles.includes("REPORTER") && i.pit_status === "OPEN") return "CREATED_AWAITING";
  return null;
}

export type DueTone = "late" | "today" | "soon" | "later" | "none";
export function dueInfo(due: string | null | undefined, today: string) {
  const d = day(due);
  if (!d) return { tone: "none" as DueTone, n: 0, date: null };
  const n = dayDiff(d, today);
  if (n < 0) return { tone: "late" as DueTone, n: -n, date: d };
  if (n === 0) return { tone: "today" as DueTone, n: 0, date: d };
  if (n <= 7) return { tone: "soon" as DueTone, n, date: d };
  return { tone: "later" as DueTone, n, date: d };
}
export const DUE_TONE_CLASS: Record<DueTone, string> = {
  late: "text-red-600 font-semibold",
  today: "text-orange-600 font-semibold",
  soon: "text-indigo-600 font-semibold",
  later: "text-gray-400",
  none: "text-gray-400",
};

/** 등록·배정일(테넌트 날짜, YYYYMMDD) + 경과일수. */
export function age(iso: string | null | undefined, tz: string) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const ymd = todayYmd(tz, d);
  return { date: ymd.replace(/-/g, ""), days: Math.max(0, dayDiff(todayYmd(tz), ymd)) };
}

const bucketRank = (i: WorkItem, today: string) => {
  const d = day(i.due_date);
  if (i.doneToday) return 4;
  if (!d) return 3;
  return d < today ? 0 : d === today ? 1 : 2;
};
/** 긴급도순: 지연 → 오늘 → 이후 → 마감 없음, 다음 마감일·우선순위. */
export const byUrgency = (today: string) => (a: WorkItem, b: WorkItem) =>
  bucketRank(a, today) - bucketRank(b, today) ||
  day(a.due_date).localeCompare(day(b.due_date)) ||
  a.pit_priority - b.pit_priority ||
  b.created_at.localeCompare(a.created_at);

/** 행 다음 행동 — 내 담당 열림 이슈는 시작. */
export const canStart = (i: WorkItem) => i.mine && !i.doneToday && i.pit_status === "OPEN";
