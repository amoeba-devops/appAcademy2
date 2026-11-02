import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiClient } from "@/lib/api-client";
import type { MonthlyStudentRow } from "./monthly-types";
import type { Page } from "./types";
import { payErrorCode, type ImportData } from "./bill-import";

const base = "/acm/pay/bills";
const small =
  "min-h-9 rounded border border-slate-300 bg-white px-2 py-1 text-base md:text-sm";
const format = (n: number | null) => (n === null ? "—" : n.toLocaleString());
const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(
    new Date(),
  );

/**
 * REQ-261102 — monthly list amount cell: click to type the bill amount only.
 * No bill → a tuition bill is created; one bill → its amount is changed;
 * several bills → the bill dialog opens (`onMulti`).
 */
export function QuickAmount({
  row,
  month,
  identity,
  editing,
  setEditing,
  onMulti,
}: {
  row: MonthlyStudentRow;
  month: string;
  identity: string;
  editing: boolean;
  setEditing: (on: boolean) => void;
  onMulti: () => void;
}) {
  const { t } = useTranslation("common");
  const qc = useQueryClient();
  const current = row.bill ? row.bill.amount : null;
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const start = () => {
    if (row.billCount > 1) return onMulti();
    setText(current === null ? "" : format(current));
    setError("");
    setEditing(true);
  };
  const commit = async () => {
    if (busy) return;
    const raw = text.replace(/[^\d]/g, "");
    const amount = raw === "" ? null : Number(raw);
    if (amount === null || amount === current) return setEditing(false);
    setBusy(true);
    try {
      if (row.bill) {
        const b = row.bill;
        if (b.discount > amount) throw new Error("discountOverAmount");
        await apiClient.patch(base + "/batch", {
          requestId: crypto.randomUUID(),
          reason: t("pay.quick.editReason"),
          items: [
            {
              id: b.id,
              version: b.version,
              amount,
              discount: b.discount,
              due: b.due ?? `${month}-10`,
              title: b.title,
              memo: b.memo,
            },
          ],
        });
      } else {
        const data = await qc.fetchQuery({
          queryKey: ["pay", identity, "import-data"],
          queryFn: async () =>
            (
              await apiClient.get<ImportData>(base + "/import-data", {
                params: { site: "ALL" },
              })
            ).data,
        });
        const own = data.students.find((s) => s.id === row.id)?.classes ?? [];
        const r = (
          await apiClient.post<{ ids: string[] }>(base + "/batch-create", {
            requestId: crypto.randomUUID(),
            items: [
              {
                studentId: row.id,
                classId: own.length === 1 ? own[0].id : undefined,
                month,
                due: `${month}-10`,
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
        if (!r.ids.length) throw new Error("PAY_DUPLICATE_BILL");
      }
      setEditing(false);
      await qc.invalidateQueries({ queryKey: ["pay", identity] });
    } catch (e) {
      const code =
        payErrorCode(e) ?? (e instanceof Error ? e.message : "failed");
      setError(t(`pay.${code}`, { defaultValue: t("pay.failed") }));
    } finally {
      setBusy(false);
    }
  };
  if (!editing)
    return (
      <button
        className="w-[11ch] rounded px-1 text-right tabular-nums hover:bg-slate-100 focus:bg-slate-100"
        aria-label={`${t("payMonthly.amount")} ${row.name}`}
        onClick={start}
      >
        {format(row.amount)}
      </button>
    );
  return (
    <span className="inline-flex flex-col items-end">
      <input
        autoFocus
        className={`${small} w-[13ch] text-right tabular-nums`}
        aria-label={`${t("payMonthly.amount")} ${row.name}`}
        inputMode="numeric"
        disabled={busy}
        value={text}
        placeholder={t("payMonthly.quickAmountHint")}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d]/g, "");
          if (raw === "") return setText("");
          const n = Number(raw);
          if (n <= 50000000) setText(format(n));
        }}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") void commit();
          if (e.key === "Escape") setEditing(false);
        }}
      />
      {error && (
        <small role="alert" className="text-red-700">
          {error}
        </small>
      )}
    </span>
  );
}

/** REQ-261102 — [완납]: record the month's unpaid balance as received. */
export function PayInFull({
  row,
  month,
  identity,
}: {
  row: MonthlyStudentRow;
  month: string;
  identity: string;
}) {
  const { t } = useTranslation("common");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today);
  const [method, setMethod] = useState("TRANSFER");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pay = async () => {
    setBusy(true);
    setError("");
    try {
      const bills = (
        await apiClient.get<Page>(base, {
          params: { basis: "MONTH", from: month, to: month, studentId: row.id },
        })
      ).data.items.filter((b) => b.state === "ACTIVE" && (b.unpaid ?? 0) > 0);
      for (const b of bills)
        await apiClient.post(`${base}/${b.id}/collections`, {
          requestId: crypto.randomUUID(),
          version: b.version,
          reason: t("payMonthly.paidInFullReason"),
          amount: b.unpaid,
          date,
          method,
        });
      setOpen(false);
      await qc.invalidateQueries({ queryKey: ["pay", identity] });
    } catch (e) {
      const code = payErrorCode(e);
      setError(code ? t(`pay.${code}`) : t("pay.failed"));
      await qc.invalidateQueries({ queryKey: ["pay", identity] });
    } finally {
      setBusy(false);
    }
  };
  if (!open)
    return (
      <button
        className="ml-2 min-h-9 rounded border border-emerald-600 px-2 text-xs text-emerald-700 hover:bg-emerald-50"
        onClick={() => setOpen(true)}
      >
        {t("payMonthly.paidInFull")}
      </button>
    );
  return (
    <span className="ml-2 inline-flex flex-nowrap items-center gap-1 align-middle">
      <span className="text-xs tabular-nums">{format(row.unpaid)}</span>
      <input
        type="date"
        className={small}
        aria-label={t("pay.date")}
        value={date}
        disabled={busy}
        onChange={(e) => setDate(e.target.value)}
      />
      <select
        className={small}
        aria-label={t("pay.method")}
        value={method}
        disabled={busy}
        onChange={(e) => setMethod(e.target.value)}
      >
        {["TRANSFER", "CASH", "CARD", "OTHER"].map((m) => (
          <option key={m} value={m}>
            {t(`pay.${m}`)}
          </option>
        ))}
      </select>
      <button
        className="min-h-9 rounded bg-emerald-700 px-2 text-xs text-white disabled:opacity-40"
        disabled={busy || !date}
        onClick={() => void pay()}
      >
        {t("payMonthly.paidInFullConfirm")}
      </button>
      <button
        className="min-h-9 rounded border px-2 text-xs"
        disabled={busy}
        onClick={() => setOpen(false)}
      >
        {t("pay.quick.cancel")}
      </button>
      {error && (
        <small role="alert" className="text-red-700">
          {error}
        </small>
      )}
    </span>
  );
}
