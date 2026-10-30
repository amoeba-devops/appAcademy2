import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiClient } from "@/lib/api-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Bill, Page } from "./types";
import { BILL_KINDS, payErrorCode, type ImportData } from "./bill-import";

const base = "/acm/pay/bills";
const input =
  "rounded border border-slate-300 bg-white px-2 py-1.5 text-base md:text-sm text-slate-900";
const btn =
  "min-h-9 rounded border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-slate-100";
const format = (n: number | null) =>
  n === null ? "—" : new Intl.NumberFormat().format(n);

function MoneyInput({
  value,
  onChange,
  label,
  onCommit,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  label: string;
  /** Enter or leaving the field (REQ-261030B instant save). */
  onCommit?: () => void;
}) {
  const [text, setText] = useState(value === null ? "" : format(value));
  useEffect(() => setText(value === null ? "" : format(value)), [value]);
  return (
    <input
      className={`${input} w-28 text-right`}
      aria-label={label}
      inputMode="numeric"
      value={text}
      onBlur={onCommit}
      onKeyDown={(e) => {
        if (e.key === "Enter" && onCommit) {
          e.preventDefault();
          onCommit();
        }
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d]/g, "");
        if (raw === "") {
          setText("");
          onChange(null);
          return;
        }
        const n = Number(raw);
        if (n <= 50000000) {
          setText(format(n));
          onChange(n);
        }
      }}
    />
  );
}

interface Draft {
  kind: string;
  title: string;
  amount: number | null;
  discount: number | null;
  due: string;
  memo: string;
}
const draftOf = (b: Bill): Draft => ({
  kind: b.kind,
  title: b.title,
  amount: b.amount,
  discount: b.discount,
  due: b.due ?? "",
  memo: b.memo,
});
const omit = <T,>(o: Record<string, T>, key: string) => {
  const next = { ...o };
  delete next[key];
  return next;
};
const sameDraft = (a: Draft, b: Draft) =>
  (Object.keys(a) as (keyof Draft)[]).every(
    (k) => (a[k] ?? null) === (b[k] ?? null),
  );

/**
 * REQ-261030 — one student's bills for a month: quick add (kind + amount), per-line
 * edit/save and delete. Payments/refunds/history stay in the record dialog (`onRecord`).
 */
