import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Bill, Detail, Edit, Options, Page, Preview } from "./types";
const base = "/acm/pay/bills";
const input =
  "rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900";
const btn =
  "rounded border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-slate-100";
const format = (n: number) => new Intl.NumberFormat().format(n);
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
function Payments({ identity, admin }: { identity: string; admin: boolean }) {
  const { t } = useTranslation("common");
  const tr = (s: string) => t(`pay.${s === "title" ? "billTitle" : s}`);
  const qc = useQueryClient();
  const defaults = {
    basis: "MONTH",
    from: new Date().toISOString().slice(0, 7),
    to: new Date().toISOString().slice(0, 7),
    canceled: "false",
  };
  const [filters, setFilters] = useState<Record<string, string>>(defaults);
  const [query, setQuery] = useState<Record<string, string>>(defaults);
  const [page, setPage] = useState(1);
  const [advanced, setAdvanced] = useState(false);
  const [columns, setColumns] = useState<string[]>(() => {
    try {
      return JSON.parse(
        localStorage.getItem(`pay-columns:${identity}`) ||
          '["grade","site","kind","methods","paidDate","memo"]',
      );
    } catch {
      return ["grade", "site", "kind", "methods", "paidDate", "memo"];
    }
  });
  const [showColumns, setShowColumns] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, Edit>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [bulk, setBulk] = useState({ field: "discount", value: "" });
  const key = ["pay", identity];
  const data = useQuery({
    queryKey: [...key, query, page],
    queryFn: async () =>
      (await apiClient.get<Page>(base, { params: { ...query, page } })).data,
  });
  const options = useQuery({
    queryKey: [...key, "options"],
    queryFn: async () => (await apiClient.get<Options>(base + "/options")).data,
  });
  const dirty = Object.keys(drafts).length > 0;
  useEffect(() => {
    if (!dirty) return;
    const unload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const click = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest("a");
      if (a && !window.confirm(tr("discard"))) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", click, true);
    };
  }, [dirty, t]);
  useEffect(
    () => () => {
      qc.removeQueries({ queryKey: key });
    },
    [identity, qc],
  );
  const failure = (e: unknown) => {
    const response = (
      e as {
        response?: {
          data?: { error?: { message?: string | string[] }; message?: string };
        };
      }
    ).response?.data;
    const msg = response?.error?.message || response?.message;
    setError(
      typeof msg === "string"
        ? tr(msg)
        : Array.isArray(msg)
          ? msg.join(", ")
          : tr("failed"),
    );
  };
  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: key });
      setNotice(tr("saved"));
    } catch (e) {
      failure(e);
      await qc.invalidateQueries({ queryKey: key });
    } finally {
      setBusy(false);
    }
  };
  const edit = (b: Bill, patch: Partial<Edit>) =>
    setDrafts((d) => ({
      ...d,
      [b.id]: {
        ...(d[b.id] ?? {
          id: b.id,
          version: b.version,
          amount: b.amount,
          discount: b.discount,
          due: b.due,
          title: b.title,
          memo: b.memo,
        }),
        ...patch,
      },
    }));
  const applySearch = () => {
    if (dirty && !window.confirm(tr("discard"))) return;
    setDrafts({});
    setSelected([]);
    setQuery(
      Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== "")),
    );
    setPage(1);
  };
  const cancelSelected = () =>
    run(async () => {
      if (!reason.trim()) throw Error();
      await apiClient.post(base + "/batch-state", {
        requestId: crypto.randomUUID(),
        reason,
        restore: query.canceled === "true",
        items: (data.data?.items || [])
          .filter((b) => selected.includes(b.id))
          .map((b) => ({ id: b.id, version: b.version })),
      });
      setSelected([]);
    });
  const visible = (name: string) => columns.includes(name);
  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">
          {t("pay.title")} <span className="text-sm text-secondary">KRW</span>
        </h1>
        <button className={btn} onClick={() => setCreateOpen(true)}>
          {tr("create")}
        </button>
      </header>
      <p className="text-sm text-secondary">{tr("recordOnly")}</p>
      <div className="flex flex-wrap gap-3">
        {[
          "net",
          "received",
          "unpaid",
          "amount",
          "discount",
          "adjustment",
          "refunded",
          ...(query.basis === "PAYMENT" ? ["periodReceived"] : []),
        ].map((k) => (
          <div key={k} className="rounded border bg-white p-3">
            <div className="text-xs text-secondary">{tr(k)}</div>
            <strong>{format(data.data?.summary[k] ?? 0)}</strong>
          </div>
        ))}
      </div>
      <div className="rounded border bg-white p-3 space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <label>
            {tr("basis")}
            <select
              className={input}
              value={filters.basis}
              onChange={(e) => {
                const basis = e.target.value;
                setFilters({
                  ...filters,
                  basis,
                  from:
                    basis === "MONTH"
                      ? filters.from.slice(0, 7)
                      : filters.from.slice(0, 7) + "-01",
                  to:
                    basis === "MONTH"
                      ? filters.to.slice(0, 7)
                      : filters.to.slice(0, 7) + "-28",
                });
              }}
            >
              {["MONTH", "PAYMENT"].map((v) => (
                <option key={v} value={v}>
                  {tr(v)}
                </option>
              ))}
            </select>
          </label>
          {["from", "to"].map((k) => (
            <label key={k}>
              {tr(k)}
              <input
                className={input}
                type={filters.basis === "MONTH" ? "month" : "date"}
                value={filters[k]}
                onChange={(e) =>
                  setFilters({ ...filters, [k]: e.target.value })
                }
              />
            </label>
          ))}
          <label>
            <input
              type="checkbox"
              checked={filters.previous === "true"}
              disabled={filters.basis !== "MONTH"}
              onChange={(e) =>
                setFilters({ ...filters, previous: String(e.target.checked) })
              }
            />
            {tr("previous")}
          </label>
          <label>
            {tr("student")}
            <input
              className={input}
              value={filters.q || ""}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            />
          </label>
          <label>
            {tr("status")}
            <select
              className={input}
              value={filters.status || ""}
              onChange={(e) =>
                setFilters({ ...filters, status: e.target.value })
              }
            >
              <option value="">{tr("all")}</option>
              {["UNPAID", "PARTIAL", "PAID", "OVERDUE", "FREE"].map((v) => (
                <option key={v} value={v}>
                  {tr(v)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={filters.canceled === "true"}
              onChange={(e) =>
                setFilters({ ...filters, canceled: String(e.target.checked) })
              }
            />
            {tr("canceled")}
          </label>
          <button className={btn} onClick={() => setAdvanced(!advanced)}>
            {tr("advanced")}
          </button>
        </div>
        {advanced && (
          <div className="flex flex-wrap gap-2">
            {["school", "grade", "site", "memo"].map((k) => (
              <label key={k}>
                {tr(k)}
                <input
                  className={input}
                  value={filters[k] || ""}
                  onChange={(e) =>
                    setFilters({ ...filters, [k]: e.target.value })
                  }
                />
              </label>
            ))}
            {[
              ["studentStatus", ["ACTIVE", "INACTIVE", "WITHDRAWN"]],
              ["kind", kinds],
              ["method", methods],
            ].map(([k, values]) => (
              <label key={k as string}>
                {tr(k as string)}
                <select
                  className={input}
                  value={filters[k as string] || ""}
                  onChange={(e) =>
                    setFilters({ ...filters, [k as string]: e.target.value })
                  }
                >
                  <option value="">{tr("all")}</option>
                  {(values as string[]).map((v) => (
                    <option value={v} key={v}>
                      {tr(v)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            {(["classId", "teacherId"] as const).map((k) => (
              <label key={k}>
                {tr(k)}
                <select
                  className={input}
                  value={filters[k] || ""}
                  onChange={(e) =>
                    setFilters({ ...filters, [k]: e.target.value })
                  }
                >
                  <option value="">{tr("all")}</option>
                  {(k === "classId"
                    ? options.data?.classes
                    : options.data?.teachers
                  )?.map((v) => (
                    <option value={v.id} key={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            {["dueFrom", "dueTo"].map((k) => (
              <label key={k}>
                {tr(k)}
                <input
                  type="date"
                  className={input}
                  value={filters[k] || ""}
                  onChange={(e) =>
                    setFilters({ ...filters, [k]: e.target.value })
                  }
                />
              </label>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <button className={btn} onClick={applySearch}>
            {tr("search")}
          </button>
          <button className={btn} onClick={() => setFilters(defaults)}>
            {tr("reset")}
          </button>
          <button
            className={btn}
            onClick={() => {
              localStorage.setItem(
                `pay-filter:${identity}`,
                JSON.stringify(filters),
              );
              setNotice(tr("saved"));
            }}
          >
            {tr("saveFilter")}
          </button>
          <button
            className={btn}
            onClick={() => {
              try {
                const saved = JSON.parse(
                  localStorage.getItem(`pay-filter:${identity}`) || "null",
                );
                if (saved) setFilters(saved);
              } catch {
                setError(tr("failed"));
              }
            }}
          >
            {tr("loadFilter")}
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-emerald-700">
          {notice}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button className={btn} onClick={() => setShowColumns(!showColumns)}>
          {tr("columns")}
        </button>
        <button
          className={btn}
          disabled={busy}
          onClick={() =>
            run(async () => {
              const r = await apiClient.get(base + "/export", {
                params: query,
                responseType: "blob",
              });
              const url = URL.createObjectURL(r.data);
              const a = document.createElement("a");
              a.href = url;
              a.download = "collections.xlsx";
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            })
          }
        >
          {tr("export")}
        </button>
        <select
          className={input}
          value={bulk.field}
          onChange={(e) => setBulk({ ...bulk, field: e.target.value })}
        >
          {["amount", "discount", "due", "memo"].map((v) => (
            <option key={v} value={v}>
              {tr(v)}
            </option>
          ))}
        </select>
        <input
          aria-label={tr("bulkValue")}
          className={input}
          value={bulk.value}
          onChange={(e) => setBulk({ ...bulk, value: e.target.value })}
        />
        <button
          className={btn}
          disabled={!selected.length || query.canceled === "true"}
          onClick={() => {
            const numeric = ["amount", "discount"].includes(bulk.field);
            const n = Number(bulk.value.replace(/,/g, ""));
            if (
              numeric &&
              (!Number.isSafeInteger(n) || n < 0 || n > 50000000)
            ) {
              setError(tr("PAY_INVALID_AMOUNT"));
              return;
            }
            data.data?.items
              .filter((b) => selected.includes(b.id))
              .forEach((b) =>
                edit(b, { [bulk.field]: numeric ? n : bulk.value }),
              );
          }}
        >
          {tr("bulkApply")}
        </button>
        <input
          className={input}
          placeholder={tr("reason")}
          aria-label={tr("reason")}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <button
          className={btn}
          disabled={!dirty || busy || !reason.trim()}
          onClick={() =>
            run(async () => {
              await apiClient.patch(base + "/batch", {
                requestId: crypto.randomUUID(),
                reason,
                items: Object.values(drafts),
              });
              setDrafts({});
            })
          }
        >
          {tr("save")} ({Object.keys(drafts).length})
        </button>
        {admin && (
          <button
            className={btn}
            disabled={!selected.length || busy || !reason.trim()}
            onClick={cancelSelected}
          >
            {tr(query.canceled === "true" ? "restore" : "cancelBill")}
          </button>
        )}
      </div>
      {showColumns && (
        <div>
          {["grade", "site", "kind", "methods", "paidDate", "memo"].map((k) => (
            <label className="mr-3" key={k}>
              <input
                type="checkbox"
                checked={visible(k)}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...columns, k]
                    : columns.filter((x) => x !== k);
                  setColumns(next);
                  localStorage.setItem(
                    `pay-columns:${identity}`,
                    JSON.stringify(next),
                  );
                }}
              />
              {tr(k)}
            </label>
          ))}
        </div>
      )}
      {data.isError ? (
        <button className={btn} onClick={() => data.refetch()}>
          {tr("retry")}
        </button>
      ) : data.isPending ? (
        <p>{tr("loading")}</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded border">
            <table className="min-w-max w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th>
                    <input
                      aria-label={tr("selectAll")}
                      type="checkbox"
                      checked={
                        !!data.data.items.length &&
                        data.data.items.every((b) => selected.includes(b.id))
                      }
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? data.data.items.map((b) => b.id)
                            : [],
                        )
                      }
                    />
                  </th>
                  {[
                    "student",
                    "grade",
                    "site",
                    "month",
                    "due",
                    "kind",
                    "title",
                    "amount",
                    "discount",
                    "adjustment",
                    "received",
                    "unpaid",
                    "status",
                    "methods",
                    "paidDate",
                    "memo",
                    "detail",
                  ]
                    .filter(
                      (k) =>
                        ![
                          "grade",
                          "site",
                          "kind",
                          "methods",
                          "paidDate",
                          "memo",
                        ].includes(k) || visible(k),
                    )
                    .map((k) => (
                      <th key={k} className="p-2 text-left">
                        {tr(k)}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {data.data.items.map((b) => {
                  const d = drafts[b.id];
                  const disabled = b.state === "CANCELED" || busy;
                  return (
                    <tr
                      key={b.id}
                      className={`border-t ${d ? "bg-amber-50" : "bg-white"}`}
                    >
                      <td className="p-2">
                        <input
                          aria-label={`${tr("select")} ${b.studentName}`}
                          type="checkbox"
                          checked={selected.includes(b.id)}
                          onChange={(e) =>
                            setSelected(
                              e.target.checked
                                ? [...selected, b.id]
                                : selected.filter((id) => id !== b.id),
                            )
                          }
                        />
                      </td>
                      <td className="p-2">
                        <Link to={`/admin/std/${b.studentId}`}>
                          {b.studentName}
                        </Link>
                      </td>
                      {visible("grade") && <td>{b.grade}</td>}
                      {visible("site") && <td>{b.site}</td>}
                      <td>{b.month}</td>
                      <td>
                        <input
                          aria-label={tr("due")}
                          className={input}
                          type="date"
                          disabled={disabled}
                          value={d?.due ?? b.due}
                          onChange={(e) => edit(b, { due: e.target.value })}
                        />
                      </td>
                      {visible("kind") && <td>{tr(b.kind)}</td>}
                      <td>
                        <input
                          aria-label={tr("title")}
                          className={input}
                          disabled={disabled}
                          value={d?.title ?? b.title}
                          onChange={(e) => edit(b, { title: e.target.value })}
                        />
                      </td>
                      <td>
                        <fieldset disabled={disabled}>
                          <Money
                            label={tr("amount")}
                            value={d?.amount ?? b.amount}
                            onChange={(amount) => edit(b, { amount })}
                          />
                        </fieldset>
                      </td>
                      <td>
                        <fieldset disabled={disabled}>
                          <Money
                            label={tr("discount")}
                            value={d?.discount ?? b.discount}
                            onChange={(discount) => edit(b, { discount })}
                          />
                        </fieldset>
                      </td>
                      <td>{format(b.adjustment)}</td>
                      <td>{format(b.received)}</td>
                      <td className={b.unpaid ? "text-red-700" : ""}>
                        {format(b.unpaid)}
                      </td>
                      <td>
                        {tr(b.status)}
                        {b.unpaid > 0 && b.due < data.data.today && (
                          <span className="block text-red-700">
                            {tr("OVERDUE")}
                          </span>
                        )}
                      </td>
                      {visible("methods") && (
                        <td>{b.methods.map(tr).join(", ")}</td>
                      )}
                      {visible("paidDate") && <td>{b.paidDate}</td>}
                      {visible("memo") && (
                        <td>
                          <input
                            className={input}
                            aria-label={tr("memo")}
                            disabled={disabled}
                            value={d?.memo ?? b.memo}
                            onChange={(e) => edit(b, { memo: e.target.value })}
                          />
                        </td>
                      )}
                      <td>
                        <button
                          className={btn}
                          onClick={() => setDetailId(b.id)}
                        >
                          {tr("detail")}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!data.data.items.length && <p>{tr("empty")}</p>}
          <div className="flex gap-3 items-center">
            <span>
              {tr("count")}: {data.data.summary.count}
            </span>
            <button
              className={btn}
              disabled={page === 1 || dirty}
              onClick={() => {
                setPage(page - 1);
                setSelected([]);
              }}
            >
              {tr("prev")}
            </button>
            <span>{page}</span>
            <button
              className={btn}
              disabled={page * 50 >= data.data.summary.count || dirty}
              onClick={() => {
                setPage(page + 1);
                setSelected([]);
              }}
            >
              {tr("next")}
            </button>
          </div>
        </>
      )}
      <CreateDialog
        open={createOpen}
        close={() => setCreateOpen(false)}
        identity={identity}
        onSaved={() => qc.invalidateQueries({ queryKey: key })}
      />
      {detailId && (
        <DetailDialog
          id={detailId}
          close={() => setDetailId(null)}
          identity={identity}
          admin={admin}
          onSaved={() => qc.invalidateQueries({ queryKey: key })}
        />
      )}
    </section>
  );
}
function CreateDialog({
  open,
  close,
  identity,
  onSaved,
}: {
  open: boolean;
  close: () => void;
  identity: string;
  onSaved: () => Promise<unknown>;
}) {
  const { t } = useTranslation("common");
  const tr = (s: string) => t(`pay.${s === "title" ? "billTitle" : s}`);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [site, setSite] = useState("");
  const [ids, setIds] = useState<string[]>([]);
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
    queryKey: ["pay", identity, "create-options", search, classFilter, site],
    queryFn: async () =>
      (
        await apiClient.get<Options>(base + "/options", {
          params: {
            q: search,
            classId: classFilter || undefined,
            site: site || undefined,
          },
        })
      ).data,
    enabled: open,
  });
  useEffect(() => {
    setPreview(null);
    setRequestId(crypto.randomUUID());
  }, [form, ids]);
  useEffect(() => {
    if (open) {
      setIds([]);
      setPreview(null);
      setError("");
      setResult("");
    }
  }, [open]);
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
        setIds([]);
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
    } catch {
      setError(tr("failed"));
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tr("create")}</DialogTitle>
        </DialogHeader>
        <p className="text-sm">{tr("createHint")}</p>
        <div className="flex flex-wrap gap-2">
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
                setIds([]);
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
                setIds([]);
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
        {options.isError && (
          <button onClick={() => options.refetch()}>{tr("retry")}</button>
        )}
        {options.data?.hasMore && <p>{tr("narrowSearch")}</p>}
        <div className="max-h-44 overflow-y-auto border p-2">
          <button
            className={btn}
            onClick={() =>
              setIds(
                [
                  ...new Set([
                    ...ids,
                    ...(options.data?.students
                      .filter((s) => s.status === "ACTIVE")
                      .map((s) => s.id) || []),
                  ]),
                ].slice(0, 100),
              )
            }
          >
            {tr("selectAll")}
          </button>
          <button className={btn} onClick={() => setIds([])}>
            {tr("clear")}
          </button>
          <span> {ids.length}/100</span>
          {options.data?.students.map((s) => (
            <label key={s.id} className="block">
              <input
                type="checkbox"
                disabled={s.status !== "ACTIVE"}
                checked={ids.includes(s.id)}
                onChange={(e) =>
                  setIds(
                    e.target.checked
                      ? [...ids, s.id].slice(0, 100)
                      : ids.filter((id) => id !== s.id),
                  )
                }
              />
              {s.name} · {s.site} · {tr(s.status || "ACTIVE")}
            </label>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
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
                · {tr(x.reason || "eligible")}
                {x.existingId && <span> ({tr("existing")})</span>}
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <button
            className={btn}
            disabled={busy || !ids.length || !form.title.trim()}
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
  id,
  close,
  identity,
  admin,
  onSaved,
}: {
  id: string;
  close: () => void;
  identity: string;
  admin: boolean;
  onSaved: () => Promise<unknown>;
}) {
  const { t } = useTranslation("common");
  const tr = (s: string) => t(`pay.${s === "title" ? "billTitle" : s}`);
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
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v && !busy) close();
      }}
    >
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {tr("detail")} {b?.studentName} · {b?.month}
          </DialogTitle>
        </DialogHeader>
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
            {b.state === "ACTIVE" && (
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
                    <button className={btn} onClick={() => setAmount(b.unpaid)}>
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
