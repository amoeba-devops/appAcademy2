import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { errorText } from "../../project-page";
import { issueBase } from "../issue-model";
import type { WorkItem } from "./work-display";

/** 결과 안내 (AMA ActionResultModal). 성공은 3초 뒤 자동 닫힘. */
export function ActionResultModal({
  result,
  onClose,
}: {
  result: { ok: boolean; title: string; message: string } | null;
  onClose: () => void;
}) {
  const { t } = useTranslation("common");
  useEffect(() => {
    if (!result?.ok) return;
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [result, onClose]);
  if (!result) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4">
      <div role="alertdialog" aria-label={result.title} className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-3 flex items-center gap-2 text-gray-900">
          {result.ok ? (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-500" />
          )}
          <h3 className="text-base font-semibold">{result.title}</h3>
        </div>
        <p className="max-h-[60vh] overflow-y-auto whitespace-pre-line text-sm text-gray-600">{result.message}</p>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            {t("myWork.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

export const MAX_BULK_COMPLETE = 50;
const DONE_STATUSES = ["DONE", "REJECTED"] as const;
export interface CompleteResult {
  okIds: string[];
  failed: { item: WorkItem; reason: string }[];
}

/**
 * 완료 확인 (AMA CompleteConfirmModal) — 행 ○ · 상세 · 하단 바 공통.
 * 항목별 상태 API 를 순차 호출해 서버 전이 규칙을 그대로 따른다.
 */
export function CompleteConfirmModal({
  targets,
  onClose,
  onFinished,
}: {
  targets: WorkItem[];
  onClose: () => void;
  onFinished: (r: CompleteResult) => void;
}) {
  const { t } = useTranslation("common");
  const [status, setStatus] = useState<(typeof DONE_STATUSES)[number]>("DONE");
  const [progress, setProgress] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    confirmRef.current?.focus();
    return () => opener?.focus?.();
  }, []);
  const running = progress !== null;
  const tooMany = targets.length > MAX_BULK_COMPLETE;
  const single = targets.length === 1;
  const title = single
    ? t("myWork.complete.titleIssueOne")
    : t("myWork.complete.titleMany", { count: targets.length });

  const run = async () => {
    const okIds: string[] = [];
    const failed: CompleteResult["failed"] = [];
    for (let n = 0; n < targets.length; n += 1) {
      setProgress(n);
      try {
        await apiClient.patch(`${issueBase}/issues/${targets[n].pit_id}/status`, { status });
        okIds.push(targets[n].pit_id);
      } catch (err) {
        failed.push({ item: targets[n], reason: errorText(err) });
      }
    }
    setProgress(null);
    onFinished({ okIds, failed });
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape" && !running) {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab" || !dialogRef.current) return;
    const nodes = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled])"),
    );
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={running ? undefined : onClose}
    >
      <div
        ref={dialogRef}
        className="w-[min(92vw,26rem)] rounded-xl bg-white p-4 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={onKeyDown}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto text-xs text-gray-700">
          {targets.map((x) => (
            <li key={x.pit_id} className="flex items-center gap-1.5">
              <span className="rounded bg-rose-50 px-1 text-[10px] font-semibold text-rose-600">
                {t("myWork.type.ISSUE")}
              </span>
              <span className="truncate">{x.pit_title}</span>
              <span className="shrink-0 text-gray-400">({t(`issues.status.${x.pit_status}`)})</span>
            </li>
          ))}
        </ul>
        <fieldset className="mt-3" disabled={running}>
          <legend className="text-xs font-medium text-gray-700">{t("myWork.complete.issueStatus")}</legend>
          <div className="mt-1 flex flex-wrap gap-3">
            {DONE_STATUSES.map((s) => (
              <label key={s} className="flex items-center gap-1 text-xs text-gray-700">
                <input
                  type="radio"
                  name="issue-done-status"
                  value={s}
                  checked={status === s}
                  onChange={() => setStatus(s)}
                />
                {t(`issues.status.${s}`)}
              </label>
            ))}
          </div>
          {!single && <p className="mt-1.5 text-[11px] text-gray-500">{t("myWork.complete.skipNote")}</p>}
        </fieldset>
        {tooMany && (
          <p className="mt-2 text-xs text-red-600">{t("myWork.complete.tooMany", { max: MAX_BULK_COMPLETE })}</p>
        )}
        <div className="mt-4 flex items-center justify-end gap-2">
          {running && (
            <span className="mr-auto inline-flex items-center gap-1 text-xs text-gray-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t("myWork.complete.running", { done: (progress ?? 0) + 1, total: targets.length })}
            </span>
          )}
          <button
            type="button"
            disabled={running}
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-50"
          >
            {t("myWork.complete.cancel")}
          </button>
          <button
            ref={confirmRef}
            type="button"
            disabled={running || tooMany || !targets.length}
            onClick={() => void run()}
            className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {single ? t("myWork.complete.confirm") : t("myWork.complete.confirmMany", { count: targets.length })}
          </button>
        </div>
      </div>
    </div>
  );
}
