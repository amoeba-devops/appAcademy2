import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { BookOpen, Copy, Download } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { todayKst } from "@/lib/tz";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { useConfigAccess, useConfigScope } from "../hooks/use-config-access";
import {
  API_SCOPES,
  type ApiCatalog,
  type ApiClient,
  type ApiEntry,
  type ApiScope,
  type ApiSettings,
} from "../types/scheduler-api";

const inputClass =
  "rounded-md border border-[var(--border-subtle)] bg-surface px-3 py-2 text-sm w-full min-w-0";
export function ApiGuidePage() {
  const { t } = useTranslation("common");
  const access = useConfigAccess();
  const scope = useConfigScope();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "apis";
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("all");
  const [notice, setNotice] = useState("");
  const catalog = useQuery({
    queryKey: ["integration-catalog", ...scope],
    queryFn: async () =>
      (await apiClient.get<ApiCatalog>("/acm/integrations/catalog")).data,
    retry: false,
  });
  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(t("scheduler.copied"));
    } catch {
      setNotice(t("scheduler.copyError"));
    }
  };
  const download = async () => {
    try {
      const response = await apiClient.get("/acm/integrations/openapi.json", {
        responseType: "blob",
      });
      const url = URL.createObjectURL(response.data as Blob),
        a = document.createElement("a");
      a.href = url;
      a.download = "acm-scheduler-openapi.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setNotice(t("scheduler.loadError"));
    }
  };
  if (catalog.isPending) return <p role="status">{t("scheduler.loading")}</p>;
  if (catalog.isError)
    return (
      <div role="alert">
        {t("scheduler.loadError")}{" "}
        <Button onClick={() => catalog.refetch()}>
          {t("scheduler.retry")}
        </Button>
      </div>
    );
  const baseUrl = `${window.location.origin}${catalog.data.basePath}`;
  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        icon={BookOpen}
        title={t("scheduler.title")}
        description={t("scheduler.description")}
      />
      <div
        className="flex flex-wrap gap-2 border-b pb-3"
        role="tablist"
        aria-label={t("scheduler.title")}
      >
        {(["apis", "guide", "settings"] as const).map((id) => (
          <Button
            key={id}
            role="tab"
            aria-selected={tab === id}
            variant={tab === id ? "default" : "outline"}
            onClick={() => setParams(id === "apis" ? {} : { tab: id })}
          >
            {t(`scheduler.tabs.${id}`)}
          </Button>
        ))}
      </div>
      {notice && <p role="status">{notice}</p>}
      {tab === "guide" ? (
        <section className="space-y-4 rounded-lg border p-5">
          <h2 className="text-lg font-semibold">{t("scheduler.tabs.guide")}</h2>
          <ol className="list-decimal space-y-3 pl-6">
            {(
              [
                "enable",
                "key",
                "server",
                "teacher",
                "list",
                "write",
                "retry",
                "rotate",
              ] as const
            ).map((step) => (
              <li key={step}>{t(`scheduler.steps.${step}`)}</li>
            ))}
          </ol>
          <p>{t("scheduler.studentRule")}</p>
          <p>{t("scheduler.timeRule")}</p>
          <p>{t("scheduler.retryRule")}</p>
          <pre className="overflow-x-auto rounded bg-gray-950 p-4 text-sm text-gray-100">{`Authorization: Bearer <API_KEY>\nContent-Type: application/json\nIdempotency-Key: <unique-operation-id>\nIf-None-Match: *  # create\nIf-Match: "<ETag>" # update/delete`}</pre>
        </section>
      ) : tab === "settings" ? (
        <ApiUsageSettings canManage={access.tenantAllowed} />
      ) : (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <code className="break-all text-sm">{baseUrl}</code>
            <Button variant="outline" onClick={() => copy(baseUrl)}>
              <Copy size={14} />
              {t("scheduler.copy")}
            </Button>
            <Button variant="outline" onClick={download}>
              <Download size={14} />
              {t("scheduler.download")}
            </Button>
            <span>
              {catalog.data.version} · {t("scheduler.available")}
            </span>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              aria-label={t("scheduler.search")}
              className={inputClass}
              placeholder={t("scheduler.search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              aria-label={t("scheduler.group")}
              className={inputClass}
              value={group}
              onChange={(e) => setGroup(e.target.value)}
            >
              <option value="all">{t("scheduler.all")}</option>
              <option value="teachers">{t("scheduler.teachers")}</option>
              <option value="lessons">{t("scheduler.lessons")}</option>
            </select>
          </div>
          {catalog.data.apis
            .filter(
              (entry) =>
                (group === "all" || group === entry.group) &&
                `${entry.name} ${entry.path} ${entry.method}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
            )
            .map((entry) => (
              <ApiReference
                key={entry.id}
                entry={entry}
                baseUrl={baseUrl}
                copy={copy}
              />
            ))}
          <details className="rounded-lg border p-4">
            <summary className="cursor-pointer font-semibold">
              {t("scheduler.errors")}
            </summary>
            <ul className="mt-3 space-y-2">
              {catalog.data.errors.map((e, i) => (
                <li key={i} className="break-words text-sm">
                  <code>
                    {e.status} {e.code}
                  </code>{" "}
                  — {e.description}
                </li>
              ))}
            </ul>
          </details>
        </section>
      )}
    </div>
  );
}
function ApiReference({
  entry,
  baseUrl,
  copy,
}: {
  entry: ApiEntry;
  baseUrl: string;
  copy: (value: string) => Promise<void>;
}) {
  const { t } = useTranslation("common");
  const path = entry.path.replace("{externalId}", "slot-20261201-001");
  const query = entry.fields
    .filter((f) => f.in === "query" && f.required)
    .map((f) => `${f.name}=${encodeURIComponent(String(f.example))}`)
    .join("&");
  const exampleHeaders = entry.fields
    .filter(
      (f) =>
        f.in === "header" &&
        (f.required ||
          f.name === "If-None-Match" ||
          (entry.method === "DELETE" && f.name === "If-Match")),
    )
    .map((f) => `  --header '${f.name}: ${String(f.example)}'`);
  const example = [
    `curl --request ${entry.method} '${baseUrl}${path}${query ? "?" + query : ""}'`,
    ...exampleHeaders,
    ...(entry.request
      ? [
          `  --header 'Content-Type: application/json'`,
          `  --data '${JSON.stringify(entry.request)}'`,
        ]
      : []),
  ].join(" \\\n");
  return (
    <details className="rounded-lg border p-4">
      <summary className="cursor-pointer break-words font-medium">
        <span className="mr-2 font-mono text-accent-700">{entry.method}</span>
        {entry.path}
        <span className="block text-sm text-secondary">
          {entry.name} · {entry.scope}
        </span>
      </summary>
      <div className="mt-4 space-y-4">
        <p className="text-sm">{t("scheduler.apiRule")}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {["field", "required", "type", "value", "description"].map(
                  (key) => (
                    <th className="border-b p-2" key={key}>
                      {t(`scheduler.${key}`)}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {entry.fields.map((f) => (
                <tr key={`${f.in}:${f.name}`}>
                  <td className="border-b p-2 font-mono">
                    {f.in}: {f.name}
                  </td>
                  <td className="border-b p-2">
                    {t(f.required ? "scheduler.yes" : "scheduler.no")}
                  </td>
                  <td className="border-b p-2">{f.type}</td>
                  <td className="border-b p-2">
                    <code>
                      {f.values?.join(" / ") ?? JSON.stringify(f.example)}
                    </code>
                    <span className="block">{f.limit}</span>
                  </td>
                  <td className="border-b p-2">{f.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button variant="outline" onClick={() => copy(example)}>
          {t("scheduler.copyExample")}
        </Button>
        <pre className="overflow-x-auto rounded bg-gray-950 p-4 text-xs text-gray-100">
          {example}
        </pre>
        {entry.request != null && (
          <>
            <h3>{t("scheduler.request")}</h3>
            <pre className="overflow-x-auto rounded bg-gray-100 p-3 text-xs text-gray-900">
              {JSON.stringify(entry.request, null, 2)}
            </pre>
          </>
        )}
        <h3>{t("scheduler.response")}</h3>
        <pre className="overflow-x-auto rounded bg-gray-100 p-3 text-xs text-gray-900">
          {JSON.stringify(entry.response, null, 2)}
        </pre>
      </div>
    </details>
  );
}
function ApiUsageSettings({ canManage }: { canManage: boolean }) {
  const { t } = useTranslation("common"),
    scope = useConfigScope(),
    qc = useQueryClient();
  const [draft, setDraft] = useState<ApiSettings | null>(null),
    [name, setName] = useState(""),
    [clientId, setClientId] = useState(""),
    [keyName, setKeyName] = useState("");
  const [keyScopes, setKeyScopes] = useState<ApiScope[]>([...API_SCOPES]);
  const [expires, setExpires] = useState(() =>
    todayKst(new Date(Date.now() + 90 * 86400000)),
  );
  const [secret, setSecret] = useState(""),
    [notice, setNotice] = useState("");
  const settings = useQuery({
    queryKey: ["integration-settings", ...scope],
    queryFn: async () =>
      (await apiClient.get<ApiSettings>("/acm/integrations/settings")).data,
    enabled: canManage,
    retry: false,
  });
  const clients = useQuery({
    queryKey: ["integration-clients", ...scope],
    queryFn: async () =>
      (await apiClient.get<ApiClient[]>("/acm/integrations/clients")).data,
    enabled: canManage,
    retry: false,
  });
  const mutation = useMutation({
    mutationFn: async (action: {
      kind: string;
      id?: string;
      active?: boolean;
    }) => {
      if (action.kind === "save") {
        await apiClient.put(
          "/acm/integrations/settings",
          draft ?? settings.data,
        );
        setDraft(null);
      }
      if (action.kind === "client") {
        await apiClient.post("/acm/integrations/clients", { name });
        setName("");
      }
      if (action.kind === "state")
        await apiClient.put(`/acm/integrations/clients/${action.id}`, {
          active: action.active,
        });
      if (action.kind === "revoke")
        await apiClient.delete(`/acm/integrations/keys/${action.id}`);
      if (action.kind === "issue") {
        const response = await apiClient.post<{ secret: string }>(
          `/acm/integrations/clients/${clientId}/keys`,
          {
            name: keyName,
            scopes: keyScopes,
            expiresAt: `${expires}T23:59:59+09:00`,
          },
        );
        setSecret(response.data.secret);
        setKeyName("");
      }
    },
    onSuccess: async () => {
      setNotice(t("scheduler.saved"));
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["integration-settings", ...scope] }),
        qc.invalidateQueries({ queryKey: ["integration-clients", ...scope] }),
      ]);
    },
    onError: () => setNotice(t("scheduler.saveError")),
  });
  if (!canManage) return <p role="status">{t("scheduler.masterOnly")}</p>;
  if (settings.isPending || clients.isPending)
    return <p role="status">{t("scheduler.loading")}</p>;
  if (settings.isError || clients.isError)
    return (
      <p role="alert">
        {t("scheduler.loadError")}{" "}
        <Button
          onClick={() => {
            void settings.refetch();
            void clients.refetch();
          }}
        >
          {t("scheduler.retry")}
        </Button>
      </p>
    );
  const current = draft ?? settings.data;
  const toggle = (list: ApiScope[], item: ApiScope) =>
    list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
  return (
    <section className="space-y-6">
      {notice && <p role={mutation.isError ? "alert" : "status"}>{notice}</p>}
      <form
        className="space-y-4 rounded-lg border p-5"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate({ kind: "save" });
        }}
      >
        <h2 className="text-lg font-semibold">
          {t("scheduler.tabs.settings")}
        </h2>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={current.enabled}
            onChange={(e) =>
              setDraft({ ...current, enabled: e.target.checked })
            }
          />
          {t("scheduler.enabled")}
        </label>
        <div className="flex flex-wrap gap-4">
          {API_SCOPES.map((s) => (
            <label key={s} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={current.scopes.includes(s)}
                onChange={() =>
                  setDraft({ ...current, scopes: toggle(current.scopes, s) })
                }
              />
              {t(`scheduler.scopes.${s}`)}
            </label>
          ))}
        </div>
        <p className="text-sm text-secondary">{t("scheduler.offNotice")}</p>
        <Button disabled={mutation.isPending || !draft} type="submit">
          {t("scheduler.save")}
        </Button>
      </form>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate({ kind: "client" });
        }}
      >
        <label className="min-w-0 flex-1">
          {t("scheduler.clientName")}
          <input
            required
            maxLength={100}
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <Button type="submit" disabled={mutation.isPending || !name.trim()}>
          {t("scheduler.addClient")}
        </Button>
      </form>
      <div className="space-y-4">
        {clients.data.map((c) => (
          <article key={c.id} className="space-y-3 rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">
                {c.name} ·{" "}
                {t(c.active ? "scheduler.active" : "scheduler.stopped")}
              </h3>
              <Button
                variant="outline"
                disabled={mutation.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      t(
                        c.active
                          ? "scheduler.confirmStop"
                          : "scheduler.confirmEnable",
                      ),
                    )
                  )
                    mutation.mutate({
                      kind: "state",
                      id: c.id,
                      active: !c.active,
                    });
                }}
              >
                {t(c.active ? "scheduler.stop" : "scheduler.enable")}
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {c.keys.map((k) => (
                <div key={k.id} className="min-w-0 rounded border p-3 text-sm">
                  <p className="font-medium">{k.name}</p>
                  <p className="break-all text-secondary">ID: {k.id}</p>
                  <p>
                    {k.scopes
                      .map((s) => t(`scheduler.scopes.${s}`))
                      .join(" · ")}
                  </p>
                  <p>
                    {t("scheduler.expiry")}:{" "}
                    {new Date(k.expiresAt).toLocaleString()}
                  </p>
                  <p>
                    {t("scheduler.lastUsed")}:{" "}
                    {k.lastUsedAt
                      ? new Date(k.lastUsedAt).toLocaleString()
                      : t("scheduler.unused")}
                  </p>
                  <p>
                    {t(
                      k.revokedAt
                        ? "scheduler.revoked"
                        : new Date(k.expiresAt) < new Date()
                          ? "scheduler.expired"
                          : "scheduler.active",
                    )}
                  </p>
                  <Button
                    variant="outline"
                    disabled={!!k.revokedAt || mutation.isPending}
                    onClick={() => {
                      if (window.confirm(t("scheduler.confirmRevoke")))
                        mutation.mutate({ kind: "revoke", id: k.id });
                    }}
                  >
                    {t("scheduler.revoke")}
                  </Button>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
      <form
        className="space-y-4 rounded-lg border p-5"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate({ kind: "issue" });
        }}
      >
        <h2 className="font-semibold">{t("scheduler.issue")}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <label>
            {t("scheduler.clientName")}
            <select
              required
              aria-label={t("scheduler.targetApp")}
              className={inputClass}
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">{t("scheduler.select")}</option>
              {clients.data.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("scheduler.keyName")}
            <input
              required
              maxLength={100}
              className={inputClass}
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
            />
          </label>
          <label>
            {t("scheduler.expiry")}
            <input
              required
              type="date"
              min={todayKst()}
              max={todayKst(new Date(Date.now() + 365 * 86400000))}
              className={inputClass}
              value={expires}
              onChange={(e) => setExpires(e.target.value)}
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-4">
          {API_SCOPES.map((s) => (
            <label key={s} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={keyScopes.includes(s)}
                onChange={() => setKeyScopes(toggle(keyScopes, s))}
              />
              {t(`scheduler.scopes.${s}`)}
            </label>
          ))}
        </div>
        <Button
          disabled={
            mutation.isPending ||
            !clientId ||
            !keyName.trim() ||
            !keyScopes.length ||
            !!secret
          }
          type="submit"
        >
          {t("scheduler.issue")}
        </Button>
      </form>
      {secret && (
        <section
          role="region"
          aria-label={t("scheduler.secretTitle")}
          className="space-y-3 rounded-lg border border-amber-500 p-5"
        >
          <h2 className="font-semibold">{t("scheduler.secretTitle")}</h2>
          <p>{t("scheduler.secretNotice")}</p>
          <code className="block break-all select-all">{secret}</code>
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(secret);
                setNotice(t("scheduler.copied"));
              } catch {
                setNotice(t("scheduler.copyError"));
              }
            }}
          >
            {t("scheduler.copy")}
          </Button>
          <Button onClick={() => setSecret("")}>{t("scheduler.close")}</Button>
        </section>
      )}
    </section>
  );
}
