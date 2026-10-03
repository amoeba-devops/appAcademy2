import { useAuthStore } from "@/stores/auth.store";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiClient } from "@/lib/api-client";
interface History {
  id: string;
  previous: string | null;
  status: string;
  date: string | null;
  site: string | null;
  revision: number;
  source: string;
}
const field = "rounded border bg-white p-2 text-sm";
export function StatusHistoryPanel({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const identity = useAuthStore((s) => `${s.user?.entId}:${s.user?.id}`);
  const { t } = useTranslation("common");
  const tr = (k: string) => t(`payStats.${k}`);
  const qc = useQueryClient();
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [next, setNext] = useState(status),
    [date, setDate] = useState(today),
    [editing, setEditing] = useState<History | null>(null),
    [reason, setReason] = useState("");
  useEffect(() => {
    setNext(status);
  }, [status]);
  const query = useQuery({
    queryKey: ["std", "students", identity, id, "status-history"],
    queryFn: async () =>
      (await apiClient.get<History[]>(`/acm/std/students/${id}/status-history`))
        .data,
  });
  const mutation = useMutation({
    mutationFn: async () => {
      if (editing)
        await apiClient.patch(
          `/acm/std/students/${id}/status-history/${editing.id}`,
          { effectiveDate: date, revision: editing.revision, reason },
        );
      else
        await apiClient.patch(`/acm/std/students/${id}/status`, {
          stdStatus: next,
          effectiveDate: date,
        });
    },
    onSuccess: async () => {
      setEditing(null);
      setReason("");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["std", "students"] }),
        qc.invalidateQueries({ queryKey: ["pay"] }),
      ]);
    },
  });
  return (
    <section
      id="student-status-history"
      tabIndex={-1}
      className="space-y-3 rounded-lg border bg-white p-4"
    >
      <h2 className="font-semibold">{tr("statusHistory")}</h2>
      <p className="text-sm text-secondary">{tr("historyHelp")}</p>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <label className="text-sm">
          {tr("status")}
          <select
            className={field}
            disabled={!!editing}
            value={editing?.status || next}
            onChange={(e) => setNext(e.target.value)}
          >
            {["ACTIVE", "INACTIVE", "WITHDRAWN"].map((s) => (
              <option key={s} value={s}>
                {t(`std:status.${s}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          {tr("effectiveDate")}
          <input
            required
            className={field}
            type="date"
            max={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        {editing && (
          <label className="text-sm">
            {tr("reason")}
            <input
              required
              maxLength={500}
              className={field}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
        )}
        <button
          className={field}
          disabled={mutation.isPending || (!editing && next === status)}
        >
          {tr(editing ? "correct" : "saveStatus")}
        </button>
        {editing && (
          <button
            type="button"
            className={field}
            onClick={() => {
              setEditing(null);
              setDate(today);
            }}
          >
            {tr("cancel")}
          </button>
        )}
      </form>
      {mutation.isError && (
        <p role="alert" className="text-red-700">
          {tr("statusError")}
        </p>
      )}
      {query.isError && <p role="alert">{tr("error")}</p>}
      {query.isPending && <p role="status">{t("status.loading")}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {["status", "effectiveDate", "site", "actions"].map((k) => (
                <th key={k} className="p-2 text-left">
                  {tr(k)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {query.data?.map((h) => (
              <tr key={h.id} className="border-t">
                <td className="p-2">
                  {t(`std:status.${h.status}`)}
                  {h.source === "BASELINE" && ` (${tr("baseline")})`}
                </td>
                <td>{h.date || tr("unknown")}</td>
                <td>{h.site || "—"}</td>
                <td>
                  <button
                    className={field}
                    onClick={() => {
                      setEditing(h);
                      setDate(h.date || today);
                      setReason("");
                    }}
                  >
                    {tr("correct")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