export function BillEditDialog({
  student,
  month,
  defaultDue,
  createOnly,
  identity,
  close,
  onSaved,
  onRecord,
}: {
  student: { id: string; name: string };
  month: string;
  defaultDue: string;
  /** REQ-261030B — a student without bills: save the new bill and close. */
  createOnly: boolean;
  identity: string;
  close: () => void;
  onSaved: () => Promise<unknown>;
  onRecord: (billId: string) => void;
}) {
  const { t } = useTranslation("common");
  const tr = (s: string, o?: Record<string, unknown>) => t(`pay.${s}`, o);
  const bills = useQuery({
    queryKey: ["pay", identity, "student-bills", student.id, month],
    queryFn: async () =>
      (
        await apiClient.get<Page>(base, {
          params: {
            basis: "MONTH",
            from: month,
            to: month,
            studentId: student.id,
          },
        })
      ).data.items,
  });
  const importData = useQuery({
    queryKey: ["pay", identity, "import-data"],
    queryFn: async () =>
      (
        await apiClient.get<ImportData>(base + "/import-data", {
          params: { site: "ALL" },
        })
      ).data,
  });
  const own =
    importData.data?.students.find((s) => s.id === student.id)?.classes ?? [];
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const items = bills.data ?? [];
  const autoTitle = (kind: string) =>
    tr("quick.autoTitle", {
      m: Number(month.slice(5)),
      ym: month,
      kind: tr(kind),
    });
  // Quick add — kind and amount are the only required inputs.
  const firstKind = items.some((b) => b.kind === "CLASS") ? "BOOK" : "CLASS";
  const [add, setAdd] = useState<
    Draft & { classId: string; titleEdited: boolean }
  >({
    kind: "CLASS",
    title: "",
    amount: null,
    discount: null,
    due: defaultDue,
    memo: "",
    classId: "",
    titleEdited: false,
  });
  const [more, setMore] = useState(false);
  const [kindTouched, setKindTouched] = useState(false);
  useEffect(() => {
    if (bills.isSuccess && !kindTouched)
      setAdd((a) => ({ ...a, kind: firstKind }));
  }, [bills.isSuccess, firstKind, kindTouched]);
  useEffect(() => {
    if (own.length === 1)
      setAdd((a) => (a.classId ? a : { ...a, classId: own[0].id }));
  }, [own]);
  const addTitle = add.titleEdited ? add.title : autoTitle(add.kind);

  const running = useRef(false);
  const run = async (job: () => Promise<void>, done: string) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await job();
      await Promise.all([onSaved(), bills.refetch()]);
      setNotice(done);
    } catch (e) {
      const code = payErrorCode(e);
      setError(code ? tr(code) : tr("failed"));
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  const create = () =>
    run(async () => {
      const r = (
        await apiClient.post<{ ids: string[]; skipped: { reason: string }[] }>(
          base + "/batch-create",
          {
            requestId: crypto.randomUUID(),
            items: [
              {
                studentId: student.id,
                classId: add.classId || undefined,
                month,
                due: add.due,
                kind: add.kind,
                title: addTitle.trim(),
                amount: add.amount ?? 0,
                discount: add.discount ?? 0,
                memo: add.memo,
              },
            ],
          },
        )
      ).data;
      if (!r.ids.length)
        throw {
          response: { data: { error: { message: "PAY_DUPLICATE_BILL" } } },
        };
      if (createOnly) {
        await onSaved();
        close();
        return;
      }
      setAdd((a) => ({
        ...a,
        amount: null,
        discount: null,
        memo: "",
        title: "",
        titleEdited: false,
      }));
      setKindTouched(false);
      setMore(false);
    }, tr("quick.created"));
  const save = (b: Bill) => {
    const d = drafts[b.id];
    if (!d) return;
    return run(async () => {
      await apiClient.patch(base + "/batch", {
        requestId: crypto.randomUUID(),
        reason: reason.trim() || tr("quick.editReason"),
        items: [
          {
            id: b.id,
            version: b.version,
            kind: d.kind,
            title: d.title.trim(),
            amount: d.amount ?? 0,
            discount: d.discount ?? 0,
            due: d.due || defaultDue,
            memo: d.memo,
          },
        ],
      });
      setDrafts((old) => omit(old, b.id));
    }, tr("quick.saved"));
  };
  const remove = (b: Bill) => {
    if (!window.confirm(tr("quick.deleteConfirm", { title: b.title }))) return;
    return run(async () => {
      await apiClient.post(`${base}/${b.id}/delete`, {
        requestId: crypto.randomUUID(),
        version: b.version,
        reason: reason.trim() || tr("quick.deleteReason"),
      });
      setDrafts((old) => omit(old, b.id));
    }, tr("quick.deleted"));
  };
  const dirty = Object.keys(drafts).length > 0;
  const tryClose = () => {
    if (busy) return;
    if (dirty && !window.confirm(tr("discard"))) return;
    close();
  };
  const invalid = (d: Draft) =>
    d.amount === null ||
    !d.title.trim() ||
    !(d.due || defaultDue) ||
    (d.discount ?? 0) > d.amount;

  return (
    <Dialog open onOpenChange={(v) => !v && tryClose()}>
      <DialogContent className="max-w-3xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {tr("quick.title", {
              name: student.name,
              month,
              count: items.length,
            })}
          </DialogTitle>
        </DialogHeader>
        {bills.isError ? (
          <button className={btn} onClick={() => bills.refetch()}>
            {tr("retry")}
          </button>
        ) : bills.isPending ? (
          <p role="status">{tr("loading")}</p>
        ) : (
          <fieldset disabled={busy} className="space-y-3">
            {items.length > 0 && (
              <ul className="divide-y rounded border">
                {items.map((b) => {
                  const d = drafts[b.id] ?? draftOf(b);
                  const set = (patch: Partial<Draft>) =>
                    setDrafts((old) => {
                      const next = { ...d, ...patch };
                      const rest = { ...old };
                      if (sameDraft(next, draftOf(b))) delete rest[b.id];
                      else rest[b.id] = next;
                      return rest;
                    });
                  const changed = !!drafts[b.id];
                  return (
                    <li
                      key={b.id}
                      className={`space-y-2 p-3 ${changed ? "bg-amber-50" : ""}`}
                    >
                      <div className="flex flex-wrap items-end gap-2">
                        <label className="text-xs">
                          <span className="block">{tr("kind")}</span>
                          <select
                            className={input}
                            value={d.kind}
                            onChange={(e) =>
                              set({
                                kind: e.target.value,
                                // Keep an auto title in step with the kind.
                                ...(d.title === autoTitle(d.kind)
                                  ? { title: autoTitle(e.target.value) }
                                  : {}),
                              })
                            }
                          >
                            {BILL_KINDS.map((k) => (
                              <option key={k} value={k}>
                                {tr(k)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="min-w-40 flex-1 text-xs">
                          <span className="block">{tr("billTitle")}</span>
                          <input
                            className={`${input} w-full`}
                            value={d.title}
                            onChange={(e) => set({ title: e.target.value })}
                          />
                        </label>
                        <label className="text-xs">
                          <span className="block">{tr("amount")}</span>
                          <MoneyInput
                            label={tr("amount")}
                            value={d.amount}
                            onChange={(amount) => set({ amount })}
                            onCommit={
                              b.state === "DRAFT"
                                ? () => {
                                    if (drafts[b.id] && !invalid(d))
                                      void save(b);
                                  }
                                : undefined
                            }
                          />
                        </label>
                        <label className="text-xs">
                          <span className="block">{tr("discount")}</span>
                          <MoneyInput
                            label={tr("discount")}
                            value={d.discount}
                            onChange={(discount) => set({ discount })}
                          />
                        </label>
                        <label className="text-xs">
                          <span className="block">{tr("due")}</span>
                          <input
                            className={input}
                            type="date"
                            value={d.due}
                            onChange={(e) => set({ due: e.target.value })}
                          />
                        </label>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-secondary">
                          {tr("received")} {format(b.received)} · {tr("unpaid")}{" "}
                          {format(b.unpaid)}
                        </span>
                        <span className="ml-auto flex flex-wrap gap-2">
                          {b.state === "ACTIVE" && (
                            <button
                              className={btn}
                              disabled={changed}
                              title={
                                changed ? tr("quick.saveFirst") : undefined
                              }
                              onClick={() => onRecord(b.id)}
                            >
                              {tr("quick.record")}
                            </button>
                          )}
                          <button
                            className={`${btn} ${changed ? "border-amber-500 font-semibold" : ""}`}
                            disabled={!changed || invalid(d)}
                            onClick={() => void save(b)}
                          >
                            {tr("quick.save")}
                          </button>
                          {changed && (
                            <button
                              className={btn}
                              onClick={() =>
                                setDrafts((old) => omit(old, b.id))
                              }
                            >
                              {tr("quick.undo")}
                            </button>
                          )}
                          <button
                            className={`${btn} text-red-700`}
                            disabled={b.paid > 0}
                            title={
                              b.paid > 0 ? tr("quick.deleteBlocked") : undefined
                            }
                            onClick={() => void remove(b)}
                          >
                            {tr("quick.delete")}
                          </button>
                        </span>
                      </div>
                      {b.paid > 0 && (
                        <p className="text-xs text-secondary">
                          {tr("quick.deleteBlocked")}
                        </p>
                      )}
                      {d.discount !== null &&
                        d.amount !== null &&
                        d.discount > d.amount && (
                          <p className="text-xs text-red-700">
                            {tr("discountOverAmount")}
                          </p>
                        )}
                    </li>
                  );
                })}
              </ul>
            )}
            <section
              aria-label={tr("quick.add")}
              className="space-y-2 rounded border border-dashed p-3"
            >
              {!createOnly && (
                <h3 className="text-sm font-semibold">{tr("quick.add")}</h3>
              )}
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-xs">
                  <span className="block">{tr("kind")}</span>
                  <select
                    className={input}
                    value={add.kind}
                    onChange={(e) => {
                      setKindTouched(true);
                      setAdd({ ...add, kind: e.target.value });
                    }}
                  >
                    {BILL_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {tr(k)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs">
                  <span className="block">{tr("amount")}</span>
                  <MoneyInput
                    label={tr("amount")}
                    value={add.amount}
                    onChange={(amount) => setAdd({ ...add, amount })}
                  />
                </label>
                <label className="text-xs">
                  <span className="block">{tr("discount")}</span>
                  <MoneyInput
                    label={tr("discount")}
                    value={add.discount}
                    onChange={(discount) => setAdd({ ...add, discount })}
                  />
                </label>
                <label className="text-xs">
                  <span className="block">{tr("due")}</span>
                  <input
                    className={input}
                    type="date"
                    value={add.due}
                    onChange={(e) => setAdd({ ...add, due: e.target.value })}
                  />
                </label>
                <button
                  className={`${btn} bg-slate-900 text-white hover:bg-slate-700`}
                  disabled={
                    add.amount === null ||
                    !add.due ||
                    !addTitle.trim() ||
                    (add.discount ?? 0) > add.amount
                  }
                  onClick={() => void create()}
                >
                  {tr(createOnly ? "quick.save" : "quick.create")}
                </button>
              </div>
              <button
                className="text-xs underline"
                aria-expanded={more}
                onClick={() => setMore(!more)}
              >
                {more ? "▾" : "▸"} {tr("quick.more")}
              </button>
              {more && (
                <div className="flex flex-wrap items-end gap-2">
                  <label className="min-w-40 flex-1 text-xs">
                    <span className="block">{tr("billTitle")}</span>
                    <input
                      className={`${input} w-full`}
                      value={addTitle}
                      onChange={(e) =>
                        setAdd({
                          ...add,
                          title: e.target.value,
                          titleEdited: true,
                        })
                      }
                    />
                  </label>
                  <label className="text-xs">
                    <span className="block">{tr("classId")}</span>
                    <select
                      className={input}
                      value={add.classId}
                      onChange={(e) =>
                        setAdd({ ...add, classId: e.target.value })
                      }
                    >
                      <option value="">{tr("none")}</option>
                      {own.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="min-w-40 flex-1 text-xs">
                    <span className="block">{tr("memo")}</span>
                    <input
                      className={`${input} w-full`}
                      value={add.memo}
                      onChange={(e) => setAdd({ ...add, memo: e.target.value })}
                    />
                  </label>
                </div>
              )}
            </section>
            {items.length > 0 && (
              <label className="block text-xs">
                <span className="block">{tr("quick.reason")}</span>
                <input
                  className={`${input} w-full`}
                  value={reason}
                  placeholder={tr("quick.reasonHint")}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
            )}
          </fieldset>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="text-sm text-emerald-700">
            {notice}
          </p>
        )}
        <div className="flex justify-end">
          <button className={btn} disabled={busy} onClick={tryClose}>
            {tr(createOnly ? "quick.cancel" : "close")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
