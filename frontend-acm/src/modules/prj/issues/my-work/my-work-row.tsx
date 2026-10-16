import { useTranslation } from "react-i18next";
import { Check, Link2, Loader2 } from "lucide-react";
import { refLabel } from "../issue-model";
import {
  age,
  canStart,
  dueInfo,
  DUE_TONE_CLASS,
  REASON_CLASS,
  type WorkItem,
} from "./work-display";

/** 마감 D-day 표기 (AMA DueTag). */
export function DueTag({
  due,
  today,
  className = "",
}: {
  due: string | null | undefined;
  today: string;
  className?: string;
}) {
  const { t } = useTranslation("common");
  const info = dueInfo(due, today);
  const label =
    info.tone === "none"
      ? t("myWork.due.none")
      : info.tone === "late"
        ? t("myWork.due.late", { n: info.n })
        : info.tone === "today"
          ? t("myWork.due.today")
          : info.tone === "soon"
            ? t("myWork.due.soon", { n: info.n })
            : info.date!.slice(5).replace("-", "/");
  return (
    <span
      className={`min-w-[52px] shrink-0 text-right font-mono text-[11.5px] ${DUE_TONE_CLASS[info.tone]} ${className}`}
      title={info.date ?? undefined}
    >
      {label}
    </span>
  );
}

/**
 * 내 업무 행 (AMA MyWorkRow) — 담당 이슈: 좌측 indigo 띠 + 굵은 제목 + ‘담당’ 배지,
 * 관여 업무: 흐린 스타일.
 */
export function MyWorkRow({
  item,
  tz,
  today,
  selectable,
  picked,
  selected,
  muted,
  busy,
  showReasons,
  showAssignee,
  onTogglePick,
  onComplete,
  onStart,
  onSelect,
  onOpenIssue,
}: {
  item: WorkItem;
  tz: string;
  today: string;
  selectable?: boolean;
  picked?: boolean;
  selected?: boolean;
  muted?: boolean;
  busy?: boolean;
  showReasons?: boolean;
  showAssignee?: boolean;
  onTogglePick?: (i: WorkItem) => void;
  onComplete?: (i: WorkItem) => void;
  onStart?: (i: WorkItem) => void;
  onSelect: (i: WorkItem) => void;
  onOpenIssue: (id: string) => void;
}) {
  const { t } = useTranslation("common");
  const done = item.doneToday;
  const mineIssue = !muted && item.mine;
  const otherRoles = item.roles.filter((r) => r !== "ASSIGNEE");
  const assigned = item.mine ? age(item.assigned_at, tz) : null;
  const shown = assigned ?? age(item.created_at, tz);
  const reasons = showReasons ? item.reasons : [];
  const start = !muted && onStart && canStart(item);
  const ref = refLabel(item.pit_ref_no);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(item)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onSelect(item);
        if ((e.key === "x" || e.key === "X") && selectable) onTogglePick?.(item);
      }}
      className={`relative flex cursor-pointer items-center gap-2.5 border-b border-gray-100 px-3 py-2 last:border-b-0 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
        selected || picked ? "bg-indigo-50/70" : "bg-white"
      }`}
    >
      {mineIssue && <span className="absolute inset-y-0 left-0 w-1 bg-indigo-600" aria-hidden />}

      {selectable && (
        <button
          type="button"
          disabled={done}
          aria-pressed={!!picked}
          title={t("myWork.pick")}
          aria-label={t("myWork.pick")}
          onClick={(e) => {
            e.stopPropagation();
            onTogglePick?.(item);
          }}
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
            picked
              ? "border-indigo-600 bg-indigo-600 text-white"
              : "border-gray-300 bg-white hover:border-indigo-400 disabled:opacity-40"
          }`}
        >
          {picked && <Check className="h-3 w-3" />}
        </button>
      )}

      <button
        type="button"
        disabled={done || busy || !onComplete}
        aria-label={t("myWork.action.complete")}
        onClick={(e) => {
          e.stopPropagation();
          onComplete?.(item);
        }}
        className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border ${
          done
            ? "border-green-500 bg-green-500 text-white"
            : "border-gray-300 text-transparent hover:border-green-500 hover:text-green-500"
        }`}
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin text-gray-400" /> : <Check className="h-3 w-3" />}
      </button>

      <span
        className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded bg-rose-50 text-[10px] font-semibold text-rose-600"
        title={t("myWork.type.ISSUE")}
      >
        {t("myWork.type.ISSUE").slice(0, 1)}
      </span>

      <div className="min-w-0 flex-1">
        <div
          className={`flex items-center gap-1.5 truncate text-[13.5px] ${
            mineIssue ? "font-semibold text-gray-900" : muted ? "text-gray-600" : "font-medium text-gray-800"
          } ${done ? "text-gray-400 line-through" : ""}`}
        >
          {item.pit_priority <= 2 && (
            <span
              className={`font-mono text-[10.5px] font-semibold ${item.pit_priority === 1 ? "text-red-600" : "text-orange-500"}`}
            >
              P{item.pit_priority}
            </span>
          )}
          {ref && <span className="font-mono text-[11px] font-normal text-gray-400">{ref}</span>}
          <span className="truncate">{item.pit_title}</span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-gray-500">
          {mineIssue && (
            <span className="rounded-full bg-indigo-600 px-1.5 text-[10.5px] font-semibold text-white">
              {t("myWork.badge")}
            </span>
          )}
          {reasons.map((r) => (
            <span key={r} className={`rounded-full border px-1.5 text-[10.5px] font-semibold ${REASON_CLASS[r]}`}>
              {t(`myWork.reason.${r}`)}
            </span>
          ))}
          <span className="truncate">{item.prj_title || t("myWork.noProject")}</span>
          <span>{t(`issues.status.${item.pit_status}`)}</span>
          {showAssignee && (
            <span className="text-gray-600">
              {item.assignee_name?.trim()
                ? t("myWork.assigneeLine", { name: item.assignee_name.trim() })
                : t("myWork.noAssignee")}
            </span>
          )}
          {muted && otherRoles.length > 0 && <span>{otherRoles.map((r) => t(`myWork.role.${r}`)).join(" · ")}</span>}
          {item.pit_parent_id && (
            <span
              role="link"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onOpenIssue(item.pit_parent_id!);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.stopPropagation();
                  onOpenIssue(item.pit_parent_id!);
                }
              }}
              className="inline-flex max-w-[16rem] items-center gap-0.5 truncate text-indigo-500 hover:underline"
            >
              <Link2 className="h-3 w-3 shrink-0" />
              <span className="truncate">{item.parent_title || refLabel(item.parent_ref_no)}</span>
            </span>
          )}
        </div>
      </div>

      {shown && (
        <span
          className={`shrink-0 whitespace-nowrap font-mono text-[11px] ${assigned ? "text-indigo-500" : "text-gray-400"}`}
          title={t(assigned ? "myWork.assignedAgeTitle" : "myWork.createdAgeTitle")}
        >
          <span className="hidden sm:inline">
            {t(assigned ? "myWork.assignedAge" : "myWork.createdAge", { date: shown.date, days: shown.days })}
          </span>
          <span className="sm:hidden">{t("myWork.days", { n: shown.days })}</span>
        </span>
      )}
      <DueTag due={item.due_date} today={today} />
      {start && (
        <button
          type="button"
          disabled={busy}
          onClick={(e) => {
            e.stopPropagation();
            onStart?.(item);
          }}
          className="shrink-0 rounded-md border border-indigo-300 px-2 py-0.5 text-[11.5px] font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
        >
          {t("myWork.action.START")}
        </button>
      )}
    </div>
  );
}
