import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { apiClient } from "@/lib/api-client";
import type { MonthlyPaymentResult, MonthlyStudentRow } from "./monthly-types";
import { payErrorCode, type ImportData } from "./bill-import";
const field = "rounded border bg-white px-3 py-2 text-sm";
const base = "/acm/pay/bills";
/** REQ-261027B — amount typed into a list row, kept with the row it was typed on. */
interface InlineAmount {
  row: MonthlyStudentRow;
  amount: number;
}
function AmountInput({
  value,
  onChange,
  label,
  dirty,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  label: string;
  dirty: boolean;
}) {
  const format = (n: number | null) => (n === null ? "" : n.toLocaleString());
  const [text, setText] = useState(format(value));
  useEffect(() => setText(format(value)), [value]);
  return (
    <input
      className={`w-28 rounded border px-2 py-1 text-right text-base md:text-sm ${dirty ? "border-amber-400 bg-amber-50" : "bg-white"}`}
      aria-label={label}
      inputMode="numeric"
      value={text}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d]/g, "");
        if (raw === "") {
          setText("");
          onChange(null);
          return;
        }
        const n = Number(raw);
        if (n <= 50000000) {
          setText(n.toLocaleString());
          onChange(n);
        }
      }}
    />
  );
}
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
  onAddBill,
  onPickStudent,
  onImport,
  onDirtyChange,
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
  /** REQ-261027 — add a bill for this student (also when bills exist). */
  onAddBill: (student: MonthlyStudentRow) => void;
  /** REQ-261027B — list toolbar: pick students to bill / Excel import. */
  onPickStudent: () => void;
  onImport: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const { t } = useTranslation("common");
  const tr = (key: string, o?: Record<string, unknown>) =>
    t(`payMonthly.${key}`, o);
  const qc = useQueryClient();
  const [due, setDue] = useState(`${month}-10`),
    [amounts, setAmounts] = useState<Record<string, InlineAmount>>({}),
    [rowErrors, setRowErrors] = useState<Record<string, string>>({}),
    [saved, setSaved] = useState(""),
    [saving, setSaving] = useState(false);
  const dirtyCount = Object.keys(amounts).length;
  useEffect(() => onDirtyChange(dirtyCount > 0), [dirtyCount, onDirtyChange]);
  const leave = () => !dirtyCount || window.confirm(t("pay.discard"));
  const setAmount = (r: MonthlyStudentRow, amount: number | null) => {
    setAmounts((old) => {
      const next = { ...old };
      if (amount === null || amount === r.bill?.amount) delete next[r.id];
      else next[r.id] = { row: r, amount };
      return next;
    });
    setRowErrors((old) => {
      const next = { ...old };
      delete next[r.id];
      return next;
    });
  };
  const saveAmounts = async () => {
    setSaving(true);
    setSaved("");
    const errors: Record<string, string> = {};
    const left = { ...amounts };
    let created = 0,
      updated = 0,
      classes: Map<string, { id: string }[]> | null = null;
    for (const { row: r, amount } of Object.values(amounts)) {
      try {
        if (r.bill) {
          const b = r.bill;
          await apiClient.patch(base + "/batch", {
            requestId: crypto.randomUUID(),
            reason: tr("inlineReason"),
            items: [
              {
                id: b.id,
                version: b.version,
                amount,
                discount: b.discount,
                due: b.due ?? due,
                title: b.title,
                memo: b.memo,
              },
            ],
          });
          updated++;
        } else {
          if (!classes) {
            const data = await qc.fetchQuery({
              queryKey: ["pay", identity, "import-data"],
              queryFn: async () =>
                (
                  await apiClient.get<ImportData>(base + "/import-data", {
                    params: { site: "ALL" },
                  })
                ).data,
            });
            classes = new Map(data.students.map((s) => [s.id, s.classes]));
          }
          const own = classes.get(r.id) ?? [];
          const res = (
            await apiClient.post<{
              ids: string[];
              skipped: { reason: string }[];
            }>(base + "/batch-create", {
              requestId: crypto.randomUUID(),
              items: [
                {
                  studentId: r.id,
                  classId: own.length === 1 ? own[0].id : undefined,
                  month,
                  due,
                  kind: "CLASS",
                  title: t("pay.bulk.defaultTitle", {
                    m: Number(month.slice(5)),
                    ym: month,
                  }),
                  amount,
                  discount: 0,
                  memo: "",
                },
              ],
            })
          ).data;
          if (!res.ids.length) {
            errors[r.id] = t(`pay.${res.skipped[0]?.reason ?? "failed"}`);
            continue;
          }
          created++;
        }
        delete left[r.id];
      } catch (e) {
        errors[r.id] = t(`pay.${payErrorCode(e) ?? "failed"}`);
      }
    }
    setAmounts(left);
    setRowErrors(errors);
    setSaved(
      tr("inlineResult", {
        created,
        updated,
        failed: Object.keys(errors).length,
      }),
    );
    await qc.invalidateQueries({ queryKey: ["pay", identity] });
    setSaving(false);
  };
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
  const change = (m: string, s: string) => {
    if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(m)) return;
    if (!leave()) return;
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
              "amount",
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
              <td className="p-2 text-right">
                {r.billCount > 1 ? (
                  <span className="whitespace-nowrap">
                    {tr("multiBills", { count: r.billCount })} {money(r.net)}
                  </span>
                ) : (
                  <>
                    <AmountInput
                      label={`${tr("amount")} ${r.name}`}
                      value={amounts[r.id]?.amount ?? r.bill?.amount ?? null}
                      dirty={!!amounts[r.id]}
                      onChange={(v) => setAmount(r, v)}
                    />
                    {r.net !== null && r.net !== r.bill?.amount && (
                      <small className="block text-secondary">
                        {tr("net")} {money(r.net)}
                      </small>
                    )}
                    {rowErrors[r.id] && (
                      <small role="alert" className="block text-red-700">
                        {rowErrors[r.id]}
                      </small>
                    )}
                  </>
                )}
              </td>
              {(["received", "unpaid"] as const).map((k) => (
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
                <button className={field} onClick={() => onAddBill(r)}>
                  {t("pay.addBill")}
                </button>
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
      {!dashboard && (
        // Sticky so [Save changes] stays reachable while editing far down the list.
        <div className="sticky top-14 z-10 flex flex-wrap items-center gap-2 rounded border bg-white p-3 shadow-sm">
          <button className={field} onClick={onPickStudent}>
            {tr("pickStudent")}
          </button>
          <button className={field} onClick={onImport}>
            {t("pay.bulk.button")}
          </button>
          <label className="flex items-center gap-2 text-sm">
            {tr("defaultDue")}
            <input
              className={`${field} text-base md:text-sm`}
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </label>
          {dirtyCount > 0 && (
            <span className="ml-auto flex gap-2">
              <button
                className={`${field} border-amber-400 bg-amber-50 font-medium`}
                disabled={saving || !due}
                onClick={() => void saveAmounts()}
              >
                {tr("saveInline", { count: dirtyCount })}
              </button>
              <button
                className={field}
                disabled={saving}
                onClick={() => {
                  setAmounts({});
                  setRowErrors({});
                }}
              >
                {tr("cancelInline")}
              </button>
            </span>
          )}
          <p className="w-full text-xs text-secondary">{tr("inlineHint")}</p>
          {saved && (
            <p role="status" className="w-full text-sm">
              {saved}
            </p>
          )}
        </div>
      )}
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
