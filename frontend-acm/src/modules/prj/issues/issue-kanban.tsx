import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { clsx } from "clsx";
import { day, PRIORITY_BADGE, refLabel, TRANSITIONS, type Issue, type IssueStatus } from "./issue-model";

const KANBAN: IssueStatus[] = ["OPEN", "IN_PROGRESS", "DONE"];

type KanbanIssue = Pick<
  Issue,
  "pit_id" | "pit_ref_no" | "pit_title" | "pit_status" | "pit_issue_type" | "pit_priority" | "assignee_name" | "due_date"
> & { prj_title?: string };

/**
 * 열림/진행/완료 3열. 허용된 전이로만 드래그(또는 카드의 상태 버튼)로 이동한다.
 * REQ-261016D — 전체 이슈 화면과 프로젝트 이슈 탭이 함께 쓴다.
 */
export function IssueKanban({
  items,
  onMove,
  readOnly = false,
  showProject = true,
}: {
  items: KanbanIssue[];
  onMove: (id: string, status: IssueStatus) => void;
  readOnly?: boolean;
  showProject?: boolean;
}) {
  const { t } = useTranslation("common");
  const [dragging, setDragging] = useState<KanbanIssue | null>(null);
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {KANBAN.map((col) => {
        const allowed = !readOnly && !!dragging && TRANSITIONS[dragging.pit_status].includes(col);
        return (
          <section
            key={col}
            aria-label={t(`issues.status.${col}`)}
            onDragOver={(e) => {
              if (allowed) e.preventDefault();
            }}
            onDrop={() => {
              if (dragging && allowed) onMove(dragging.pit_id, col);
              setDragging(null);
            }}
            className={clsx(
              "min-h-40 rounded-lg border bg-[var(--gray-50)] p-2",
              allowed && "border-accent-400 bg-accent-50/40",
            )}
          >
            <h2 className="mb-2 flex items-center justify-between px-1 text-sm font-semibold">
              {t(`issues.status.${col}`)}
              <span className="text-xs text-secondary">{items.filter((i) => i.pit_status === col).length}</span>
            </h2>
            <div className="grid gap-2">
              {items
                .filter((i) => i.pit_status === col)
                .map((i) => (
                  <article
                    key={i.pit_id}
                    draggable={!readOnly}
                    onDragStart={() => setDragging(i)}
                    onDragEnd={() => setDragging(null)}
                    className="grid gap-1 rounded border bg-surface p-2 text-sm shadow-sm"
                  >
                    <Link to={`/admin/issues/${i.pit_id}`} className="font-medium hover:underline">
                      {i.pit_ref_no && (
                        <span className="mr-1.5 font-mono text-xs font-normal text-gray-400">{refLabel(i.pit_ref_no)}</span>
                      )}
                      {i.pit_title}
                    </Link>
                    <p className="truncate text-xs text-secondary">
                      {t(`issues.type.${i.pit_issue_type}`)}
                      {showProject && i.prj_title ? ` · ${i.prj_title}` : ""}
                    </p>
                    <p className="flex flex-wrap items-center gap-x-2 text-xs">
                      <span className={PRIORITY_BADGE[i.pit_priority]}>{t(`issues.priority.${i.pit_priority}`)}</span>
                      <span>{i.assignee_name ?? t("issues.unassigned")}</span>
                      {i.due_date && <span>~{day(i.due_date)}</span>}
                    </p>
                    {!readOnly && (
                      <div className="flex flex-wrap gap-1">
                        {TRANSITIONS[i.pit_status]
                          .filter((s) => KANBAN.includes(s))
                          .map((s) => (
                            <button
                              key={s}
                              type="button"
                              className="rounded border px-1.5 text-xs text-secondary hover:bg-[var(--gray-100)]"
                              onClick={() => onMove(i.pit_id, s)}
                            >
                              → {t(`issues.status.${s}`)}
                            </button>
                          ))}
                      </div>
                    )}
                  </article>
                ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
