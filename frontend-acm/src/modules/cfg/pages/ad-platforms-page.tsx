import { formatAdMicros } from "../lib/ad-cost-format";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { isAxiosError } from "axios";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AD_PROVIDERS,
  AD_SITES,
  type AdConnection,
  type AdProvider,
  type AdSite,
  type AdRun,
} from "../types/ads";
const root = "/acm/admin/ad-connections";
const day = (offset = 0) =>
  new Date(Date.now() + 9 * 3600000 + offset * 86400000)
    .toISOString()
    .slice(0, 10);
export function AdPlatformsPage() {
  const { t } = useTranslation("common");
  const qc = useQueryClient();
  const [selected, setSelected] = useState<AdConnection | null>(null);
  const [editing, setEditing] = useState(false);
  const [provider, setProvider] = useState<AdProvider>("META");
  const [name, setName] = useState("");
  const [account, setAccount] = useState("");
  const [start, setStart] = useState(day());
  const [effective, setEffective] = useState(day());
  const [site, setSite] = useState<AdSite | "">("");
  const [manager, setManager] = useState("");
  const [campaigns, setCampaigns] = useState<
    Array<{ id: string; site: AdSite }>
  >([]);
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<string | null>(null);
  const [from, setFrom] = useState(day(-7));
  const [to, setTo] = useState(day(-1));
  const oauthHandled = useRef(false);
  const q = useQuery({
    queryKey: ["ad-connections"],
    queryFn: async () => (await apiClient.get<AdConnection[]>(root)).data,
    refetchInterval: 30000,
  });
  const runs = useQuery({
    queryKey: ["ad-runs", history],
    enabled: !!history,
    queryFn: async () =>
      (await apiClient.get<AdRun[]>(`${root}/${history}/runs`)).data,
    refetchInterval: 10000,
  });
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setMessage("");
    try {
      await fn();
      setMessage(t("ads.saved"));
      await qc.invalidateQueries({ queryKey: ["ad-connections"] });
      await qc.invalidateQueries({ queryKey: ["ad-runs"] });
    } catch (e) {
      const code = isAxiosError(e)
        ? e.response?.data?.error?.message
        : undefined;
      setMessage(
        `${t("ads.failed")}${typeof code === "string" ? `: ${code}` : ""}`,
      );
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (oauthHandled.current || !p.has("state")) return;
    oauthHandled.current = true;
    const state = p.get("state"),
      code = p.get("code");
    window.history.replaceState(null, "", window.location.pathname);
    if (!code) {
      setMessage(t("ads.oauthCancelled"));
      return;
    }
    void act(() => apiClient.post(`${root}/oauth/complete`, { state, code }));
  }, []);
  const open = (c: AdConnection | null) => {
    setSelected(c);
    setProvider(c?.provider ?? "META");
    setName(c?.name ?? "");
    setAccount(c?.account_id ?? "");
    setStart(c?.config.startDate ?? day());
    setSite(c?.config.defaultSite ?? "");
    setEffective(day());
    setManager(c?.config.managerId ?? "");
    setCampaigns(
      Object.entries(c?.config.campaigns ?? {}).map(([id, s]) => ({
        id,
        site: s,
      })),
    );
    setKeys({});
    setEditing(true);
  };
  const credentials =
    provider === "META"
      ? ["accessToken"]
      : provider === "GOOGLE"
        ? ["clientId", "clientSecret", "refreshToken"]
        : provider === "NAVER_SEARCH"
          ? ["apiKey", "secretKey"]
          : [];
  return (
    <main className="space-y-5 rounded-xl bg-gray-50 p-4">
      <Link to="/admin/config" className="text-indigo-700">
        ← {t("ads.settings")}
      </Link>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{t("ads.title")}</h1>
          <p className="text-sm text-gray-600">{t("ads.schedule")}</p>
        </div>
        <Button onClick={() => open(null)} disabled={busy}>
          {t("ads.add")}
        </Button>
      </header>
      {message && (
        <p role="status" className="rounded border bg-white p-3">
          {message}
        </p>
      )}
      {q.isError && <p role="alert">{t("ads.failed")}</p>}
      {q.isLoading && <p>{t("ads.loading")}</p>}
      {q.data?.length === 0 && (
        <p className="rounded bg-white p-6">{t("ads.empty")}</p>
      )}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
        <section className="min-w-0 space-y-3">
          {q.data?.map((c) => (
            <article
              key={c.adc_id}
              className="space-y-3 rounded-lg border bg-white p-4"
            >
              <div className="flex flex-wrap justify-between gap-2">
                <h2 className="font-bold">
                  {c.name} · {t(`ads.providers.${c.provider}`)}
                </h2>
                <span>{c.active ? t("ads.active") : t("ads.paused")}</span>
              </div>
              <p className="text-sm text-gray-600">
                {c.account_id} ·{" "}
                {c.config.defaultSite
                  ? t(`ads.sites.${c.config.defaultSite}`)
                  : t("ads.campaignMapping")}{" "}
                · {t("ads.lastSuccess")}:{" "}
                {c.last_success_at
                  ? new Date(c.last_success_at).toLocaleString()
                  : "—"}
              </p>
              {c.last_error && (
                <p role="alert" className="text-red-700">
                  {c.last_error}
                </p>
              )}
              {c.provider === "NAVER_GFA" && (
                <p className="text-amber-800">{t("ads.gfa")}</p>
              )}
              {c.test_result && (
                <p>
                  {c.test_result.ok
                    ? `${t("ads.testSuccess")} · ${t("ads.unmapped")}: ${c.test_result.unmapped} · KRW ${formatAdMicros(c.test_result.totalMicros)}`
                    : c.test_result.code}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => open(c)}
                >
                  {t("ads.edit")}
                </Button>
                <Button
                  variant="outline"
                  disabled={busy || c.provider === "NAVER_GFA"}
                  onClick={() =>
                    void act(() => apiClient.post(`${root}/${c.adc_id}/test`))
                  }
                >
                  {t("ads.test")}
                </Button>
                {c.provider === "GOOGLE" && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void act(async () => {
                        const r = await apiClient.post<{ url: string }>(
                          `${root}/${c.adc_id}/oauth`,
                        );
                        window.location.assign(r.data.url);
                      })
                    }
                  >
                    {t("ads.oauth")}
                  </Button>
                )}
                <Button
                  disabled={
                    busy ||
                    (!c.active &&
                      (c.tested_revision !== c.revision ||
                        !!c.test_result?.unmapped))
                  }
                  onClick={() =>
                    void act(() =>
                      apiClient.post(
                        `${root}/${c.adc_id}/${c.active ? "pause" : "enable"}`,
                        { expectedRevision: c.revision },
                      ),
                    )
                  }
                >
                  {c.active ? t("ads.pause") : t("ads.enable")}
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => setHistory(c.adc_id)}
                >
                  {t("ads.history")}
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(t("ads.disconnectConfirm")))
                      void act(() =>
                        apiClient.post(`${root}/${c.adc_id}/disconnect`, {
                          expectedRevision: c.revision,
                        }),
                      );
                  }}
                >
                  {t("ads.disconnect")}
                </Button>
              </div>
            </article>
          ))}
        </section>
        <aside className="h-fit space-y-3 rounded-lg border bg-white p-4 text-sm text-gray-600">
          <h2 className="font-bold text-gray-900">{t("ads.help")}</h2>
          <p>{t("ads.helpBody")}</p>
          <p>{t("ads.mappingWarning")}</p>
          <p>{t("ads.oauthHelp")}</p>
        </aside>
      </div>
      {editing && (
        <form
          className="space-y-4 rounded-lg border bg-white p-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (new Set(campaigns.map((c) => c.id)).size !== campaigns.length) {
              setMessage(t("ads.duplicate"));
              return;
            }
            void act(async () => {
              const body = {
                provider,
                accountId: account,
                name,
                expectedRevision: selected?.revision,
                config: {
                  startDate: start,
                  mappingEffectiveFrom: selected ? effective : start,
                  ...(site ? { defaultSite: site } : {}),
                  campaigns: Object.fromEntries(
                    campaigns.map((c) => [c.id, c.site]),
                  ),
                  ...(manager ? { managerId: manager } : {}),
                },
                credentials: keys,
              };
              if (selected)
                await apiClient.put(`${root}/${selected.adc_id}`, body);
              else await apiClient.post(root, body);
              setKeys({});
              setEditing(false);
            });
          }}
        >
          <h2 className="text-lg font-bold">{t("ads.edit")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              {t("ads.provider")}
              <select
                className="mt-1 w-full rounded border p-2"
                value={provider}
                disabled={!!selected}
                onChange={(e) => {
                  setProvider(e.target.value as AdProvider);
                  setKeys({});
                }}
              >
                {AD_PROVIDERS.map((p) => (
                  <option key={p} value={p}>
                    {t(`ads.providers.${p}`)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("ads.name")}
              <Input
                required
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              {t("ads.account")}
              <Input
                required
                disabled={!!selected}
                value={account}
                onChange={(e) => setAccount(e.target.value)}
              />
            </label>
            <label>
              {t("ads.start")}
              <Input
                required
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            {selected && (
              <label>
                {t("ads.mappingEffective")}
                <Input
                  required
                  type="date"
                  value={effective}
                  onChange={(e) => setEffective(e.target.value)}
                />
              </label>
            )}
            <label>
              {t("ads.defaultSite")}
              <select
                className="mt-1 w-full rounded border p-2"
                value={site}
                onChange={(e) => setSite(e.target.value as AdSite | "")}
              >
                <option value="">{t("ads.campaignMapping")}</option>
                {AD_SITES.map((s) => (
                  <option key={s} value={s}>
                    {t(`ads.sites.${s}`)}
                  </option>
                ))}
              </select>
            </label>
            {provider === "GOOGLE" && (
              <label>
                {t("ads.manager")}
                <Input
                  value={manager}
                  onChange={(e) => setManager(e.target.value)}
                />
              </label>
            )}
            {credentials.map((k) => (
              <label key={k}>
                {t(`ads.keys.${k}`)}
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={keys[k] ?? ""}
                  placeholder={
                    selected?.credentialsSet ? t("ads.keepSecret") : ""
                  }
                  onChange={(e) =>
                    setKeys((prev) => ({ ...prev, [k]: e.target.value }))
                  }
                />
              </label>
            ))}
          </div>
          <h3 className="font-bold">{t("ads.campaignMapping")}</h3>
          {selected?.test_result?.campaigns?.length ? (
            <p className="text-sm">
              {selected.test_result.campaigns
                .map((c) => `${c.id}: ${c.name}`)
                .join(" · ")}
            </p>
          ) : null}
          {campaigns.map((c, i) => (
            <div key={i} className="flex flex-wrap gap-2">
              <Input
                aria-label={t("ads.campaignId")}
                required
                value={c.id}
                onChange={(e) =>
                  setCampaigns((prev) =>
                    prev.map((r, j) =>
                      j === i ? { ...r, id: e.target.value } : r,
                    ),
                  )
                }
              />
              <select
                aria-label={t("ads.defaultSite")}
                value={c.site}
                className="rounded border p-2"
                onChange={(e) =>
                  setCampaigns((prev) =>
                    prev.map((r, j) =>
                      j === i ? { ...r, site: e.target.value as AdSite } : r,
                    ),
                  )
                }
              >
                {AD_SITES.map((s) => (
                  <option key={s} value={s}>
                    {t(`ads.sites.${s}`)}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setCampaigns((prev) => prev.filter((_, j) => j !== i))
                }
              >
                {t("ads.remove")}
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setCampaigns((prev) => [...prev, { id: "", site: "TPI" }])
            }
          >
            {t("ads.addCampaign")}
          </Button>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              {t("ads.save")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setKeys({});
                setEditing(false);
              }}
            >
              {t("ads.cancel")}
            </Button>
          </div>
        </form>
      )}
      {history && (
        <section className="space-y-3 rounded border bg-white p-4">
          <h2 className="font-bold">
            {t("ads.history")} ·{" "}
            {q.data?.find((c) => c.adc_id === history)?.name}
          </h2>
          <div className="flex flex-wrap items-end gap-2">
            <label>
              {t("ads.from")}
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label>
              {t("ads.to")}
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
            <Button
              disabled={
                busy || !q.data?.find((c) => c.adc_id === history)?.active
              }
              onClick={() =>
                void act(() =>
                  apiClient.post(`${root}/${history}/sync`, { from, to }),
                )
              }
            >
              {t("ads.sync")}
            </Button>
          </div>
          {runs.isError && <p role="alert">{t("ads.failed")}</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  {["period", "status", "result"].map((k) => (
                    <th key={k} className="p-2">
                      {t(`ads.${k}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {runs.data?.map((r) => (
                  <tr key={r.adr_id} className="border-t">
                    <td className="p-2">
                      {r.from_date} ~ {r.to_date}
                    </td>
                    <td className="p-2">{r.status}</td>
                    <td className="p-2">
                      {r.error_code ??
                        `${r.result.rows ?? 0} / ${t("ads.unmapped")}: ${r.result.unmapped ?? 0}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
