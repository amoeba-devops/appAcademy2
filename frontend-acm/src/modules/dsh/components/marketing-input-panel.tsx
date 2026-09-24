import { AutomaticAdCostPanel } from "./automatic-ad-cost-panel";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useTranslation } from "react-i18next";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ManualInputSite } from "./manual-input-dialog";
interface Ad {
  id: string | null;
  medium: string;
  amount: number;
  legacy?: boolean;
}
interface Site {
  site: ManualInputSite;
  ga: number | null;
  adjustment: number | null;
  visitor: number | null;
  cost: number | null;
  manualCost?: number | null;
  effect: number | null;
  ads: Ad[];
  automaticCosts?: Array<{ amount: number; manualMode: string | null }>;
}
interface Day {
  revision: number;
  additive: boolean;
  legacyVisitor: number | null;
  sites: Site[];
}
interface Draft {
  adjustment: string;
  ads: Array<{
    id: string | null;
    key: string;
    medium: string;
    amount: string;
  }>;
  visitorDirty: boolean;
  adsDirty: boolean;
}
export function MarketingInputPanel({
  date,
  site,
  onDirtyChange,
}: {
  date: string;
  site: ManualInputSite;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const { t } = useTranslation("dsh");
  const qc = useQueryClient();
  const [saved, setSaved] = useState<Day>();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [tab, setTab] = useState(site);
  const [busy, setBusy] = useState(false);
  const [automaticDirty, setAutomaticDirty] = useState(false);
  const [message, setMessage] = useState("");
  const q = useQuery({
    queryKey: ["dsh", "marketing-input", date],
    queryFn: async () =>
      (await apiClient.get<Day>(`/acm/dsh/marketing-inputs/${date}`)).data,
    refetchOnWindowFocus: false,
  });
  const dirty = Object.values(drafts).some((d) => d.visitorDirty || d.adsDirty);
  useEffect(
    () => onDirtyChange(dirty || busy || automaticDirty),
    [dirty, busy, automaticDirty, onDirtyChange],
  );
  useEffect(() => setTab(site), [site]);
  const load = (data: Day) => {
    setSaved(data);
    setDrafts(
      Object.fromEntries(
        data.sites.map((s) => [
          s.site,
          {
            adjustment: s.adjustment == null ? "" : String(s.adjustment),
            ads: s.ads.map((a) => ({
              ...a,
              key: a.id ?? crypto.randomUUID(),
              amount: String(a.amount),
            })),
            visitorDirty: false,
            adsDirty: false,
          },
        ]),
      ),
    );
  };
  useEffect(() => {
    if (q.data && !dirty && !busy) load(q.data);
  }, [q.data]); // Refetch never discards edits.
  const update = (s: string, patch: Partial<Draft>) =>
    setDrafts((prev) => ({ ...prev, [s]: { ...prev[s], ...patch } }));
  const additive =
    saved?.additive || Object.values(drafts).some((d) => d.visitorDirty);
  const visitor = (s: Site) =>
    additive
      ? s.ga == null
        ? null
        : s.ga + Number(drafts[s.site]?.adjustment || 0)
      : s.visitor;
  const value = (n: number | null | undefined) =>
    n == null ? t("marketingEditor.missing") : n.toLocaleString();
  const save = async () => {
    if (!saved || busy) return;
    setMessage("");
    const sites: Array<{
      site: string;
      adjustment?: number | null;
      ads?: Array<{ id?: string; medium: string; amount: number }>;
    }> = [];
    for (const [s, d] of Object.entries(drafts)) {
      if (!d.visitorDirty && !d.adsDirty) continue;
      const patch: (typeof sites)[number] = { site: s };
      if (d.visitorDirty) {
        const n = Number(d.adjustment);
        if (
          d.adjustment !== "" &&
          (!Number.isInteger(n) || n < 0 || n > 1000000000)
        ) {
          setMessage(t("marketingEditor.invalid"));
          return;
        }
        patch.adjustment = d.adjustment === "" ? null : n;
      }
      if (d.adsDirty) {
        const rows = d.ads.filter((a) => a.medium.trim() || a.amount !== "");
        if (
          rows.length > 100 ||
          rows.some(
            (a) =>
              !a.medium.trim() ||
              a.medium.trim().length > 100 ||
              a.amount === "" ||
              !Number.isInteger(Number(a.amount)) ||
              Number(a.amount) < 0 ||
              Number(a.amount) > 999999999999,
          )
        ) {
          setMessage(t("marketingEditor.invalid"));
          return;
        }
        patch.ads = rows.map((a) => ({
          ...(a.id ? { id: a.id } : {}),
          medium: a.medium.trim(),
          amount: Number(a.amount),
        }));
      }
      sites.push(patch);
    }
    setBusy(true);
    try {
      const res = await apiClient.patch<Day>(
        `/acm/dsh/marketing-inputs/${date}`,
        { expectedRevision: saved.revision, sites },
      );
      load(res.data);
      qc.setQueryData(["dsh", "marketing-input", date], res.data);
      await qc.invalidateQueries({ queryKey: ["dsh"] });
      setMessage(t("marketingEditor.saved"));
    } catch (e) {
      const data = isAxiosError(e)
        ? JSON.stringify(e.response?.data ?? "")
        : "";
      setMessage(
        t(
          data.includes("MARKETING_CHANGED")
            ? "marketingEditor.conflict"
            : data.includes("LEGACY_COST_MISMATCH")
              ? "marketingEditor.legacyMismatch"
              : "marketingEditor.failed",
        ),
      );
    } finally {
      setBusy(false);
    }
  };
  if (q.isError)
    return (
      <p role="alert">
        {t("marketingEditor.failed")}{" "}
        <Button type="button" onClick={() => q.refetch()}>
          {t("marketingEditor.reload")}
        </Button>
      </p>
    );
  if (!saved) return <p>{t("marketingEditor.loading")}</p>;
  const totalEffect = saved.sites.some((s) => s.effect != null)
    ? saved.sites.reduce((sum, s) => sum + (s.effect ?? 0), 0)
    : null;
  const realSites = saved.sites.filter((s) => s.site !== "COMMON");
  const total = realSites.every((s) => visitor(s) != null)
    ? realSites.reduce((sum, s) => sum + visitor(s)!, 0)
    : null;
  const manualCost = (s: Site) =>
    drafts[s.site]?.adsDirty
      ? drafts[s.site].ads.reduce((sum, a) => sum + (Number(a.amount) || 0), 0)
      : s.manualCost !== undefined
        ? s.manualCost
        : s.cost;
  const cost = (s: Site) => {
    const manual = manualCost(s),
      auto = s.automaticCosts ?? [];
    if (!auto.length) return manual;
    const common = saved.sites.find((r) => r.site === "COMMON");
    if (
      (common && (manualCost(common) ?? 0) > 0) ||
      auto.some((r) => r.amount < 0) ||
      ((manual ?? 0) > 0 && !auto[0].manualMode)
    )
      return manual;
    return (
      (auto[0].manualMode === "REPLACE" ? 0 : (manual ?? 0)) +
      auto.reduce((sum, r) => sum + r.amount, 0)
    );
  };
  const current = drafts[tab];
  return (
    <>
      <fieldset
        className="border rounded-lg p-3 space-y-3 bg-white"
        disabled={busy || automaticDirty}
      >
        <legend className="font-bold px-1">{t("marketingEditor.title")}</legend>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th>{t("manualInput.site")}</th>
                <th>GA + {t("marketingEditor.adjustment")}</th>
                <th>{t("marketingEditor.visitor")}</th>
                <th>{t("marketingEditor.adSpend")}</th>
                <th>{t("marketingEditor.effect")}</th>
              </tr>
            </thead>
            <tbody>
              {realSites.map((s) => (
                <tr key={s.site} className="border-t">
                  <th className="pr-2">
                    {s.site === "TRINITY"
                      ? "TA"
                      : s.site === "SANTACROCE"
                        ? "SC"
                        : "TPI"}
                  </th>
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <span>{value(s.ga)} +</span>
                      <Input
                        className="w-24"
                        aria-label={`${s.site} ${t("marketingEditor.adjustment")}`}
                        type="number"
                        min={0}
                        max={1000000000}
                        step={1}
                        placeholder="0"
                        value={drafts[s.site]?.adjustment ?? ""}
                        onChange={(e) =>
                          update(s.site, {
                            adjustment: e.target.value,
                            visitorDirty: true,
                          })
                        }
                      />
                    </div>
                  </td>
                  <td>{value(visitor(s))}</td>
                  <td>{value(cost(s))}</td>
                  <td>{value(s.effect)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm">
          {t("marketingEditor.total")}:{" "}
          {value(additive ? total : saved.legacyVisitor)} ·{" "}
          {t("marketingEditor.adSpend")}:{" "}
          {value(
            saved.sites.some((s) => cost(s) != null)
              ? saved.sites.reduce((sum, s) => sum + (cost(s) ?? 0), 0)
              : null,
          )}{" "}
          · {t("marketingEditor.effect")}: {value(totalEffect)}
        </p>
        <p className="text-xs text-secondary">
          {t("marketingEditor.explanation")}
        </p>
        {!saved.additive && additive && (
          <p className="text-sm text-amber-700">
            {t("marketingEditor.transition", {
              previous: value(saved.legacyVisitor),
              next: value(total),
            })}
          </p>
        )}
        <div className="flex gap-2 flex-wrap">
          {saved.sites.map((s) => (
            <Button
              type="button"
              key={s.site}
              variant={tab === s.site ? "default" : "outline"}
              onClick={() => setTab(s.site)}
            >
              {s.site === "COMMON"
                ? t("marketingEditor.common")
                : s.site === "TRINITY"
                  ? "TA"
                  : s.site === "SANTACROCE"
                    ? "SC"
                    : "TPI"}
            </Button>
          ))}
        </div>
        {current?.ads.map((ad, i) => (
          <div key={ad.key} className="flex gap-2 items-center">
            <Input
              aria-label={`${t("marketingEditor.medium")} ${i + 1}`}
              placeholder={t("marketingEditor.medium")}
              maxLength={100}
              value={ad.medium}
              onChange={(e) =>
                update(tab, {
                  adsDirty: true,
                  ads: current.ads.map((a, n) =>
                    n === i ? { ...a, medium: e.target.value } : a,
                  ),
                })
              }
            />
            <Input
              className="w-40"
              aria-label={`${t("marketingEditor.amount")} ${i + 1}`}
              placeholder={t("marketingEditor.amount")}
              type="number"
              min={0}
              max={999999999999}
              step={1}
              value={ad.amount}
              onChange={(e) =>
                update(tab, {
                  adsDirty: true,
                  ads: current.ads.map((a, n) =>
                    n === i ? { ...a, amount: e.target.value } : a,
                  ),
                })
              }
            />
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                update(tab, {
                  adsDirty: true,
                  ads: current.ads.filter((_, n) => n !== i),
                })
              }
            >
              {t("marketingEditor.remove")}
            </Button>
          </div>
        ))}
        <div className="flex flex-wrap justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!current || current.ads.length >= 100}
            onClick={() =>
              update(tab, {
                adsDirty: true,
                ads: [
                  ...current.ads,
                  {
                    id: null,
                    key: crypto.randomUUID(),
                    medium: "",
                    amount: "",
                  },
                ],
              })
            }
          >
            + {t("marketingEditor.add")}
          </Button>
          <Button
            type="button"
            disabled={!dirty || busy || automaticDirty}
            onClick={save}
          >
            {t("marketingEditor.save")}
          </Button>
        </div>
        {message && (
          <div role="status" className="text-sm">
            {message}
            {message === t("marketingEditor.conflict") && (
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  if (window.confirm(t("marketingEditor.discard"))) {
                    const res = await q.refetch();
                    if (res.data) {
                      load(res.data);
                      setMessage("");
                    }
                  }
                }}
              >
                {t("marketingEditor.reload")}
              </Button>
            )}
          </div>
        )}
      </fieldset>
      <AutomaticAdCostPanel
        date={date}
        blocked={dirty || busy}
        onDirtyChange={setAutomaticDirty}
      />
    </>
  );
}
