import { formatAdMicros } from "@/modules/cfg/lib/ad-cost-format";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
interface Row {
  site: string;
  provider: string;
  original: number;
  amount: number;
  mode: string | null;
  adjustment: number | null;
  reason: string | null;
  manualMode: string | null;
}
interface Detail {
  revision: number;
  sources: Array<{
    name: string;
    provider: string;
    last_error: string | null;
    last_success_at: string | null;
    date: string | null;
    micros: string | null;
  }>;
  rows: Row[];
  unmapped: Array<{ name: string; provider: string; micros: string }>;
  sites: Array<{ site: string; automaticPending: boolean }>;
  legacyCommonCost: number | null;
}
export function AutomaticAdCostPanel({
  date,
  blocked,
  onDirtyChange,
}: {
  date: string;
  blocked: boolean;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const { t } = useTranslation("common");
  const qc = useQueryClient();
  const [edit, setEdit] = useState<Row | null>(null);
  const [mode, setMode] = useState("DELTA");
  const [amount, setAmount] = useState("0");
  const [reason, setReason] = useState("");
  const [manualMode, setManualMode] = useState("");
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<Array<{
    created_at: string;
    target_id: string;
    after_value: { mode: string; amount: number; reason: string };
  }> | null>(null);
  const q = useQuery({
    queryKey: ["dsh", "automatic-cost", date],
    queryFn: async () =>
      (await apiClient.get<Detail>(`/acm/dsh/automatic-ad-costs/${date}`)).data,
    refetchOnWindowFocus: false,
  });
  useEffect(() => onDirtyChange(!!edit || busy), [edit, busy, onDirtyChange]);
  if (q.isLoading) return <p>{t("ads.loading")}</p>;
  if (q.isError) return <p role="alert">{t("ads.failed")}</p>;
  if (
    !q.data?.rows.length &&
    !q.data?.unmapped.length &&
    !q.data?.sources.length
  )
    return null;
  const save = async () => {
    if (!edit || !reason.trim()) return;
    setBusy(true);
    try {
      await apiClient.put(`/acm/dsh/automatic-ad-costs/${date}`, {
        expectedRevision: revision,
        site: edit.site,
        provider: edit.provider,
        mode,
        amount: mode === "RESET" ? 0 : Number(amount),
        reason,
        ...(manualMode ? { manualMode } : {}),
      });
      setEdit(null);
      setMessage(t("ads.saved"));
      await qc.invalidateQueries({ queryKey: ["dsh"] });
    } catch {
      setMessage(t("ads.adjustFailed"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="space-y-3 rounded border bg-gray-50 p-3">
      <h3 className="font-bold">{t("ads.automaticCosts")}</h3>
      <p className="text-sm text-gray-600">{t("ads.correctionHelp")}</p>
      {q.data?.unmapped.map((r, i) => (
        <p key={i} className="text-amber-800">
          {t("ads.unmapped")}: {r.name} ·{" "}
          {formatAdMicros(r.micros)} KRW
        </p>
      ))}
      <details className="text-sm">
        <summary>{t("ads.sources")}</summary>
        {q.data?.sources.map((s, i) => (
          <p key={i}>
            {s.name} ·{" "}
            {s.date
              ? `${formatAdMicros(s.micros)} KRW`
              : t("ads.noCoverage")}{" "}
            · {t("ads.lastSuccess")}:{" "}
            {s.last_success_at
              ? new Date(s.last_success_at).toLocaleString()
              : "—"}{" "}
            {s.last_error && ` · ${s.last_error}`}
          </p>
        ))}
      </details>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {["site", "provider", "original", "applied", "edit"].map((k) => (
                <th className="p-2 text-left" key={k}>
                  {t(`ads.${k}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {q.data?.rows.map((r) => (
              <tr key={`${r.site}:${r.provider}`} className="border-t bg-white">
                <td className="p-2">{t(`ads.sites.${r.site}`)}</td>
                <td>{t(`ads.providers.${r.provider}`)}</td>
                <td>{r.original.toLocaleString()}</td>
                <td>
                  {r.amount.toLocaleString()}
                  {q.data?.sites.find((s) => s.site === r.site)
                    ?.automaticPending && (
                    <span className="ml-2 text-amber-800">
                      {t("ads.pending")}
                    </span>
                  )}
                </td>
                <td>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={blocked || busy || !!edit}
                    onClick={() => {
                      setEdit(r);
                      setRevision(q.data!.revision);
                      setMode(r.mode ?? "DELTA");
                      setAmount(String(r.adjustment ?? 0));
                      setReason(r.reason ?? "");
                      setManualMode(r.manualMode ?? "");
                    }}
                  >
                    {t("ads.edit")}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(q.data?.legacyCommonCost ?? 0) > 0 && (
        <p className="text-amber-800">{t("ads.commonConflict")}</p>
      )}
      {edit && (
        <div className="space-y-3 rounded border bg-white p-3">
          <strong>
            {t(`ads.sites.${edit.site}`)} ·{" "}
            {t(`ads.providers.${edit.provider}`)}
          </strong>
          <label className="block">
            {t("ads.mode")}
            <select
              className="ml-2 rounded border p-2"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            >
              {["DELTA", "FIXED", "RESET"].map((m) => (
                <option key={m} value={m}>
                  {t(`ads.modes.${m}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            {t("ads.amount")}
            <Input
              type="number"
              step="1"
              disabled={mode === "RESET"}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label className="block">
            {t("ads.reason")}
            <Input
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <label className="block">
            {t("ads.manualPolicy")}
            <select
              className="w-full rounded border p-2"
              value={manualMode}
              onChange={(e) => setManualMode(e.target.value)}
            >
              <option value="">{t("ads.choosePolicy")}</option>
              <option value="ADD">{t("ads.policyAdd")}</option>
              <option value="REPLACE">{t("ads.policyReplace")}</option>
            </select>
          </label>
          <div className="flex gap-2">
            <Button
              type="button"
              disabled={
                busy || !reason.trim() || !Number.isSafeInteger(Number(amount))
              }
              onClick={() => void save()}
            >
              {t("ads.save")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setEdit(null)}
            >
              {t("ads.cancel")}
            </Button>
          </div>
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={async () => {
          try {
            setHistory(
              (
                await apiClient.get(
                  `/acm/dsh/automatic-ad-costs/${date}/history`,
                )
              ).data,
            );
          } catch {
            setMessage(t("ads.failed"));
          }
        }}
      >
        {t("ads.correctionHistory")}
      </Button>
      {history && (
        <ul className="text-sm">
          {history.map((h, i) => (
            <li key={i}>
              {new Date(h.created_at).toLocaleString()} · {h.target_id} ·{" "}
              {h.after_value.mode} {h.after_value.amount} ·{" "}
              {h.after_value.reason}
            </li>
          ))}
        </ul>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
