import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { apiClient } from "@/lib/api-client";
import type { MonthlyPaymentResult, MonthlyStudentRow } from "./monthly-types";
import { PayInFull, QuickAmount } from "./monthly-quick";
const field = "rounded border bg-white px-3 py-2 text-sm whitespace-nowrap";
export const monthlySites = ["ALL", "TPI", "TRINITY", "SANTACROCE"];
export type MonthlyMode = "view" | "edit";
export function MonthlyPaymentView({
  identity,
  month,
  site,
  mode,
  initialStatus,
  initialScope = "ENROLLED",
  onDetail,
  onEditBills,
  onImport,
  onExportBills,
  leading,
}: {
  /** REQ-261112 — 필터 줄 맨 앞에 놓을 컨트롤(월별 납부 목록의 월·학원 선택). */
  leading?: ReactNode;
  identity: string;
  month: string;
  site: string;
  /** REQ-261027C — view: history list · edit: this month's billing. (대시보드는 REQ-261112C PayDashboard) */
  mode: MonthlyMode;
  initialStatus: string;
  /** REQ-261112C — 대시보드 퍼널 '기간 확인 필요'에서 들어오면 REVIEW. */
  initialScope?: string;
  onDetail: (billIds: string[], readOnly: boolean) => void;
  /** REQ-261030 — quick add / edit / delete of this student's bills (default due passed). */
  onEditBills: (student: MonthlyStudentRow, due: string) => void;
  onImport: () => void;
  onExportBills: () => void;
}) {
  const { t } = useTranslation("common");
  const tr = (key: string, o?: Record<string, unknown>) =>
    t(`payMonthly.${key}`, o);
  const editing = mode === "edit";
  const [due, setDue] = useState(`${month}-10`);
  // REQ-261102 — the monthly list row whose amount is being typed.
  const [amountFor, setAmountFor] = useState<string | null>(null);
  const view = mode === "view";
  // REQ-261112 — 월별 납부 목록도 해당 월 재원생 기준('전체 청구' 옵션 제거), 목록 100건 기본.
  const [scope, setScope] = useState(initialScope),
    [size, setSize] = useState(view ? 100 : 50),
    [status, setStatus] = useState(initialStatus),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [downloadError, setDownloadError] = useState(false);
  const params = {
    month,
    site,
    scope,
    status: status || undefined,
    q: search || undefined,
    page,
    size,
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
  // "list" = monthly list (quick amount · 완납), "edit" = bill details, "read" = dashboard.
  const rows = (
    items: MonthlyStudentRow[],
    offset = 0,
    kind: "read" | "list" | "edit" = "read",
  ) => (
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
            // REQ-261030B — amounts are read-only; clicking them opens the bill dialog.
            const edit = kind === "edit";
            const amountCell = (value: number | null, label: string) =>
              edit ? (
                <button
                  className="w-[11ch] rounded px-1 text-right tabular-nums hover:bg-slate-100 focus:bg-slate-100"
                  aria-label={`${label} ${r.name}`}
                  onClick={() => onEditBills(r, due)}
                >
                  {money(value)}
                </button>
              ) : (
                <span className="inline-block w-[11ch] text-right tabular-nums">
                  {money(value)}
                </span>
              );
            return (
              <tr key={r.id} className="border-t">
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
                  {r.billCount > 1 && (
                    <span className="mr-1 text-xs text-secondary">
                      {tr("multiBills", { count: r.billCount })}
                    </span>
                  )}
                  {kind === "list" ? (
                    <QuickAmount
                      row={r}
                      month={month}
                      identity={identity}
                      editing={amountFor === r.id}
                      setEditing={(on) => setAmountFor(on ? r.id : null)}
                      onMulti={() => onEditBills(r, `${month}-10`)}
                    />
                  ) : (
                    amountCell(r.amount, tr("amount"))
                  )}
                </td>
                <td className={`${cell} text-right`}>
                  {amountCell(r.discount, tr("discount"))}
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
                  {kind === "list" &&
                    (r.status === "NONE" || r.status === "DRAFT") &&
                    amountFor !== r.id && (
                      <button
                        className="ml-2 min-h-9 rounded border px-2 text-xs hover:bg-slate-100"
                        onClick={() =>
                          r.billCount > 1
                            ? onEditBills(r, `${month}-10`)
                            : setAmountFor(r.id)
                        }
                      >
                        {tr("enterAmount")}
                      </button>
                    )}
                  {kind === "list" &&
                    (r.status === "UNPAID" || r.status === "PARTIAL") && (
                      <PayInFull row={r} month={month} identity={identity} />
                    )}
                </td>
                <td className={`${cell} space-x-1`}>
                  {kind !== "read" ? (
                    <button
                      className={`${field} min-h-9`}
                      onClick={() => onEditBills(r, edit ? due : `${month}-10`)}
                    >
                      {tr("bill")}
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
      {["ENROLLED", "ALL_RECORDS", "REVIEW"].map((x, i) =>
        view && x === "ALL_RECORDS" ? null : (
          <option key={x} value={["ENROLLED", "ALL", "REVIEW"][i]}>
            {tr(x)}
          </option>
        ),
      )}
    </select>
  );
  return (
    <section className="space-y-4">
      {(
        // Line ② of the list: search · filters · Excel (+ billing tools on bill details).
        <div
          className={`flex flex-wrap items-center gap-2 ${editing ? "sticky top-14 z-10 rounded border bg-white p-3 shadow-sm" : ""}`}
        >
          {leading}
          <input
            className={`${field} ${view ? "w-36" : ""}`}
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
          {view && (
            <select
              className={field}
              aria-label={tr("pageSize")}
              value={size}
              onChange={(e) => {
                setSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {[50, 100, 200].map((n) => (
                <option key={n} value={n}>
                  {tr("perPage", { count: n })}
                </option>
              ))}
            </select>
          )}
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
              <p className="w-full text-xs text-secondary">
                {tr("inlineHint")}
              </p>
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
          {(
            <>
              {view && (
                // REQ-261112 — 필터 결과 전체 합계 한 줄(납부한 학생 수 · 금액 합계).
                <div className="overflow-x-auto rounded border bg-white">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs text-secondary">
                      <tr>
                        {/* REQ-261112B — 금액 열 이름은 아래 목록 열(col.*)과 같은 키를 쓴다. */}
                        {["stats.label", "stats.students", "stats.paidCount", "col.amount", "col.discount", "col.received", "col.unpaid", "col.refunded"].map((k) => (
                          <th
                            key={k}
                            className={`${cell} font-medium ${k === "stats.label" ? "text-left" : "text-right"}`}
                          >
                            {tr(k)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t font-semibold tabular-nums">
                        <td className={cell}>{tr("stats.total")}</td>
                        <td className={`${cell} text-right`}>
                          {tr("stats.people", { count: result.summary.enrolled })}
                        </td>
                        <td className={`${cell} text-right`}>
                          {tr("stats.count", { count: result.summary.paidStudents ?? 0 })}
                        </td>
                        {(["amount", "discount", "received", "unpaid", "refunded"] as const).map((k) => (
                          <td key={k} className={`${cell} text-right`}>
                            {tr("stats.won", { value: (result.summary[k] ?? 0).toLocaleString() })}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
              {rows(result.items, (page - 1) * size, editing ? "edit" : "list")}
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
                  disabled={page * size >= result.total}
                  onClick={() => setPage(page + 1)}
                >
                  ▶
                </button>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
