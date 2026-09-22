import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { Button } from "@/components/ui/button";
import { OperatingResult, OpsCell, OpsMetric } from "../types/operating";
import { downloadCsv, toCsv } from "../lib/export-csv";
export function DualValue({ cell }: { cell?: OpsCell }) {
  const { t } = useTranslation("dsh");
  return (
    <span
      className="whitespace-nowrap"
      aria-label={`${t("ops.calculated")} ${cell?.calculated ?? "—"}${cell?.manualPresent ? ` / ${t("ops.manual")} ${cell.manual}` : ""}`}
    >
      {cell?.calculated?.toLocaleString() ?? "—"}
      {cell?.manualPresent && (
        <span className="text-secondary ml-1">
          ({cell.manual?.toLocaleString()})
        </span>
      )}
      {cell?.quality === "PARTIAL" && <span title={t("ops.partial")}> *</span>}
    </span>
  );
}
export function OperatingPanel({
  data,
  error,
}: {
  data?: OperatingResult;
  error: boolean;
}) {
  const { t } = useTranslation("dsh");
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const admin = user?.role === "ADMIN";
  const [edit, setEdit] = useState(false);
  const [date, setDate] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [metric, setMetric] = useState<OpsMetric>("ops_count_st");
  const manualDateQ = useQuery({
    queryKey: [
      "dsh",
      "operating-manual-date",
      user?.entId,
      user?.id,
      data?.site,
      date,
    ],
    queryFn: async () =>
      (
        await apiClient.get<OperatingResult>("/acm/dsh/operating-range", {
          params: { from: date, to: date, site: data?.site },
        })
      ).data,
    enabled: edit && !!date && !!data,
    refetchOnWindowFocus: false,
  });
  useEffect(() => {
    if (manualDateQ.data)
      setValues(
        Object.fromEntries(
          manualDateQ.data.metrics.map((k) => [
            k,
            String(manualDateQ.data!.rows[0]?.values[k]?.manual ?? ""),
          ]),
        ),
      );
  }, [manualDateQ.data]);
  const save = useMutation({
    mutationFn: () =>
      apiClient.put(`/acm/dsh/operating-manual/${date}`, {
        site: data?.site,
        values: Object.fromEntries(
          Object.entries(values).map(([k, v]) => [
            k,
            v === "" ? null : Number(v),
          ]),
        ),
      }),
    onSuccess: () => {
      setEdit(false);
      qc.invalidateQueries({ queryKey: ["dsh"] });
    },
  });
  const open = () => {
    const d = data?.actualThrough ?? "";
    setDate(d);
    setValues(
      Object.fromEntries(
        (data?.metrics ?? []).map((k) => [
          k,
          String(data?.rows.find((r) => r.date === d)?.values[k]?.manual ?? ""),
        ]),
      ),
    );
    setEdit(true);
    save.reset();
  };
  const changeDate = (d: string) => {
    setDate(d);
    setValues(
      Object.fromEntries(
        (data?.metrics ?? []).map((k) => [
          k,
          String(data?.rows.find((r) => r.date === d)?.values[k]?.manual ?? ""),
        ]),
      ),
    );
  };
  const rows = data?.rows ?? [];
  const finite = rows
    .flatMap((r) => [r.values[metric]?.calculated, r.values[metric]?.manual])
    .filter((n): n is number => typeof n === "number");
  const max = Math.max(1, ...finite);
  const path = (manual: boolean) => {
    let drawing = false;
    return rows
      .map((r, i) => {
        const v = manual
          ? r.values[metric]?.manual
          : r.values[metric]?.calculated;
        if (v == null) {
          drawing = false;
          return "";
        }
        const cmd = drawing ? "L" : "M";
        drawing = true;
        return `${cmd}${((i / Math.max(1, rows.length - 1)) * 280).toFixed(1)},${(60 - (v / max) * 55).toFixed(1)}`;
      })
      .join(" ");
  };
  return (
    <div
      className="min-w-0 rounded-md border border-[var(--border-subtle)] bg-surface p-3"
      data-testid="operating-panel"
    >
      <div className="flex justify-between">
        <strong>{t("category.OPERATING")}</strong>
        {admin && (
          <button
            onClick={open}
            disabled={!data || error}
            className="text-xs underline"
          >
            {t("ops.edit")}
          </button>
        )}
      </div>
      <p className="text-xs text-secondary">{t("ops.legend")}</p>
      {error ? (
        <p role="alert">{t("loadFailed")}</p>
      ) : (
        <table className="w-full text-xs tabular-nums">
          <tbody>
            {data?.metrics.map((k) => (
              <tr key={k}>
                <td className="py-1">{t(`ops.${k}`)}</td>
                <td className="text-right">
                  <DualValue cell={data.summary[k]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {data && !error && (
        <>
          <select
            aria-label={t("ops.graph")}
            className="text-xs max-w-full"
            value={metric}
            onChange={(e) => setMetric(e.target.value as OpsMetric)}
          >
            {data.metrics.map((k) => (
              <option key={k} value={k}>
                {t(`ops.${k}`)}
              </option>
            ))}
          </select>
          <svg
            viewBox="0 0 280 64"
            role="img"
            aria-label={t("ops.graph")}
            className="w-full h-16"
          >
            <path
              d={path(false)}
              fill="none"
              stroke="#9333ea"
              strokeWidth="1.5"
            />
            <path
              d={path(true)}
              fill="none"
              stroke="#64748b"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            {rows.map((r, i) =>
              r.values[metric]?.manual != null ? (
                <circle
                  key={r.date}
                  cx={(i / Math.max(1, rows.length - 1)) * 280}
                  cy={60 - (r.values[metric]!.manual! / max) * 55}
                  r="1.5"
                  fill="#64748b"
                />
              ) : null,
            )}
          </svg>
          <p className="text-[10px] text-secondary">
            {t("ops.through", { date: data.actualThrough })}
          </p>
          {(data.quality.unverifiedManual > 0 ||
            data.quality.unclassified > 0 ||
            data.quality.unresolved > 0 ||
            data.quality.missingTeachers > 0 || data.quality.missingAdmissions > 0) && (
            <details className="text-xs">
              <summary>{t("ops.check")}</summary>
              {t("ops.quality", data.quality)}
              <p>{t("ops.missingAdmissions", {count: data.quality.missingAdmissions})}</p>
              <p>
                {t("ops.unverified", { count: data.quality.unverifiedManual })}
              </p>
            </details>
          )}
          <button
            className="text-xs underline"
            onClick={() => {
              const header = [
                "date",
                "site",
                ...data.metrics.flatMap((k) => [
                  `${k}:calculated`,
                  `${k}:manual`,
                  `${k}:manualPresent`,
                  `${k}:quality`,
                ]),
              ];
              downloadCsv(
                `operating-${data.site}.csv`,
                toCsv([
                  header,
                  ...rows.map((r) => [
                    r.date,
                    data.site,
                    ...data.metrics.flatMap((k) => {
                      const c = r.values[k]!;
                      return [
                        c.calculated,
                        c.manual,
                        c.manualPresent ? "true" : "false",
                        c.quality,
                      ];
                    }),
                  ]),
                ]),
              );
            }}
          >
            {t("ops.csv")}
          </button>
        </>
      )}
      {edit && (
        <div className="mt-3 border-t pt-2">
          <label className="text-xs">
            {t("ops.date")}
            <input
              type="date"
              value={date}
              onChange={(e) => changeDate(e.target.value)}
            />
          </label>
          <p className="text-xs">
            {data?.site} · {t("ops.clearHint")}
          </p>
          {data?.metrics.map((k) => (
            <label key={k} className="block text-xs">
              {t(`ops.${k}`)}
              <input
                className="w-20 border rounded ml-2"
                type="number"
                min="0"
                step="1"
                value={values[k] ?? ""}
                onChange={(e) => setValues({ ...values, [k]: e.target.value })}
              />
            </label>
          ))}
          {save.isError && <p role="alert">{t("loadFailed")}</p>}
          <Button
            disabled={
              save.isPending ||
              !date ||
              manualDateQ.isFetching ||
              manualDateQ.isError
            }
            onClick={() => save.mutate()}
          >
            {t("ops.save")}
          </Button>
          <button onClick={() => setEdit(false)}>{t("ops.close")}</button>
        </div>
      )}
    </div>
  );
}
export function OperatingTable({ data }: { data: OperatingResult }) {
  const { t } = useTranslation("dsh");
  return (
    <div className="overflow-x-auto bg-surface border rounded">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th>{t("ops.date")}</th>
            {data.metrics.map((k) => (
              <th key={k}>{t(`ops.${k}`)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r) => (
            <tr key={r.date}>
              <td>{r.date}</td>
              {data.metrics.map((k) => (
                <td className="text-right px-2" key={k}>
                  <DualValue cell={r.values[k]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
