import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { Button } from "@/components/ui/button";
import type {
  DshSite,
  VisitorComparisonResult,
  VisitorObservation,
} from "../types/visitor-comparison";

const sites: DshSite[] = ["TPI", "TRINITY", "SANTACROCE"];
const siteLabel = { TPI: "TPI", TRINITY: "TA", SANTACROCE: "SC" };
const number = (value: number | null | undefined) =>
  value == null ? "—" : value.toLocaleString();
const inputClass =
  "w-full rounded border border-gray-300 bg-white p-2 text-sm placeholder:italic placeholder:text-gray-400";

function ImwebForm({
  original,
  date,
  site,
  close,
  reload,
}: {
  original: VisitorObservation | null;
  date: string;
  site: DshSite;
  close: () => void;
  reload: () => void;
}) {
  const { t } = useTranslation("dsh");
  const qc = useQueryClient();
  const [value, setValue] = useState(
    original?.value == null ? "" : String(original.value),
  );
  const [note, setNote] = useState(original?.note ?? "");
  const [timezone, setTimezone] = useState(original?.timezone ?? "Asia/Seoul");
  const save = useMutation({
    mutationFn: () =>
      apiClient.put(`/acm/dsh/visitor-imweb/${date}`, {
        site,
        value: value === "" ? null : Number(value),
        note,
        timezone,
        revision: original?.revision ?? 0,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["dsh", "visitors"] });
      close();
    },
  });
  return (
    <form
      className="space-y-3 rounded border bg-gray-50 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <p className="font-semibold">
        {t("visitors.edit")} · {date} · {siteLabel[site]}
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          {t("visitors.imweb")}
          <input
            className={inputClass}
            type="number"
            min={0}
            max={2147483647}
            step={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t("visitors.emptyHint")}
          />
        </label>
        <label className="text-sm">
          {t("visitors.timezone")}
          <input
            className={inputClass}
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            maxLength={80}
            required
          />
        </label>
        <label className="text-sm">
          {t("visitors.note")}
          <input
            className={inputClass}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            required
            placeholder={t("visitors.noteHint")}
          />
        </label>
      </div>
      <p className="text-xs text-gray-500">{t("visitors.saveNote")}</p>
      {save.isError && (
        <p role="alert" className="text-sm text-red-600">
          {t("visitors.saveError")}{" "}
          <button type="button" className="underline" onClick={reload}>
            {t("visitors.reload")}
          </button>
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={save.isPending}>
          {t("visitors.save")}
        </Button>
        <Button
          variant="outline"
          type="button"
          disabled={save.isPending}
          onClick={close}
        >
          {t("visitors.cancel")}
        </Button>
      </div>
    </form>
  );
}

interface HistoryRow {
  id: string;
  createdAt: string;
  before: { vob_value: number | null } | null;
  after: {
    vob_source: string;
    vob_metric: string;
    vob_timezone: string;
    vob_value: number | null;
    vob_note: string;
  };
}
export function VisitorComparisonPanel({
  from,
  to,
  site,
}: {
  from: string;
  to: string;
  site: string;
}) {
  const { t } = useTranslation("dsh");
  const user = useAuthStore((s) => s.user);
  const admin = user?.role === "ADMIN";
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<{ date: string; site: DshSite } | null>(
    null,
  );
  const [history, setHistory] = useState<{
    date: string;
    site: DshSite;
  } | null>(null);
  const [formVersion, setFormVersion] = useState(0);
  const scope = [user?.entId, user?.id];
  const q = useQuery({
    queryKey: ["dsh", "visitors", "range", ...scope, from, to, site],
    queryFn: async () =>
      (
        await apiClient.get<VisitorComparisonResult>(
          "/acm/dsh/visitor-comparison",
          { params: { from, to, site } },
        )
      ).data,
    enabled: open && !!from && !!to && from <= to,
  });
  const editQ = useQuery({
    queryKey: ["dsh", "visitors", "edit", ...scope, edit?.date, edit?.site],
    queryFn: async () =>
      (
        await apiClient.get<VisitorComparisonResult>(
          "/acm/dsh/visitor-comparison",
          { params: { from: edit!.date, to: edit!.date, site: edit!.site } },
        )
      ).data,
    enabled: admin && !!edit,
    refetchOnWindowFocus: false,
  });
  const historyQ = useQuery({
    queryKey: [
      "dsh",
      "visitors",
      "history",
      ...scope,
      history?.date,
      history?.site,
    ],
    queryFn: async () =>
      (
        await apiClient.get<{ rows: HistoryRow[] }>(
          `/acm/dsh/visitor-history/${history!.date}`,
          { params: { site: history!.site } },
        )
      ).data,
    enabled: admin && !!history,
  });
  const metricLabel = (o: VisitorObservation | null) =>
    o ? t(`visitors.metrics.${o.metric}`, { defaultValue: o.metric }) : "—";
  return (
    <section
      className="mb-4 rounded-md border border-gray-200 bg-white p-4"
      data-testid="visitor-comparison"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls="visitor-comparison-body"
        className="w-full text-left font-bold"
        onClick={() => setOpen(!open)}
      >
        {open ? "▾" : "▸"} {t("visitors.title")}
      </button>
      {open && (
        <div id="visitor-comparison-body" className="mt-3 space-y-3">
          <p className="text-xs text-gray-500">{t("visitors.description")}</p>
          <p className="text-xs text-gray-500">{t("visitors.conditions")}</p>
          {admin && (
            <Button
              variant="outline"
              onClick={() =>
                setEdit({
                  date: from,
                  site: sites.includes(site as DshSite)
                    ? (site as DshSite)
                    : "TPI",
                })
              }
            >
              {t("visitors.edit")}
            </Button>
          )}
          {edit && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <label className="text-sm">
                  {t("visitors.date")}
                  <input
                    type="date"
                    className={inputClass}
                    value={edit.date}
                    onChange={(e) => {
                      if (e.target.value)
                        setEdit({ ...edit, date: e.target.value });
                    }}
                  />
                </label>
                <label className="text-sm">
                  {t("visitors.site")}
                  <select
                    className={inputClass}
                    value={edit.site}
                    onChange={(e) =>
                      setEdit({ ...edit, site: e.target.value as DshSite })
                    }
                  >
                    {sites.map((s) => (
                      <option key={s} value={s}>
                        {siteLabel[s]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {editQ.isPending ? (
                <p>{t("visitors.loading")}</p>
              ) : editQ.isError ? (
                <p role="alert">{t("visitors.loadError")}</p>
              ) : (
                editQ.data && (
                  <ImwebForm
                    key={`${edit.date}:${edit.site}:${formVersion}`}
                    original={editQ.data.rows[0]?.imweb ?? null}
                    date={edit.date}
                    site={edit.site}
                    close={() => setEdit(null)}
                    reload={async () => {
                      await editQ.refetch();
                      setFormVersion((v) => v + 1);
                    }}
                  />
                )
              )}
            </div>
          )}
          {q.isLoading && <p>{t("visitors.loading")}</p>}
          {q.isError && (
            <p role="alert" className="text-red-600">
              {t("visitors.loadError")}
            </p>
          )}
          {q.data && (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                {(["imweb", "ga4"] as const).map((source) => {
                  const c = q.data.summary[source];
                  return (
                    <div
                      key={source}
                      className="rounded bg-gray-50 p-3 text-sm"
                    >
                      <strong>
                        {t(`visitors.${source}`)}: {number(c.value)}
                      </strong>
                      <span className="ml-2 text-gray-500">
                        {t("visitors.coverage", {
                          observed: c.observed,
                          expected: c.expected,
                        })}
                      </span>
                      {c.mixedDefinition ? (
                        <p>{t("visitors.mixed")}</p>
                      ) : (
                        c.value === null &&
                        c.observedSum !== null && (
                          <p>
                            {t("visitors.partial", {
                              value: number(c.observedSum),
                            })}
                          </p>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="max-h-96 overflow-auto rounded border border-gray-200">
                <table className="w-full whitespace-nowrap text-xs tabular-nums">
                  <thead className="sticky top-0 bg-gray-100">
                    <tr>
                      {[
                        "date",
                        "site",
                        "imweb",
                        "ga4",
                        "metric",
                        "difference",
                        "percent",
                        ...(admin ? ["actions"] : []),
                      ].map((k) => (
                        <th key={k} className="p-2 text-left">
                          {t(`visitors.${k}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {q.data.rows.map((r) => (
                      <tr
                        key={`${r.date}:${r.site}`}
                        className="border-t bg-white"
                      >
                        <td className="p-2">{r.date}</td>
                        <td className="p-2">{siteLabel[r.site]}</td>
                        <td
                          className="p-2"
                          title={
                            r.imweb
                              ? `${r.imweb.note} · ${r.imweb.timezone}`
                              : ""
                          }
                        >
                          {r.imweb?.value == null
                            ? t("visitors.missing")
                            : number(r.imweb.value)}
                        </td>
                        <td
                          className="p-2"
                          title={
                            r.ga4
                              ? `${metricLabel(r.ga4)} · ${r.ga4.timezone} · ${r.ga4.updatedAt}`
                              : ""
                          }
                        >
                          {r.ga4?.value == null
                            ? t("visitors.missing")
                            : number(r.ga4.value)}
                        </td>
                        <td className="p-2">{metricLabel(r.ga4)}</td>
                        <td className="p-2">{number(r.difference)}</td>
                        <td className="p-2">
                          {r.differencePercent == null
                            ? "—"
                            : `${r.differencePercent.toFixed(1)}%`}
                        </td>
                        {admin && (
                          <td className="p-2">
                            <button
                              type="button"
                              className="mr-3 underline"
                              onClick={() =>
                                setEdit({ date: r.date, site: r.site })
                              }
                            >
                              {t("visitors.edit")}
                            </button>
                            <button
                              type="button"
                              className="underline"
                              onClick={() =>
                                setHistory({ date: r.date, site: r.site })
                              }
                            >
                              {t("visitors.history")}
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {history && (
            <div className="rounded border p-3">
              <div className="flex items-center justify-between">
                <strong>
                  {t("visitors.history")} · {history.date} ·{" "}
                  {siteLabel[history.site]}
                </strong>
                <button type="button" onClick={() => setHistory(null)}>
                  {t("visitors.close")}
                </button>
              </div>
              <p className="text-xs text-gray-500">
                {t("visitors.historyHint")}
              </p>
              {historyQ.isLoading && <p>{t("visitors.loading")}</p>}
              {historyQ.isError && (
                <p role="alert">{t("visitors.loadError")}</p>
              )}
              <ul className="max-h-60 overflow-auto text-xs">
                {historyQ.data?.rows.map((r) => (
                  <li key={r.id} className="border-t py-2 break-words">
                    {r.createdAt} · {r.after.vob_source} · {r.after.vob_metric}{" "}
                    · {number(r.before?.vob_value)} →{" "}
                    {number(r.after.vob_value)} · {r.after.vob_timezone} ·{" "}
                    {r.after.vob_note}
                  </li>
                ))}
              </ul>
              {historyQ.data?.rows.length === 0 && (
                <p>{t("visitors.noHistory")}</p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
