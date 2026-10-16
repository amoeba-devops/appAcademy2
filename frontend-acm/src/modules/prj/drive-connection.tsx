import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";
import { clsx } from "clsx";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pickGoogle } from "./google-picker";
import { errorText, useScope, useWork } from "./project-page";
import type { DriveStatus } from "./types";

const base = "/acm/prj";

/**
 * REQ-261016 — 회사 Google Workspace 계정 연동 → 공용폴더 지정 → 사용.
 * 연동·폴더 지정·해제는 서비스 운영자(CONFIG_ADMIN)만 가능하다.
 */
export function DriveConnection() {
  const { t } = useTranslation("common");
  const qc = useQueryClient();
  const w = useWork();
  const [params] = useSearchParams();
  const q = useQuery({
    queryKey: ["prj-drive", ...useScope()],
    queryFn: async () =>
      (await apiClient.get<DriveStatus>(base + "/drive")).data,
  });
  const [mode, setMode] = useState<"new" | "pick">("new");
  const [name, setName] = useState("");
  const [changing, setChanging] = useState(false);
  const c = q.data;
  const refresh = () => qc.invalidateQueries({ queryKey: ["prj-drive"] });
  const result = params.get("drive");
  const connect = () =>
    void w.run(async () => {
      const { data } = await apiClient.post<{ url: string }>(
        base + "/drive/connect",
        { returnPath: location.pathname + location.search.replace(/[?&]drive=[a-z_]+/, "") },
      );
      location.assign(data.url);
    });
  const step = !c?.connected ? 1 : !c.rootName || changing ? 2 : 3;
  return (
    <div className="grid gap-4 rounded-lg border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{t("drive.title")}</h2>
        <span className="rounded bg-accent-50 px-2 py-0.5 text-xs text-accent-700">
          {t("drive.operatorOnly")}
        </span>
      </div>
      <ol className="flex flex-wrap gap-2 text-xs">
        {[1, 2, 3].map((n) => (
          <li
            key={n}
            className={clsx(
              "rounded-full border px-3 py-1",
              step === n
                ? "border-accent-500 bg-accent-50 text-accent-700"
                : step > n
                  ? "text-emerald-700"
                  : "text-secondary",
            )}
          >
            {step > n ? "✓ " : `${n}. `}
            {t(`drive.steps.${n}`)}
          </li>
        ))}
      </ol>
      {result === "failed" && <Alert text={t("drive.result.failed")} />}
      {result === "workspace_required" && (
        <Alert text={t("drive.result.workspaceRequired")} />
      )}
      {result === "cancelled" && (
        <p className="text-sm text-secondary">{t("drive.result.cancelled")}</p>
      )}
      {(w.error || q.error) && (
        <Alert text={w.error || errorText(q.error)} />
      )}
      {c && !c.configured && <Alert text={t("drive.notConfigured")} />}
      {c && (
        <>
          <section className="grid gap-2 rounded border p-3 text-sm">
            <h3 className="font-medium">{t("drive.account.title")}</h3>
            {c.connected ? (
              <>
                <p className="flex flex-wrap items-center gap-2">
                  {c.needsReconnect ? (
                    <AlertTriangle size={16} className="text-amber-600" />
                  ) : (
                    <CheckCircle2 size={16} className="text-emerald-600" />
                  )}
                  <span className="font-medium">{c.email}</span>
                  {c.domain && (
                    <span className="text-secondary">· {c.domain}</span>
                  )}
                  <span
                    className={clsx(
                      "rounded px-1.5 text-xs",
                      c.needsReconnect
                        ? "bg-amber-50 text-amber-700"
                        : "bg-emerald-50 text-emerald-700",
                    )}
                  >
                    {c.needsReconnect
                      ? t("drive.account.needsReconnect")
                      : t("drive.account.ok")}
                  </span>
                </p>
                {c.connectedAt && (
                  <p className="text-xs text-secondary">
                    {t("drive.account.connectedAt", {
                      at: new Date(c.connectedAt).toLocaleString(),
                      by: c.connectedByName ?? "—",
                    })}
                  </p>
                )}
                {c.needsReconnect && (
                  <p className="text-amber-700">{t("drive.account.reconnectHint")}</p>
                )}
              </>
            ) : (
              <p className="text-secondary">{t("drive.account.none")}</p>
            )}
            {c.canManage ? (
              <div className="flex flex-wrap gap-2">
                <Button disabled={w.busy || !c.configured} onClick={connect}>
                  {c.connected
                    ? t("drive.account.reconnect")
                    : t("drive.account.login")}
                </Button>
                {c.connected && (
                  <Button
                    variant="outline"
                    disabled={w.busy}
                    onClick={() => {
                      if (window.confirm(t("drive.account.disconnectConfirm")))
                        void w.run(async () => {
                          await apiClient.delete(base + "/drive");
                          await refresh();
                        });
                    }}
                  >
                    {t("drive.account.disconnect")}
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-xs text-secondary">{t("drive.readOnly")}</p>
            )}
            <p className="text-xs text-secondary">{t("drive.account.workspaceOnly")}</p>
          </section>

          {c.connected && (
            <section className="grid gap-2 rounded border p-3 text-sm">
              <h3 className="font-medium">{t("drive.folder.title")}</h3>
              {c.rootName && !changing ? (
                <>
                  <p>
                    <span className="font-medium">{c.rootName}</span>
                    <span className="text-secondary"> · {t("drive.folder.structure")}</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {c.rootId && (
                      <a
                        className="inline-flex items-center gap-1 text-accent-700 hover:underline"
                        target="_blank"
                        rel="noreferrer"
                        href={
                          "https://drive.google.com/drive/folders/" +
                          encodeURIComponent(c.rootId)
                        }
                      >
                        {t("drive.folder.open")} <ExternalLink size={14} />
                      </a>
                    )}
                    {c.canManage && (
                      <Button variant="outline" onClick={() => setChanging(true)}>
                        {t("drive.folder.change")}
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-secondary">{t("drive.folder.changeNote")}</p>
                </>
              ) : c.canManage ? (
                <form
                  className="grid gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void w.run(async () => {
                      if (mode === "pick") {
                        const id = await pickGoogle(true);
                        if (!id) return;
                        await apiClient.put(base + "/drive/root", { fileId: id });
                      } else {
                        await apiClient.put(base + "/drive/root", {
                          name: name.trim() || undefined,
                        });
                      }
                      setChanging(false);
                      await refresh();
                    });
                  }}
                >
                  <label className="flex flex-wrap items-center gap-2">
                    <input
                      type="radio"
                      name="folder-mode"
                      checked={mode === "new"}
                      onChange={() => setMode("new")}
                    />
                    {t("drive.folder.create")}
                    <Input
                      className="w-64 max-w-full"
                      maxLength={100}
                      placeholder={t("drive.folder.namePlaceholder")}
                      aria-label={t("drive.folder.nameLabel")}
                      value={name}
                      disabled={mode !== "new"}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="folder-mode"
                      checked={mode === "pick"}
                      onChange={() => setMode("pick")}
                    />
                    {t("drive.folder.pick")}
                  </label>
                  {mode === "pick" && (
                    <p className="pl-6 text-xs text-secondary">{t("drive.folder.pickHint")}</p>
                  )}
                  <div className="flex justify-end gap-2">
                    {changing && (
                      <Button type="button" variant="outline" onClick={() => setChanging(false)}>
                        {t("drive.folder.cancel")}
                      </Button>
                    )}
                    <Button disabled={w.busy || c.needsReconnect}>
                      {t("drive.folder.submit")}
                    </Button>
                  </div>
                </form>
              ) : (
                <p className="text-secondary">{t("drive.folder.none")}</p>
              )}
            </section>
          )}
          <p className="text-xs text-secondary">{t("drive.note")}</p>
        </>
      )}
    </div>
  );
}

function Alert({ text }: { text: string }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded bg-amber-50 p-2 text-sm text-amber-800">
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      {text}
    </p>
  );
}
