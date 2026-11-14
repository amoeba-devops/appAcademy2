import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { RotateCcw, Trash2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { MonthlyStudentRow } from "./monthly-types";
import { payErrorCode } from "./bill-import";

const base = "/acm/pay/bills/monthly";

/**
 * REQ-261114 — 월별 납부 목록 맨 오른쪽 메모 칸. 학생별·월별로 저장되며
 * 입력 칸을 벗어나거나 Enter 를 누르면 저장한다(청구서 메모와 별개).
 */
export function MonthNoteCell({
  row,
  month,
  identity,
}: {
  row: MonthlyStudentRow;
  month: string;
  identity: string;
}) {
  const { t } = useTranslation("common");
  const qc = useQueryClient();
  const saved = row.note ?? "";
  const [text, setText] = useState(saved);
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  useEffect(() => setText(saved), [saved]);
  const save = async () => {
    if (text.trim() === saved.trim() || state === "saving") return;
    setState("saving");
    try {
      await apiClient.patch(`${base}/${row.id}/note`, { month, memo: text });
      setState("idle");
      await qc.invalidateQueries({ queryKey: ["pay", identity, "monthly"] });
    } catch {
      setState("error");
    }
  };
  return (
    <input
      className={`min-h-9 w-48 rounded border bg-white px-2 py-1 text-base md:text-sm ${state === "error" ? "border-red-400" : "border-slate-300"}`}
      aria-label={`${t("payMonthly.col.note")} ${row.name}`}
      placeholder={t("payMonthly.notePlaceholder")}
      title={state === "error" ? t("pay.failed") : text}
      maxLength={500}
      value={text}
      disabled={state === "saving"}
      onChange={(e) => setText(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") setText(saved);
      }}
    />
  );
}

/**
 * REQ-261114 — 그 달 목록에서 제외(삭제)하거나, '제외된 학생 보기'에서 복구한다.
 * 그 달 청구가 있으면 서버가 거절(PAY_MONTH_HAS_BILLS)한다.
 */
export function MonthExcludeButton({
  row,
  month,
  identity,
  restore,
}: {
  row: MonthlyStudentRow;
  month: string;
  identity: string;
  restore: boolean;
}) {
  const { t } = useTranslation("common");
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const m = Number(month.slice(5));
  const run = async () => {
    if (
      !restore &&
      !window.confirm(t("payMonthly.excludeConfirm", { name: row.name, m }))
    )
      return;
    setBusy(true);
    setError("");
    try {
      await apiClient.patch(`${base}/${row.id}/excluded`, {
        month,
        excluded: !restore,
      });
      await qc.invalidateQueries({ queryKey: ["pay", identity, "monthly"] });
    } catch (e) {
      const code = payErrorCode(e);
      setError(t(`pay.${code ?? "failed"}`, { defaultValue: t("pay.failed") }));
    } finally {
      setBusy(false);
    }
  };
  const label = restore
    ? t("payMonthly.restore")
    : t("payMonthly.exclude", { m });
  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        className="inline-flex min-h-9 items-center gap-1 rounded border border-slate-300 bg-white px-2 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50"
        aria-label={`${label} ${row.name}`}
        title={label}
        disabled={busy}
        onClick={run}
      >
        {restore ? (
          <>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            {label}
          </>
        ) : (
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        )}
      </button>
      {error && (
        <span
          role="alert"
          className="mt-1 max-w-48 whitespace-normal text-xs text-red-600"
        >
          {error}
        </span>
      )}
    </span>
  );
}
