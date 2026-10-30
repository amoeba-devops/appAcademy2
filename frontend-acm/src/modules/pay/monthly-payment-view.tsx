import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { apiClient } from "@/lib/api-client";
import type { MonthlyPaymentResult, MonthlyStudentRow } from "./monthly-types";
import { payErrorCode, type ImportData } from "./bill-import";
const field = "rounded border bg-white px-3 py-2 text-sm whitespace-nowrap";
const base = "/acm/pay/bills";
/** REQ-261027B/C — amount·discount typed into a list row, kept with the row it was typed on. */
interface InlineBill {
  row: MonthlyStudentRow;
  amount: number | null;
  discount: number | null;
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
export type MonthlyMode = "dashboard" | "view" | "edit";
export function MonthlyPaymentView({
  identity,
  month,
  site,
  mode,
  initialStatus,
  onFilter,
  onDetail,
  onEditBills,
  onPickStudent,
  onImport,
  onExportBills,
  onDirtyChange,
  onList,
}: {
  identity: string;
  month: string;
  site: string;
  /** REQ-261027C — dashboard: stats only · view: history list · edit: this month's billing. */
  mode: MonthlyMode;
  initialStatus: string;
  onFilter: (month: string, site: string) => void;
  /** Dashboard cards jump to the monthly list filtered by status. */
  onList: (status: string) => void;
  onDetail: (billIds: string[], readOnly: boolean) => void;
  /** REQ-261030 — quick add / edit / delete of this student's bills (default due passed). */
  onEditBills: (student: MonthlyStudentRow, due: string) => void;
  onPickStudent: () => void;
  onImport: () => void;
  onExportBills: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const { t } = useTranslation("common");
  const tr = (key: string, o?: Record<string, unknown>) =>
    t(`payMonthly.${key}`, o);
  const qc = useQueryClient();
  const dashboard = mode === "dashboard",
    editing = mode === "edit";
  const [due, setDue] = useState(`${month}-10`),
    [edits, setEdits] = useState<Record<string, InlineBill>>({}),
    [rowErrors, setRowErrors] = useState<Record<string, string>>({}),
    [saved, setSaved] = useState(""),
    [saving, setSaving] = useState(false);
  const dirtyCount = Object.keys(edits).length;
  useEffect(() => onDirtyChange(dirtyCount > 0), [dirtyCount, onDirtyChange]);
  const leave = () => !dirtyCount || window.confirm(t("pay.discard"));
  const setEdit = (
    r: MonthlyStudentRow,
    patch: Partial<Pick<InlineBill, "amount" | "discount">>,
  ) => {
    setEdits((old) => {
      const next = { ...old };
      const cur = {
        row: r,
        amount: old[r.id]?.amount ?? r.bill?.amount ?? null,
        discount: old[r.id]?.discount ?? r.bill?.discount ?? null,
        ...patch,
      };
      const same =
        (cur.amount ?? null) === (r.bill?.amount ?? null) &&
        (cur.discount ?? 0) === (r.bill?.discount ?? 0);
      if (same || (!r.bill && cur.amount === null)) delete next[r.id];
      else next[r.id] = cur;
      return next;
    });
    setRowErrors((old) => {
      const next = { ...old };
      delete next[r.id];
      return next;
    });
  };
  const saveEdits = async () => {
    setSaving(true);
    setSaved("");
    const errors: Record<string, string> = {};
    const left = { ...edits };
    let created = 0,
      updated = 0,
      classes: Map<string, { id: string }[]> | null = null;
    for (const {
      row: r,
      amount: typed,
      discount: typedDiscount,
    } of Object.values(edits)) {
      const amount = typed ?? 0,
        discount = typedDiscount ?? 0;
      if (discount > amount) {
        errors[r.id] = t("pay.discountOverAmount");
        continue;
      }
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
                discount,
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
                  discount,
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
    setEdits(left);
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
  // History lookup includes every student with a bill that month.
  const [scope, setScope] = useState(mode === "view" ? "ALL" : "ENROLLED"),
    [status, setStatus] = useState(initialStatus),
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
  const cell = "p-2 whitespace-nowrap";
  // REQ-261027C — the same 12 columns on the monthly list and bill details.
  const rows = (items: MonthlyStudentRow[], offset = 0, edit = false) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            {[
              "no",
              "studentName",
              "site",
              "school",
              "grade",
              "amount",
              "discount",
              "received",
              "unpaid",
              "refunded",
              "status",
              "billAction",
            ].map((k) => (
              <th className={`${cell} text-left`} key={k}>
                {tr(`col.${k}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((r, i) => {
            const inline = edit && r.billCount <= 1;
            const typed = edits[r.id];
            return (
              <tr
                key={r.id}
                className={`border-t ${typed ? "bg-amber-50" : ""}`}
              >
                <td className={cell}>{offset + i + 1}</td>
                <td className={cell}>
                  <Link to={`/admin/std/${r.id}`}>{r.name}</Link>
                  {r.review && (
                    <span className="ml-1 text-xs text-amber-700">
                      {tr("review")}
                    </span>
                  )}
                </td>
                <td className={cell}>
                  {[...new Set(r.periods.map((p) => p.site || "UNASSIGNED"))]
                    .map((x) => tr(x))
                    .join(", ") || tr(r.site || "UNASSIGNED")}
                </td>
                <td className={cell}>{r.school || "—"}</td>
                <td className={cell}>{r.grade || "—"}</td>
                <td className={`${cell} text-right`}>
                  {inline ? (
                    <AmountInput
                      label={`${tr("amount")} ${r.name}`}
                      value={typed ? typed.amount : (r.bill?.amount ?? null)}
                      dirty={!!typed}
                      onChange={(v) => setEdit(r, { amount: v })}
                    />
                  ) : (
                    <>
                      {r.billCount > 1 && (
                        <span className="mr-1 text-xs text-secondary">
                          {tr("multiBills", { count: r.billCount })}
                        </span>
                      )}
                      {money(r.amount)}
                    </>
                  )}
                  {rowErrors[r.id] && (
                    <small role="alert" className="block text-red-700">
                      {rowErrors[r.id]}
                    </small>
                  )}
                </td>
                <td className={`${cell} text-right`}>
                  {inline ? (
                    <AmountInput
                      label={`${tr("discount")} ${r.name}`}
                      value={
                        typed ? typed.discount : (r.bill?.discount ?? null)
                      }
                      dirty={!!typed}
                      onChange={(v) => setEdit(r, { discount: v })}
                    />
                  ) : (
                    money(r.discount)
                  )}
                </td>
                {(["received", "unpaid", "refunded"] as const).map((k) => (
                  <td className={`${cell} text-right`} key={k}>
                    {money(r[k])}
                  </td>
                ))}
                <td className={cell}>
                  {tr(r.status)}
                  {r.drafts > 0 && r.status !== "DRAFT" && (
                    <small className="ml-1">
                      {tr("DRAFT")} {r.drafts}
                    </small>
                  )}
                </td>
                <td className={`${cell} space-x-1`}>
                  {edit ? (
                    <button
                      className={`${field} min-h-9`}
                      onClick={() => {
                        if (!leave()) return;
                        setEdits({});
                        onEditBills(r, due);
                      }}
                    >
                      {r.billCount > 0
                        ? tr("modifyCount", { count: r.billCount })
                        : tr("writeNew")}
                    </button>
                  ) : r.billCount > 0 ? (
                    <button
                      className={field}
                      onClick={() => onDetail(r.billIds, true)}
                    >
                      {tr("view")}
                    </button>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {items.length === 0 && <p className="p-4">{tr("empty")}</p>}
    </div>
  );
  const statusSelect = (
    <select
      className={field}
      aria-label={tr("status")}
      value={status}
      onChange={(e) => {
        setStatus(e.target.value);
        setPage(1);
      }}
    >
      <option value="">{tr("allStatuses")}</option>
      {["NONE", "DRAFT", "UNPAID", "PARTIAL", "PAID", "FREE", "FINALIZED"].map(
        (x) => (
          <option key={x} value={x}>
            {tr(x)}
          </option>
        ),
      )}
    </select>
  );
  const scopeSelect = (
    <select
      aria-label={tr("scope")}
      className={field}
      value={scope}
      onChange={(e) => {
        setScope(e.target.value);
        setPage(1);
      }}
    >
      {["ENROLLED", "ALL_RECORDS", "REVIEW"].map((x, i) => (
        <option key={x} value={["ENROLLED", "ALL", "REVIEW"][i]}>
          {tr(x)}
        </option>
      ))}
    </select>
  );
  return (
    <section className="space-y-4">
      {!dashboard && (
        // Line ② of the list: search · filters · Excel (+ billing tools on bill details).
        <div
          className={`flex flex-wrap items-center gap-2 ${editing ? "sticky top-14 z-10 rounded border bg-white p-3 shadow-sm" : ""}`}
        >
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
          {scopeSelect}
          {statusSelect}
          <button
            className={field}
            disabled={!result || query.isFetching}
            onClick={exportRows}
          >
            {tr("export")}
          </button>
          {editing && (
            <>
              <button className={field} onClick={onExportBills}>
                {tr("exportBills")}
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
                    onClick={() => void saveEdits()}
                  >
                    {tr("saveInline", { count: dirtyCount })}
                  </button>
                  <button
                    className={field}
                    disabled={saving}
                    onClick={() => {
                      setEdits({});
                      setRowErrors({});
                    }}
                  >
                    {tr("cancelInline")}
                  </button>
                </span>
              )}
              <p className="w-full text-xs text-secondary">
                {tr("inlineHint")}
              </p>
              {saved && (
                <p role="status" className="w-full text-sm">
                  {saved}
                </p>
              )}
            </>
          )}
        </div>
      )}
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
          {dashboard && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {scopeSelect}
                <button className={field} onClick={onPickStudent}>
                  {tr("pickStudent")}
                </button>
              </div>
              <p className="text-sm text-secondary">{tr("basisHint")}</p>
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
                    onClick={() =>
                      onList(
                        k === "missing"
                          ? "NONE"
                          : k === "draftStudents"
                            ? "DRAFT"
                            : k === "unpaidStudents"
                              ? "UNPAID"
                              : k === "billed"
                                ? "FINALIZED"
                                : "",
                      )
                    }
                  >
                    <span className="block text-xs">{tr(k)}</span>
                    <strong>{result.summary[k]}</strong>
                  </button>
                ))}
                <button className={field} onClick={() => setScope("REVIEW")}>
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
            </>
          )}
          {!dashboard ? (
            <>
              {rows(result.items, (page - 1) * 50, editing)}
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
