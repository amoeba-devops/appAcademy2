import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { apiClient } from "@/lib/api-client";
import type { MonthlyPaymentResult, MonthlyStudentRow } from "./monthly-types";
const field = "rounded border bg-white px-3 py-2 text-sm";
export const monthlySites = [
  "ALL",
  "TPI",
  "TRINITY",
  "SANTACROCE",
  "UNASSIGNED",
];
export function MonthlyPaymentView({
  identity,
  month,
  site,
  dashboard,
  onFilter,
  onDetail,
  onCreate,
  onList,
  onEdit,
}: {
  identity: string;
  month: string;
  site: string;
  dashboard: boolean;
  onFilter: (month: string, site: string) => void;
  onList: () => void;
  onEdit: (id: string) => void;
  onDetail: (id: string) => void;
  onCreate: (student: MonthlyStudentRow) => void;
}) {
  const { t } = useTranslation("common");
  const tr = (key: string) => t(`payMonthly.${key}`);
  const [scope, setScope] = useState("ENROLLED"),
    [status, setStatus] = useState(""),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [downloadError, setDownloadError] = useState(false);
  const params = {
    month,
    site,
    scope,
    status: (!dashboard && status) || undefined,
    q: (!dashboard && search) || undefined,
    page,
  };
  const query = useQuery({
    queryKey: ["pay", identity, "monthly", params],
    queryFn: async () =>
      (
        await apiClient.get<MonthlyPaymentResult>("/acm/pay/bills/monthly", {
          params,
        })
      ).data,
  });
  const result = query.data;
  const money = (n: number | null) => (n === null ? "—" : n.toLocaleString());
  const move = (offset: number) => {
    const d = new Date(`${month}-01T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + offset);
    const next = d.toISOString().slice(0, 7);
    if (next >= "2000-01" && next <= "2099-12") change(next, site);
  };
  const change = (m: string, s: string) => {
    if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(m)) return;
    setPage(1);
    onFilter(m, s);
  };
  const selectStatus = (s: string) => {
    setStatus(s);
    setPage(1);
    onList();
  };
  const exportRows = async () => {
    setDownloadError(false);
    try {
      const response = await apiClient.get("/acm/pay/bills/monthly-export", {
        params,
        responseType: "blob",
      });
      const url = URL.createObjectURL(response.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `monthly-${month}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setDownloadError(true);
    }
  };
  const rows = (items: MonthlyStudentRow[]) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            {[
              "student",
              "site",
              "period",
              "status",
              "net",
              "received",
              "unpaid",
              "actions",
            ].map((k) => (
              <th className="p-2 text-left whitespace-nowrap" key={k}>
                {tr(k)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="p-2">
                <Link to={`/admin/std/${r.id}`}>{r.name}</Link>
                {r.review && (
                  <span className="block text-amber-700">{tr("review")}</span>
                )}
              </td>
              <td className="p-2">
                {[...new Set(r.periods.map((p) => p.site || "UNASSIGNED"))]
                  .map((s) => tr(s))
                  .join(", ") || tr(r.site || "UNASSIGNED")}
              </td>
              <td className="p-2 whitespace-nowrap">
                {r.periods.map((p, i) => (
                  <div key={i}>
                    {p.start || "—"} ~ {p.end || "—"}
                  </div>
                ))}
              </td>
              <td className="p-2">
                {tr(r.status)}
                {r.drafts > 0 && r.status !== "DRAFT" && (
                  <small className="block">
                    {tr("DRAFT")} {r.drafts}
                  </small>
                )}
              </td>
              {(["net", "received", "unpaid"] as const).map((k) => (
                <td className="p-2 text-right" key={k}>
                  {money(r[k])}
                </td>
              ))}
              <td className="p-2">
                {r.billIds.map((id, i) => (
                  <button
                    className={field}
                    key={id}
                    onClick={() => onDetail(id)}
                  >
                    {tr("detailAction")} {r.billIds.length > 1 ? i + 1 : ""}
                  </button>
                ))}
                {r.billCount > 0 && (
                  <button className={field} onClick={() => onEdit(r.id)}>
                    {tr("editBills")}
                  </button>
                )}
                {!r.billCount && (
                  <button
                    className={field}
                    disabled={!r.enrolled || r.review}
                    onClick={() => onCreate(r)}
                  >
                    {tr("create")}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.length === 0 && <p className="p-4">{tr("empty")}</p>}
    </div>
  );
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded border bg-white p-3">
        <button
          className={field}
          aria-label={tr("previousMonth")}
          onClick={() => move(-1)}
        >
          ◀
        </button>
        <input
          className={field}
          aria-label={tr("month")}
          type="month"
          min="2000-01"
          max="2099-12"
          value={month}
          onChange={(e) => change(e.target.value, site)}
        />
        <button
          className={field}
          aria-label={tr("nextMonth")}
          onClick={() => move(1)}
        >
          ▶
        </button>
        <button
          className={field}
          onClick={() =>
            change(
              new Intl.DateTimeFormat("en-CA", {
                year: "numeric",
                month: "2-digit",
                timeZone: "Asia/Seoul",
              })
                .format(new Date())
                .slice(0, 7),
              site,
            )
          }
        >
          {tr("thisMonth")}
        </button>
        <select
          aria-label={tr("site")}
          className={field}
          value={site}
          onChange={(e) => change(month, e.target.value)}
        >
          {monthlySites.map((s) => (
            <option key={s} value={s}>
              {tr(s)}
            </option>
          ))}
        </select>
        <select
          aria-label={tr("scope")}
          className={field}
          value={scope}
          onChange={(e) => {
            setScope(e.target.value);
            setPage(1);
          }}
        >
          {["ENROLLED", "ALL_RECORDS", "REVIEW"].map((s, i) => (
            <option key={s} value={["ENROLLED", "ALL", "REVIEW"][i]}>
              {tr(s)}
            </option>
          ))}
        </select>
        {!dashboard && (
          <>
            <input
              className={field}
              aria-label={tr("student")}
              placeholder={tr("student")}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            <select
              className={field}
              aria-label={tr("status")}
              value={status}
              onChange={(e) => selectStatus(e.target.value)}
            >
              <option value="">{tr("allStatuses")}</option>
              {[
                "NONE",
                "DRAFT",
                "UNPAID",
                "PARTIAL",
                "PAID",
                "FREE",
                "FINALIZED",
              ].map((s) => (
                <option key={s} value={s}>
                  {tr(s)}
                </option>
              ))}
            </select>
            <button
              className={field}
              disabled={!result || query.isFetching}
              onClick={exportRows}
            >
              {tr("export")}
            </button>
          </>
        )}
      </div>
      <p className="text-sm text-secondary">{tr("basisHint")}</p>
      {query.isPending && <p role="status">{tr("loading")}</p>}
      {(query.isError || downloadError) && (
        <p role="alert">
          {tr("failed")}{" "}
          <button className={field} onClick={() => query.refetch()}>
            {tr("retry")}
          </button>
        </p>
      )}
      {result && !query.isError && (
        <>
          <div className="flex flex-wrap gap-2">
            {(
              [
                "enrolled",
                "missing",
                "draftStudents",
                "billed",
                "unpaidStudents",
              ] as const
            ).map((k) => (
              <button
                className="rounded border bg-white p-3 text-left"
                key={k}
                onClick={() => {
                  if (k === "enrolled") setScope("ENROLLED");
                  selectStatus(
                    k === "missing"
                      ? "NONE"
                      : k === "draftStudents"
                        ? "DRAFT"
                        : k === "unpaidStudents"
                          ? "UNPAID"
                          : k === "billed"
                            ? "FINALIZED"
                            : "",
                  );
                }}
              >
                <span className="block text-xs">{tr(k)}</span>
                <strong>{result.summary[k]}</strong>
              </button>
            ))}
            <button
              className={field}
              onClick={() => {
                setScope("REVIEW");
                setStatus("");
                setPage(1);
                onList();
              }}
            >
              {tr("review")} {result.reviewCount}
            </button>
          </div>
          <h2 className="font-semibold">{tr("cohortTotals")}</h2>
          <div className="flex flex-wrap gap-2">
            {(["net", "received", "unpaid", "rate"] as const).map((k) => (
              <div key={k} className="rounded border bg-white p-3">
                <span className="block text-xs">{tr(k)}</span>
                <strong>
                  {k === "rate"
                    ? result.summary.rate === null
                      ? "—"
                      : `${result.summary.rate.toFixed(1)}%`
                    : money(result.summary[k])}
                </strong>
              </div>
            ))}
          </div>
          <p className="text-xs text-secondary">
            {tr("asOf")} {new Date(result.asOf).toLocaleString()} · KRW
          </p>
          {!dashboard ? (
            <>
              {rows(result.items)}
              <div className="flex items-center gap-3">
                <span>
                  {tr("total")} {result.total}
                </span>
                <button
                  className={field}
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  ◀
                </button>
                <span>{page}</span>
                <button
                  className={field}
                  disabled={page * 50 >= result.total}
                  onClick={() => setPage(page + 1)}
                >
                  ▶
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="font-semibold">{tr("ledgerTotals")}</h2>
              <p>
                {tr("net")} {money(result.ledger.net)} / {tr("received")}{" "}
                {money(result.ledger.received)} / {tr("unpaid")}{" "}
                {money(result.ledger.unpaid)}
              </p>
              <h2 className="font-semibold">{tr("cashBasis")}</h2>
              <p>
                {tr("paid")} {money(result.cash.paid)} / {tr("refunded")}{" "}
                {money(result.cash.refunded)} / {tr("cashReceived")}{" "}
                {money(result.cash.received)}
              </p>
              <h2 className="font-semibold">{tr("trend")}</h2>
              <p className="text-xs">{tr("trendHint")}</p>
              <div className="rounded border bg-white p-3 space-y-2">
                {result.trend.map((r) => (
                  <div
                    key={r.month}
                    className="grid grid-cols-[5rem_1fr] gap-2 text-xs"
                  >
                    <span>{r.month}</span>
                    <div>
                      <div
                        className="h-2 bg-indigo-500"
                        style={{
                          width: `${(Math.max(0, r.net) / Math.max(1, ...result.trend.map((v) => Math.max(v.net, Math.abs(v.cash.received))))) * 100}%`,
                        }}
                      />
                      <div
                        className={
                          r.cash.received < 0
                            ? "h-2 bg-rose-500"
                            : "h-2 bg-emerald-500"
                        }
                        style={{
                          width: `${(Math.abs(r.cash.received) / Math.max(1, ...result.trend.map((v) => Math.max(v.net, Math.abs(v.cash.received))))) * 100}%`,
                        }}
                      />
                      <span>
                        {tr("net")} {money(r.net)} · {tr("cashReceived")}{" "}
                        {money(r.cash.received)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <h2 className="font-semibold">{tr("siteComparison")}</h2>
              <p className="text-xs">{tr("siteHint")}</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      {[
                        "site",
                        "enrolled",
                        "net",
                        "unpaid",
                        "cashReceived",
                      ].map((k) => (
                        <th className="p-2 text-left" key={k}>
                          {tr(k)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.sites.map((r) => (
                      <tr className="border-t" key={r.site}>
                        <td>
                          <button
                            className={field}
                            onClick={() => change(month, r.site)}
                          >
                            {tr(r.site)}
                          </button>
                        </td>
                        <td>{r.summary.enrolled}</td>
                        <td>{money(r.ledger.net)}</td>
                        <td>{money(r.ledger.unpaid)}</td>
                        <td>{money(r.cash.received)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h2 className="font-semibold">{tr("topUnpaid")}</h2>
              {rows(result.topUnpaid)}
            </>
          )}
        </>
      )}
    </section>
  );
}
