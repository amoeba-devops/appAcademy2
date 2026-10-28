import { PaymentTopStatistics } from "./top-statistics";
import { MonthlyPaymentView, monthlySites } from "./monthly-payment-view";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { Wallet } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { UnderlineTabs } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  Detail,
  Edit,
  Option,
  Options,
  Preview,
} from "./types";
import { payErrorCode } from "./bill-import";
import { BillImportDialog } from "./bill-import-dialog";
const base = "/acm/pay/bills";
const input =
  "rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900";
const btn =
  "rounded border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-slate-100";
const format = (n: number | null) =>
  n === null ? "—" : new Intl.NumberFormat().format(n);
const kinds = ["CLASS", "BOOK", "MATERIAL", "TRANSPORT", "OTHER"];
const methods = ["CASH", "TRANSFER", "CARD", "OTHER"];
function Money({
  value,
  onChange,
  label,
  signed = false,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  signed?: boolean;
}) {
  const [text, setText] = useState(format(value));
  useEffect(() => setText(format(value)), [value]);
  return (
    <input
      className={`${input} w-28 text-right`}
      aria-label={label}
      inputMode="numeric"
      value={text}
      onBlur={() => setText(format(value))}
      onChange={(e) => {
        const raw = e.target.value.replace(/,/g, "");
        if ((signed ? /^-?\d*$/ : /^\d*$/).test(raw)) {
          if (raw === "-" || raw === "") {
            setText(raw);
            if (raw === "") onChange(0);
            return;
          }
          const n = Number(raw);
          if (Number.isSafeInteger(n) && Math.abs(n) <= 50000000) {
            setText(format(n));
            onChange(n);
          }
        }
      }}
    />
  );
}
function AuditChanges({ before, after }: { before: unknown; after: unknown }) {
  const { t } = useTranslation("common");
  const a = (after && typeof after === "object" ? after : {}) as Record<
    string,
    unknown
  >;
  const b = (before && typeof before === "object" ? before : {}) as Record<
    string,
    unknown
  >;
  return (
    <table className="w-full">
      <tbody>
        {[
          "title",
          "amount",
          "discount",
          "due",
          "memo",
          "date",
          "method",
          "reduceBill",
        ]
          .filter((k) => k in a && a[k] !== b[k])
          .map((k) => (
            <tr key={k}>
              <th>{t(`pay.${k === "title" ? "billTitle" : k}`)}</th>
              <td>{String(b[k] ?? "—")}</td>
              <td>→ {String(a[k] ?? "—")}</td>
            </tr>
          ))}
      </tbody>
    </table>
  );
}

