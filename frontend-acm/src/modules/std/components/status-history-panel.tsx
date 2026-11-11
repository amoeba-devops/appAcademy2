import { useAuthStore } from "@/stores/auth.store";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
interface History {
  id: string;
  previous: string | null;
  status: string;
  date: string | null;
  site: string | null;
  revision: number;
  source: string;
}
// REQ-261112E — 공용 입력칸 기준
const field = "admin-field";
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
    <Section
      id="student-status-history"
      tabIndex={-1}
      title={tr("statusHistory")}
      description={tr("historyHelp")}
      bodyClassName="space-y-3 p-4 sm:p-5"
    >
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <label>
          <span className="admin-field-label">{tr("status")}</span>
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
        <label>
          <span className="admin-field-label">{tr("effectiveDate")}</span>
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
          <label>
            <span className="admin-field-label">{tr("reason")}</span>
            <input
              required
              maxLength={500}
              className={field}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
        )}
        <Button
          type="submit"
          disabled={mutation.isPending || (!editing && next === status)}
        >
          {tr(editing ? "correct" : "saveStatus")}
        </Button>
        {editing && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setEditing(null);
              setDate(today);
            }}
          >
            {tr("cancel")}
          </Button>
        )}
      </form>
      {mutation.isError && (
        <p role="alert" className="text-sm text-red-700">
          {tr("statusError")}
        </p>
      )}
      {query.isError && <p role="alert">{tr("error")}</p>}
      {query.isPending && <p role="status">{t("status.loading")}</p>}
      <div className="overflow-x-auto rounded-md border border-[var(--border-subtle)]">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {["status", "effectiveDate", "site", "actions"].map((k) => (
                <th key={k} className="px-3 py-2 text-left">
                  {tr(k)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {query.data?.map((h) => (
              <tr key={h.id} className="border-t border-[var(--border-subtle)]">
                <td className="px-3 py-2">
                  {t(`std:status.${h.status}`)}
                  {h.source === "BASELINE" && ` (${tr("baseline")})`}
                </td>
                <td className="px-3 py-2">{h.date || tr("unknown")}</td>
                <td className="px-3 py-2">{h.site || "—"}</td>
                <td className="px-3 py-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditing(h);
                      setDate(h.date || today);
                      setReason("");
                    }}
                  >
                    {tr("correct")}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
