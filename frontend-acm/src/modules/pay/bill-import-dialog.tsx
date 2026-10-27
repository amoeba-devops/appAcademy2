import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiClient } from "@/lib/api-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { monthlySites } from "./monthly-payment-view";
import {
  BILL_KINDS,
  buildBillTemplate,
  parseBillWorkbook,
  payErrorCode,
  type ImportData,
  type ParsedRow,
  type TemplateLabels,
} from "./bill-import";
import type { BillInput, Preview } from "./types";

// REQ-261027 — Excel bulk bill registration: template download → upload → preview → create.
const base = "/acm/pay/bills";
const input =
  "rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900";
const btn =
  "rounded border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-slate-100";
const format = (n: number) => new Intl.NumberFormat().format(n);

interface Row extends ParsedRow {
  /** Server preview reason for a parsed item (DUPLICATE, NOT_ENROLLED, …). */
  serverReason?: string | null;
}

export function BillImportDialog({
  open,
  close,
  month: initialMonth,
  site: initialSite,
  onSaved,
}: {
  open: boolean;
  close: () => void;
  month?: string;
  site: string;
  onSaved: () => Promise<unknown>;
}) {
  const { t, i18n } = useTranslation("common");
  const tr = (key: string, o?: Record<string, unknown>) => t(`pay.${key}`, o);
  const [month, setMonth] = useState("");
  const [due, setDue] = useState("");
  const [site, setSite] = useState("ALL");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [requestId, setRequestId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [fileKey, setFileKey] = useState(0);
  useEffect(() => {
    if (!open) return;
    const m = initialMonth || new Date().toISOString().slice(0, 7);
    setMonth(m);
    setDue(`${m}-10`);
    setSite(initialSite || "ALL");
    setRows(null);
    setError("");
    setDone("");
  }, [open, initialMonth, initialSite]);

  const fail = (e: unknown) => {
    const code =
      payErrorCode(e) ?? (e instanceof Error ? e.message : undefined);
    setError(code?.startsWith("PAY_") ? tr(code) : tr("failed"));
  };
  const loadData = async (forSite: string) =>
    (
      await apiClient.get<ImportData>(base + "/import-data", {
        params: { site: forSite },
      })
    ).data;

  const download = async () => {
    setBusy(true);
    setError("");
    try {
      const labels = {
        ...(t("pay.bulk", { returnObjects: true }) as Omit<
          TemplateLabels,
          "kinds"
        >),
        kinds: Object.fromEntries(BILL_KINDS.map((k) => [k, tr(k)])),
      };
      const buffer = await buildBillTemplate(await loadData(site), {
        month,
        due,
        title: tr("bulk.defaultTitle", {
          m: Number(month.slice(5)),
          ym: month,
        }),
        labels,
      });
      const url = URL.createObjectURL(
        new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `bill-import-${month}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const upload = async (file: File) => {
    setBusy(true);
    setError("");
    setDone("");
    setRows(null);
    try {
      // Every locale's kind labels, so a template downloaded in any language parses.
      const langs = Object.keys(i18n.options.resources ?? {});
      const kindLabels = Object.fromEntries(
        BILL_KINDS.map((k) => [
          k,
          langs
            .map((l) => i18n.getResource(l, "common", `pay.${k}`) as unknown)
            .filter((v): v is string => typeof v === "string"),
        ]),
      );
      const parsed: Row[] = await parseBillWorkbook(
        await file.arrayBuffer(),
        await loadData("ALL"),
        kindLabels,
      );
      const items = parsed.filter((r) => r.item).map((r) => r.item!);
      if (items.length) {
        const id = crypto.randomUUID();
        const preview = (
          await apiClient.post<Preview>(base + "/batch-preview", {
            requestId: id,
            items,
          })
        ).data;
        let i = 0;
        for (const r of parsed)
          if (r.item) {
            const p = preview.items[i++];
            r.serverReason = p?.reason ?? null;
            if (p?.studentName) r.studentName = p.studentName;
          }
        setRequestId(crypto.randomUUID());
      }
      setRows(parsed);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
      setFileKey((k) => k + 1);
    }
  };

  const eligible: BillInput[] = (rows ?? [])
    .filter((r) => r.item && !r.serverReason)
    .map((r) => r.item!);
  const skipped = (rows ?? []).filter((r) => r.skipped).length;
  const excluded = (rows?.length ?? 0) - eligible.length - skipped;

  const commit = async () => {
    setBusy(true);
    setError("");
    try {
      const r = (
        await apiClient.post<{ ids: string[] }>(base + "/batch-create", {
          requestId,
          items: eligible,
        })
      ).data;
      setDone(tr("bulk.done", { count: r.ids.length }));
      setRows(null);
      await onSaved();
    } catch (e) {
      fail(e);
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
          <DialogTitle>{tr("bulk.title")}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-secondary">{tr("bulk.hint")}</p>
        <section className="space-y-2 rounded border p-3">
          <h3 className="font-medium">{tr("bulk.step1")}</h3>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-sm">
              {tr("month")}
              <input
                className={`${input} block`}
                type="month"
                value={month}
                onChange={(e) => {
                  setMonth(e.target.value);
                  if (e.target.value) setDue(`${e.target.value}-10`);
                }}
              />
            </label>
            <label className="text-sm">
              {tr("bulk.due")}
              <input
                className={`${input} block`}
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </label>
            <label className="text-sm">
              {tr("site")}
              <select
                className={`${input} block`}
                value={site}
                onChange={(e) => setSite(e.target.value)}
              >
                {monthlySites.map((s) => (
                  <option key={s} value={s}>
                    {t(`payMonthly.${s}`)}
                  </option>
                ))}
              </select>
            </label>
            <button
              className={btn}
              disabled={busy || !month || !due}
              onClick={() => void download()}
            >
              {tr("bulk.download")}
            </button>
          </div>
        </section>
        <section className="space-y-2 rounded border p-3">
          <h3 className="font-medium">{tr("bulk.step2")}</h3>
          <label className="text-sm">
            <span className="sr-only">{tr("bulk.file")}</span>
            <input
              key={fileKey}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file);
              }}
            />
          </label>
        </section>
        {busy && <p className="text-sm">{tr("loading")}</p>}
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
        {done && <p role="status">{done}</p>}
        {rows && (
          <div className="space-y-2">
            <p className="text-sm font-medium">
              {tr("bulk.summary", {
                ok: eligible.length,
                bad: excluded,
                skip: skipped,
              })}
            </p>
            <div className="max-h-80 overflow-auto rounded border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    {[
                      "bulk.row",
                      "student",
                      "month",
                      "billTitle",
                      "amount",
                      "bulk.result",
                    ].map((k) => (
                      <th key={k} className="p-2 text-left">
                        {tr(k)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const reason = r.reason || r.serverReason;
                    return (
                      <tr key={r.row} className="border-t">
                        <td className="p-2">{r.row}</td>
                        <td className="p-2">{r.studentName}</td>
                        <td className="p-2">{r.item?.month ?? r.raw.month}</td>
                        <td className="p-2">{r.item?.title ?? r.raw.title}</td>
                        <td className="p-2 text-right">
                          {r.item ? format(r.item.amount) : r.raw.amount}
                        </td>
                        <td
                          className={`p-2 ${reason ? "text-red-700" : r.skipped ? "text-slate-500" : ""}`}
                        >
                          {r.skipped
                            ? tr("bulk.skippedRow")
                            : reason
                              ? tr(reason)
                              : tr("eligible")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <button
            className={btn}
            disabled={busy || !eligible.length}
            onClick={() => void commit()}
          >
            {tr("bulk.commit", { count: eligible.length })}
          </button>
          <button className={btn} disabled={busy} onClick={close}>
            {tr("close")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
