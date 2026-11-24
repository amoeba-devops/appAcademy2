import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import type {
  PortalMenuItem,
  PortalMenuKind,
  PortalMenuUpdate,
} from "@/modules/portal-app/types/portal-menu";
import { useConfigScope } from "../hooks/use-config-access";

const KINDS: PortalMenuKind[] = ["TEACHER", "STUDENT"];
export function PortalMenuSection() {
  const { t } = useTranslation("common");
  const scope = useConfigScope();
  const qc = useQueryClient();
  const key = ["tenant-portal-menus", ...scope];
  const [draft, setDraft] = useState<Record<string, PortalMenuUpdate>>({});
  const dirty = Object.keys(draft).length > 0;
  const query = useQuery({
    queryKey: key,
    queryFn: async () =>
      (await apiClient.get<PortalMenuItem[]>("/acm/tenant/portal-menus")).data,
  });
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const save = useMutation({
    mutationFn: async (items: PortalMenuUpdate[]) =>
      (
        await apiClient.put<PortalMenuItem[]>("/acm/tenant/portal-menus", {
          items,
        })
      ).data,
    onSuccess: async (items) => {
      qc.setQueryData(key, items);
      setDraft({});
      if (typeof BroadcastChannel !== "undefined") {
        const channel = new BroadcastChannel("acm-portal-menus");
        channel.postMessage(scope[0]);
        channel.close();
      }
      await qc.invalidateQueries({ queryKey: ["portal-menus"] });
    },
  });
  return (
    <section className="mt-8" aria-label={t("portalMenus.title")}>
      <h2 className="mb-2 text-lg font-semibold">{t("portalMenus.title")}</h2>
      <p className="mb-4 text-sm text-secondary">
        {t("portalMenus.description")}
      </p>
      {query.isLoading && <p role="status">{t("configAccess.loading")}</p>}
      {query.isError && (
        <div role="alert">
          {t("portalMenus.loadError")}{" "}
          <Button variant="outline" onClick={() => void query.refetch()}>
            {t("configAccess.retry")}
          </Button>
        </div>
      )}
      {query.data && !query.isError && (
        <>
          <div className="overflow-x-auto rounded-lg border bg-surface">
            <table className="w-full min-w-[22rem] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-secondary">
                  <th className="px-4 py-3">{t("tenantConfig.menus.menu")}</th>
                  {KINDS.map((kind) => (
                    <th key={kind} className="px-4 py-3 text-center">
                      {t(`portalMenus.roles.${kind}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {query.data.map((item) => (
                  <tr key={item.key} className="border-b last:border-0">
                    <td className="px-4 py-2">
                      {t(`portalApp.nav.${item.key}`)}
                    </td>
                    {KINDS.map((kind) => {
                      const id = `${kind}:${item.key}`;
                      return (
                        <td key={kind} className="px-4 py-2 text-center">
                          {item.locked.includes(kind) ? (
                            <span title={t("tenantConfig.menus.locked")}>
                              —
                            </span>
                          ) : (
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-indigo-600"
                              aria-label={`${t(`portalApp.nav.${item.key}`)} · ${t(`portalMenus.roles.${kind}`)}`}
                              disabled={item.alwaysOn || save.isPending}
                              title={
                                item.alwaysOn
                                  ? t("tenantConfig.menus.fixed")
                                  : undefined
                              }
                              checked={draft[id]?.visible ?? item.roles[kind]}
                              onChange={(event) => {
                                save.reset();
                                const visible = event.target.checked;
                                setDraft((old) => {
                                  const next = { ...old };
                                  if (visible === item.roles[kind])
                                    delete next[id];
                                  else
                                    next[id] = { key: item.key, kind, visible };
                                  return next;
                                });
                              }}
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
            {dirty && (
              <span className="text-sm text-amber-700">
                {t("configAccess.unsaved")}
              </span>
            )}
            {save.isSuccess && !dirty && (
              <span role="status">{t("configAccess.saved")}</span>
            )}
            {save.isError && (
              <span role="alert">{t("configAccess.saveError")}</span>
            )}
            <Button
              variant="outline"
              disabled={!dirty || save.isPending}
              onClick={() => {
                setDraft({});
                save.reset();
              }}
            >
              {t("configAccess.cancel")}
            </Button>
            <Button
              disabled={!dirty || save.isPending}
              onClick={() => save.mutate(Object.values(draft))}
            >
              {t(save.isPending ? "configAccess.saving" : "configAccess.save")}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