export function PaymentPage() {
  const user = useAuthStore((s) => s.user);
  const { t } = useTranslation("common");
  if (!user || !["ADMIN", "APP_ADMIN", "STAFF"].includes(user.role ?? ""))
    return <p>{t("pay.forbidden")}</p>;
  return (
    <Payments
      key={`${user.entId}:${user.id}`}
      identity={`${user.entId}:${user.id}`}
      admin={user.role !== "STAFF"}
    />
  );
}
const kstMonth = (offset = 0) => {
  const [y, m] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
  })
    .format(new Date())
    .slice(0, 7)
    .split("-")
    .map(Number);
  const d = new Date(Date.UTC(y, m - 1 + offset, 1));
  return d.toISOString().slice(0, 7);
};
type PayTab = "dashboard" | "monthly" | "detail";
// REQ-261027C — dashboard (stats) / monthly list (read-only history) / bill details (this month's billing).
function Payments({ identity, admin }: { identity: string; admin: boolean }) {
  const { t } = useTranslation("common");
  const tr = (s: string) => t(`pay.${s}`);
  const qc = useQueryClient();
  const [url, setUrl] = useSearchParams();
  const tab: PayTab = (["monthly", "detail", "dashboard"] as const).find(
    (v) => v === url.get("view"),
  ) ?? "monthly";
  const urlMonth = /^20\d{2}-(0[1-9]|1[0-2])$/.test(url.get("month") || "")
    ? url.get("month")!
    : kstMonth();
  // Bill details only writes this month's (or next month's advance) bills.
  const billMonths = [kstMonth(), kstMonth(1)];
  const month =
    tab === "detail" && !billMonths.includes(urlMonth) ? billMonths[0] : urlMonth;
  const site = monthlySites.includes(url.get("site") || "")
    ? url.get("site")!
    : "ALL";
  const [dirty, setDirty] = useState(false);
  const go = (next: { month?: string; site?: string; view?: PayTab; status?: string }) => {
    if (dirty && !window.confirm(tr("discard"))) return;
    const params = new URLSearchParams(url);
    params.set("month", next.month ?? month);
    params.set("site", next.site ?? site);
    params.set("view", next.view ?? tab);
    if (next.status !== undefined) {
      if (next.status) params.set("status", next.status);
      else params.delete("status");
    }
    setUrl(params);
    setDirty(false);
  };
  const [createOpen, setCreateOpen] = useState(false);
  const [createFor, setCreateFor] = useState<{
    student: Option;
    month: string;
  } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [detail, setDetail] = useState<{ ids: string[]; readOnly: boolean } | null>(null);
  const [exportError, setExportError] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["pay", identity] });
  const exportBills = async () => {
    setExportError(false);
    try {
      const r = await apiClient.get(base + "/export", {
        params: {
          basis: "MONTH",
          from: month,
          to: month,
          canceled: "false",
          ...(site === "ALL" ? {} : { site }),
        },
        responseType: "blob",
      });
      const href = URL.createObjectURL(r.data as Blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `bills-${month}.xlsx`;
      a.click();
      URL.revokeObjectURL(href);
    } catch {
      setExportError(true);
    }
  };
  return (
    <section className="space-y-4">
      <PageHeader
        icon={Wallet}
        title={t("nav.pay")}
        description={t("pageHeader.pay.desc")}
        meta={<span>{t("pageHeader.pay.currency")}</span>}
      />
      <UnderlineTabs
        label={t("nav.pay")}
        value={tab}
        onChange={(v) => go({ view: v })}
        items={(["dashboard", "monthly", "detail"] as const).map((key) => ({
          key,
          label: t(`payMonthly.tab.${key}`),
        }))}
      />
      {tab === "detail" ? (
        <div className="flex flex-wrap items-center gap-2">
          <select
            className={input}
            aria-label={t("payMonthly.month")}
            value={month}
            onChange={(e) => go({ month: e.target.value })}
          >
            {billMonths.map((m, i) => (
              <option key={m} value={m}>
                {m} · {t(i ? "payMonthly.nextMonth" : "payMonthly.thisMonth")}
              </option>
            ))}
          </select>
          <select
            className={input}
            aria-label={t("payMonthly.site")}
            value={site}
            onChange={(e) => go({ site: e.target.value })}
          >
            {monthlySites.map((s) => (
              <option key={s} value={s}>
                {t(`payMonthly.${s}`)}
              </option>
            ))}
          </select>
          <p className="text-sm text-secondary">{tr("recordOnly")}</p>
        </div>
      ) : (
        <PaymentTopStatistics
          identity={identity}
          month={month}
          site={site}
          charts={tab === "dashboard"}
          onFilter={(m, s) => go({ month: m, site: s })}
        />
      )}
      {exportError && (
        <p role="alert" className="text-red-700">
          {tr("failed")}
        </p>
      )}
      <MonthlyPaymentView
        key={`${month}:${site}:${tab}`}
        identity={identity}
        month={month}
        site={site}
        mode={tab === "dashboard" ? "dashboard" : tab === "monthly" ? "view" : "edit"}
        initialStatus={url.get("status") || ""}
        onFilter={(m, s) => go({ month: m, site: s })}
        onList={(status) => go({ view: "monthly", status })}
        onDetail={(ids, readOnly) => setDetail({ ids, readOnly })}
        onAddBill={(student) => {
          setCreateFor({
            student: { id: student.id, name: student.name, site: student.site ?? undefined },
            month,
          });
          setCreateOpen(true);
        }}
        onPickStudent={() => {
          setCreateFor(null);
          setCreateOpen(true);
        }}
        onImport={() => setImportOpen(true)}
        onExportBills={() => void exportBills()}
        onDirtyChange={setDirty}
      />
      <CreateDialog
        initialSite={site === "ALL" ? "" : site}
        month={createFor?.month ?? month}
        student={createFor?.student}
        open={createOpen}
        close={() => setCreateOpen(false)}
        identity={identity}
        onSaved={refresh}
      />
      <BillImportDialog
        open={importOpen}
        close={() => setImportOpen(false)}
        month={month}
        site={site}
        onSaved={refresh}
      />
      {detail && (
        <DetailDialog
          ids={detail.ids}
          readOnly={detail.readOnly}
          close={() => setDetail(null)}
          identity={identity}
          admin={admin}
          onSaved={refresh}
        />
      )}
    </section>
  );
}
function CreateDialog({
  initialSite,
  month,
  student,
  open,
  close,
  identity,
  onSaved,
}: {
  month?: string;
  initialSite?: string;
  /** REQ-261027 — fixed student opened from a list row. */
  student?: Option | null;
  open: boolean;
  close: () => void;
  identity: string;
  onSaved: () => Promise<unknown>;
}) {
  const { t } = useTranslation("common");
  const tr = (s: string) => t(`pay.${s === "title" ? "billTitle" : s}`);
  const [search, setSearch] = useState("");
  const [studentStatus, setStudentStatus] = useState("ACTIVE");
  const [classFilter, setClassFilter] = useState("");
  const [site, setSite] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<Option[]>([]);
  const ids = selectedStudents.map((s) => s.id);
  const [searchTerm, setSearchTerm] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const [form, setForm] = useState({
    month: new Date().toISOString().slice(0, 7),
    due: new Date().toISOString().slice(0, 10),
    classId: "",
    kind: "CLASS",
    title: "",
    amount: 0,
    discount: 0,
    memo: "",
  });
  const [preview, setPreview] = useState<Preview | null>(null);
  const [requestId, setRequestId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const options = useQuery({
    queryKey: [
      "pay",
      identity,
      "create-options",
      searchTerm,
      studentStatus,
      classFilter,
      site,
      student?.id,
    ],
    queryFn: async () =>
      (
        await apiClient.get<Options>(base + "/options", {
          params: {
            q: searchTerm,
            studentStatus,
            classId: classFilter || undefined,
            site: site || undefined,
            studentId: student?.id,
          },
        })
      ).data,
    enabled: open,
  });
  useEffect(() => {
    setPreview(null);
    setRequestId(crypto.randomUUID());
  }, [form, selectedStudents]);
  useEffect(() => {
    if (open) {
      setSearch("");
      setSite(initialSite || "");
      setStudentStatus("ACTIVE");
      setSearchTerm("");
      setSelectedStudents(student ? [student] : []);
      setForm((old) => ({
        ...old,
        ...(month ? { month } : {}),
        // A class picked for another student may not apply to this one.
        ...(student ? { classId: "" } : {}),
      }));
      setPreview(null);
      setError("");
      setResult("");
    }
  }, [open, month, initialSite, student]);
  const invalid =
    !form.month || !form.due || !form.title.trim()
      ? tr("requiredFields")
      : form.discount > form.amount
        ? tr("discountOverAmount")
        : "";
  const items = () =>
    ids.map((studentId) => ({
      ...form,
      studentId,
      classId: form.classId || undefined,
    }));
  const act = async (commit: boolean) => {
    setBusy(true);
    setError("");
    try {
      if (commit) {
        const r = (
          await apiClient.post<{ ids: string[]; skipped: unknown[] }>(
            base + "/batch-create",
            {
              requestId,
              items:
                preview?.items
                  .filter((x) => !x.reason)
                  .map(({ studentName, existingId, reason, ...x }) => x) ||
                items(),
            },
          )
        ).data;
        setResult(
          `${tr("created")}: ${r.ids.length} / ${tr("skipped")}: ${r.skipped.length}`,
        );
        setPreview(null);
        if (!student) setSelectedStudents([]);
        await onSaved();
      } else
        setPreview(
          (
            await apiClient.post<Preview>(base + "/batch-preview", {
              requestId,
              items: items(),
            })
          ).data,
        );
    } catch (e) {
      const code = payErrorCode(e);
      setError(code ? tr(code) : tr("failed"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !busy) close();
      }}
    >
      <DialogContent className="max-w-4xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {student
              ? t("pay.createFor", {
                  name: [student.name, student.site]
                    .filter(Boolean)
                    .join(" · "),
                })
              : tr("create")}
          </DialogTitle>
        </DialogHeader>
        {!student && (
          <>
            <p className="text-sm">{tr("createHint")}</p>
            <div className="flex flex-wrap gap-2">
              <label>
                {tr("studentStatus")}
                <select
                  className={input}
                  value={studentStatus}
                  onChange={(e) => setStudentStatus(e.target.value)}
                >
                  {["ACTIVE", "ALL", "INACTIVE", "WITHDRAWN"].map((v) => (
                    <option key={v} value={v}>
                      {tr(v === "ALL" ? "all" : v)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {tr("student")}
                <input
                  className={input}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <label>
                {tr("site")}
                <input
                  className={input}
                  value={site}
                  onChange={(e) => {
                    setSite(e.target.value);
                    setSelectedStudents([]);
                  }}
                />
              </label>
              <label>
                {tr("enrolledClass")}
                <select
                  className={input}
                  value={classFilter}
                  onChange={(e) => {
                    setClassFilter(e.target.value);
                    setSelectedStudents([]);
                  }}
                >
                  <option value="">{tr("all")}</option>
                  {options.data?.classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="text-xs text-slate-500">
              {tr("filterResetsSelection")}
            </p>
            <div
              className="max-h-44 overflow-y-auto border rounded p-2"
              aria-live="polite"
            >
              {!search.trim() ? (
                <p>{tr("searchPrompt")}</p>
              ) : search.trim() !== searchTerm || options.isFetching ? (
                <p>{tr("loading")}</p>
              ) : options.isError ? (
                <button className={btn} onClick={() => options.refetch()}>
                  {tr("retry")}
                </button>
              ) : (
                <>
                  {options.data?.hasMore && <p>{tr("narrowSearch")}</p>}
                  {!options.data?.students.length && <p>{tr("noStudents")}</p>}
                  {options.data?.students.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between gap-2 py-1"
                    >
                      <span>
                        {s.name} · {s.site || tr("none")} ·{" "}
                        {tr(s.status || "ACTIVE")}{" "}
                        <span className="text-xs text-slate-500">
                          #{s.id.slice(0, 8)}
                        </span>
                      </span>
                      <button
                        className={btn}
                        disabled={
                          busy ||
                          s.status !== "ACTIVE" ||
                          ids.includes(s.id) ||
                          ids.length >= 100
                        }
                        onClick={() =>
                          setSelectedStudents((current) =>
                            current.some((x) => x.id === s.id) ||
                            current.length >= 100
                              ? current
                              : [...current, s],
                          )
                        }
                      >
                        {tr(
                          ids.includes(s.id) ? "studentSelected" : "addStudent",
                        )}
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>
            <section
              aria-label={tr("selectedStudents")}
              className="rounded border p-2"
            >
              <h3 className="font-medium">
                {tr("selectedStudents")} ({ids.length}/100)
              </h3>
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedStudents.map((s) => (
                  <span
                    key={s.id}
                    className="inline-flex items-center gap-2 rounded bg-slate-100 px-2 py-1"
                  >
                    {s.name} · {s.site || tr("none")} · #{s.id.slice(0, 8)}
                    <button
                      disabled={busy}
                      aria-label={`${tr("removeStudent")} ${s.name}`}
                      onClick={() =>
                        setSelectedStudents((current) =>
                          current.filter((x) => x.id !== s.id),
                        )
                      }
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </section>
          </>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {["month", "due", "title", "memo"].map((k) => (
            <label key={k}>
              {tr(k)}
              <input
                className={`${input} block w-full`}
                type={k === "month" ? "month" : k === "due" ? "date" : "text"}
                value={form[k as "title"]}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              />
            </label>
          ))}
          <label>
            {tr("classId")}
            <select
              className={`${input} block w-full`}
              value={form.classId}
              onChange={(e) => setForm({ ...form, classId: e.target.value })}
            >
              <option value="">{tr("none")}</option>
              {options.data?.classes.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {tr("kind")}
            <select
              className={input}
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value })}
            >
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {tr(k)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {tr("amount")}
            <Money
              label={tr("amount")}
              value={form.amount}
              onChange={(amount) => setForm({ ...form, amount })}
            />
          </label>
          <label>
            {tr("discount")}
            <Money
              label={tr("discount")}
              value={form.discount}
              onChange={(discount) => setForm({ ...form, discount })}
            />
          </label>
        </div>
        {invalid && <p className="text-sm text-amber-700">{invalid}</p>}
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
        {result && <p role="status">{result}</p>}
        {preview && (
          <div>
            <p>
              {tr("eligible")}: {preview.eligible}
            </p>
            {preview.items.map((x, i) => (
              <div key={i}>
                {x.studentName} ·{" "}
                {x.reason ? (
                  format(x.amount - x.discount)
                ) : (
                  <>
                    <Money
                      label={tr("amount")}
                      value={x.amount}
                      onChange={(amount) => {
                        setRequestId(crypto.randomUUID());
                        setPreview({
                          ...preview,
                          items: preview.items.map((row, j) =>
                            j === i ? { ...row, amount } : row,
                          ),
                        });
                      }}
                    />
                    <Money
                      label={tr("discount")}
                      value={x.discount}
                      onChange={(discount) => {
                        setRequestId(crypto.randomUUID());
                        setPreview({
                          ...preview,
                          items: preview.items.map((row, j) =>
                            j === i ? { ...row, discount } : row,
                          ),
                        });
                      }}
                    />
                  </>
                )}{" "}
                ·{" "}
                <span className={x.reason ? "text-red-700" : ""}>
                  {tr(x.reason || "eligible")}
                </span>
                {x.existingId && <span> ({tr("existing")})</span>}
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <button
            className={btn}
            disabled={busy || !ids.length || !!invalid}
            onClick={() => act(false)}
          >
            {tr("preview")}
          </button>
          <button
            className={btn}
            disabled={busy || !preview?.eligible}
            onClick={() => act(true)}
          >
            {tr("confirmCreate")}
          </button>
          <button className={btn} disabled={busy} onClick={close}>
            {tr("close")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
function DetailDialog({
  ids,
  readOnly,
  close,
  identity,
  admin,
  onSaved,
}: {
  /** The student's bills for the month (REQ-261027C); tabs when more than one. */
  ids: string[];
  /** Monthly list = history lookup only. */
  readOnly: boolean;
  close: () => void;
  identity: string;
  admin: boolean;
  onSaved: () => Promise<unknown>;
}) {
  const { t } = useTranslation("common");
  const tr = (s: string) => t(`pay.${s === "title" ? "billTitle" : s}`);
  const [id, setId] = useState(ids[0]);
  const detail = useQuery({
    queryKey: ["pay", identity, "detail", id],
    queryFn: async () => (await apiClient.get<Detail>(`${base}/${id}`)).data,
  });
  const [mode, setMode] = useState("PAYMENT");
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState("TRANSFER");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [originalId, setOriginal] = useState("");
  const [reduceBill, setReduce] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [requestId, setRequest] = useState(crypto.randomUUID());
  useEffect(
    () => setRequest(crypto.randomUUID()),
    [mode, amount, method, date, reason, originalId, reduceBill],
  );
  const save = async () => {
    if (!detail.data) return;
    setBusy(true);
    setError("");
    const common = { version: detail.data.bill.version, requestId, reason };
    try {
      if (mode === "ADJUSTMENT")
        await apiClient.post(`${base}/${id}/adjustments`, {
          ...common,
          amount,
        });
      else if (mode === "PAYMENT")
        await apiClient.post(`${base}/${id}/collections`, {
          ...common,
          amount,
          date,
          method,
        });
      else
        await apiClient.post(`${base}/${id}/refunds`, {
          ...common,
          amount,
          date,
          method,
          originalId,
          type: mode,
          reduceBill: mode === "REFUND" && reduceBill,
        });
      setAmount(0);
      setReason("");
      setRequest(crypto.randomUUID());
      await onSaved();
      await detail.refetch();
    } catch (e) {
      const msg = (
        e as { response?: { data?: { error?: { message?: string } } } }
      ).response?.data?.error?.message;
      setError(msg ? tr(msg) : tr("failed"));
    } finally {
      setBusy(false);
    }
  };
  const b = detail.data?.bill;
  // REQ-261027C — bill edit / cancel moved here from the removed bill-unit list.
  const [edit, setEdit] = useState<Edit | null>(null);
  const [editReason, setEditReason] = useState("");
  useEffect(() => {
    if (b)
      setEdit({
        id: b.id,
        version: b.version,
        amount: b.amount,
        discount: b.discount,
        due: b.due ?? "",
        title: b.title,
        memo: b.memo,
      });
    setEditReason("");
  }, [b]);
  const editBill = async (cancel: boolean) => {
    if (!edit || !b) return;
    setBusy(true);
    setError("");
    try {
      if (cancel)
        await apiClient.post(base + "/batch-state", {
          requestId: crypto.randomUUID(),
          reason: editReason,
          restore: false,
          items: [{ id: b.id, version: b.version }],
        });
      else
        await apiClient.patch(base + "/batch", {
          requestId: crypto.randomUUID(),
          reason: editReason,
          items: [{ ...edit, amount: edit.amount ?? 0 }],
        });
      await onSaved();
      if (cancel) close();
      else await detail.refetch();
    } catch (e) {
      const code = payErrorCode(e);
      setError(code ? tr(code) : tr("failed"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v && !busy) close();
      }}
    >
      <DialogContent className="max-w-3xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {tr("detail")} {b?.studentName} · {b?.month}
          </DialogTitle>
        </DialogHeader>
        {ids.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {ids.map((x, i) => (
              <button
                key={x}
                className={btn}
                aria-pressed={x === id}
                disabled={busy}
                onClick={() => setId(x)}
              >
                {tr("detail")} {i + 1}
              </button>
            ))}
          </div>
        )}
        {detail.isError ? (
          <button className={btn} onClick={() => detail.refetch()}>
            {tr("retry")}
          </button>
        ) : !b ? (
          <p>{tr("loading")}</p>
        ) : (
          <>
            <h3>{b.title}</h3>
            <p>
              {tr("net")}: {format(b.net)} / {tr("received")}:{" "}
              {format(b.received)} / {tr("unpaid")}: {format(b.unpaid)}
            </p>
            <h3>{tr("transactions")}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {[
                      "type",
                      "date",
                      "amount",
                      "method",
                      "reason",
                      "actor",
                    ].map((k) => (
                      <th key={k}>
                        {tr(k === "amount" ? "transactionAmount" : k)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detail.data?.collections.map((c) => (
                    <tr className="border-t" key={c.id}>
                      <td>{tr(c.type)}</td>
                      <td>{c.date}</td>
                      <td>{format(c.amount)}</td>
                      <td>{tr(c.method)}</td>
                      <td>{c.reason}</td>
                      <td>{c.actor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!readOnly && edit && b.state !== "CANCELED" && (
              <fieldset disabled={busy} className="rounded border p-3 space-y-2">
                <legend>{tr("editBill")}</legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="text-sm">
                    {tr("billTitle")}
                    <input
                      className={`${input} block w-full`}
                      value={edit.title}
                      onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                    />
                  </label>
                  <label className="text-sm">
                    {tr("due")}
                    <input
                      className={`${input} block w-full`}
                      type="date"
                      value={edit.due}
                      onChange={(e) => setEdit({ ...edit, due: e.target.value })}
                    />
                  </label>
                  <label className="text-sm">
                    {tr("amount")}{" "}
                    <Money
                      label={tr("amount")}
                      value={edit.amount ?? 0}
                      onChange={(amount) => setEdit({ ...edit, amount })}
                    />
                  </label>
                  <label className="text-sm">
                    {tr("discount")}{" "}
                    <Money
                      label={tr("discount")}
                      value={edit.discount}
                      onChange={(discount) => setEdit({ ...edit, discount })}
                    />
                  </label>
                  <label className="text-sm sm:col-span-2">
                    {tr("memo")}
                    <input
                      className={`${input} block w-full`}
                      value={edit.memo}
                      onChange={(e) => setEdit({ ...edit, memo: e.target.value })}
                    />
                  </label>
                </div>
                <input
                  className={`${input} w-full`}
                  aria-label={tr("reason")}
                  placeholder={tr("reason")}
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    className={btn}
                    disabled={
                      !editReason.trim() ||
                      !edit.title.trim() ||
                      !edit.due ||
                      edit.discount > (edit.amount ?? 0)
                    }
                    onClick={() => void editBill(false)}
                  >
                    {tr("saveEdit")}
                  </button>
                  {admin && (
                    <button
                      className={`${btn} text-red-700`}
                      disabled={!editReason.trim() || b.paid > 0}
                      onClick={() => {
                        if (window.confirm(tr("cancelConfirm"))) void editBill(true);
                      }}
                    >
                      {tr("cancelBill")}
                    </button>
                  )}
                </div>
              </fieldset>
            )}
            {!readOnly && b.state === "ACTIVE" && (
              <fieldset
                disabled={busy}
                className="rounded border p-3 space-y-2"
              >
                <legend>{tr("record")}</legend>
                <div className="flex flex-wrap gap-2">
                  <select
                    aria-label={tr("type")}
                    className={input}
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                  >
                    {[
                      "PAYMENT",
                      ...(admin ? ["REFUND", "REVERSAL", "ADJUSTMENT"] : []),
                    ].map((k) => (
                      <option key={k} value={k}>
                        {tr(k)}
                      </option>
                    ))}
                  </select>
                  <Money
                    signed={mode === "ADJUSTMENT"}
                    label={tr("transactionAmount")}
                    value={amount}
                    onChange={setAmount}
                  />
                  {mode === "PAYMENT" && (
                    <button
                      className={btn}
                      onClick={() => setAmount(b.unpaid ?? 0)}
                    >
                      {tr("balancePayment")}
                    </button>
                  )}
                  {mode !== "ADJUSTMENT" && (
                    <>
                      <input
                        className={input}
                        aria-label={tr("date")}
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                      />
                      <select
                        className={input}
                        aria-label={tr("method")}
                        value={method}
                        onChange={(e) => setMethod(e.target.value)}
                      >
                        {methods.map((m) => (
                          <option key={m} value={m}>
                            {tr(m)}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                  {["REFUND", "REVERSAL"].includes(mode) && (
                    <select
                      aria-label={tr("original")}
                      className={input}
                      value={originalId}
                      onChange={(e) => setOriginal(e.target.value)}
                    >
                      <option value="">{tr("original")}</option>
                      {detail.data?.collections
                        .filter((c) => c.type === "PAYMENT" && c.remaining > 0)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.date} · {tr(c.method)} · {format(c.remaining)}
                          </option>
                        ))}
                    </select>
                  )}
                  {mode === "REFUND" && (
                    <label>
                      <input
                        type="checkbox"
                        checked={reduceBill}
                        onChange={(e) => setReduce(e.target.checked)}
                      />
                      {tr("reduceBill")}
                    </label>
                  )}
                </div>
                {mode === "ADJUSTMENT" && (
                  <p className="text-sm">{tr("adjustHint")}</p>
                )}
                <input
                  className={`${input} w-full`}
                  aria-label={tr("reason")}
                  placeholder={tr("reason")}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <button
                  className={btn}
                  disabled={
                    !reason.trim() ||
                    amount === 0 ||
                    (["REFUND", "REVERSAL"].includes(mode) && !originalId)
                  }
                  onClick={save}
                >
                  {tr("record")}
                </button>
              </fieldset>
            )}
            {error && (
              <p role="alert" className="text-red-700">
                {error}
              </p>
            )}
            <h3>{tr("consultation")}</h3>
            <p className="text-sm">{tr("consultationHint")}</p>
            {detail.data?.consultation.map((c) => (
              <p key={c.id}>
                <Link className="underline" to={`/admin/csl/${c.id}`}>
                  {tr("consultation")}
                </Link>{" "}
                · {tr("transactionAmount")}: {format(Number(c.tuition || 0))} ·{" "}
                {tr("paid")}: {format(Number(c.paid || 0))} · {c.date}
              </p>
            ))}
            <h3>{tr("audit")}</h3>
            {detail.data?.audit.map((a) => (
              <details className="border-b py-2 text-sm" key={a.id}>
                <summary>
                  {new Date(a.createdAt).toLocaleString()} · {tr(a.action)} ·{" "}
                  {a.actor} · {a.reason === "CREATE" ? tr("CREATE") : a.reason}
                </summary>
                <AuditChanges before={a.before} after={a.after} />
              </details>
            ))}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
