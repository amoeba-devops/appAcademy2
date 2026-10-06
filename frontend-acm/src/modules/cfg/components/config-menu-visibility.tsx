import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { useConfigScope } from "../hooks/use-config-access";
import type { ConfigMenuItem } from "../types/config-menu";

export function ConfigMenuVisibility() {
  const { t } = useTranslation("common");
  const scope = useConfigScope();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const dirty = Object.keys(draft).length > 0;
  const key = ["config-menus", ...scope];
  const query = useQuery({
    queryKey: key,
    queryFn: async () =>
      (await apiClient.get<ConfigMenuItem[]>("/acm/me/config-menus")).data,
  });
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  const save = useMutation({
    mutationFn: async () =>
      (
        await apiClient.put<ConfigMenuItem[]>("/acm/me/config-menus", {
          items: Object.entries(draft).map(([key, visible]) => ({
            key,
            visible,
          })),
        })
      ).data,
    onSuccess: async (items) => {
      qc.setQueryData(key, items);
      setDraft({});
      await qc.invalidateQueries({ queryKey: ["me-menus"] });
    },
  });
  return (
    <section
      className="rounded-lg border bg-surface p-5"
      aria-label={t("configAccess.menuTitle")}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t("configAccess.menuTitle")}</h2>
        <span className="rounded bg-accent-50 px-3 py-1 text-sm">
          {t("configAccess.level")} · CONFIG_ADMIN
        </span>
      </div>
      <p className="my-3 text-sm text-secondary">{t("configAccess.scope")}</p>
      {query.isLoading && <p role="status">{t("configAccess.loading")}</p>}
      {query.isError && (
        <div role="alert">
          {t("configAccess.loadError")}{" "}
          <Button variant="outline" onClick={() => query.refetch()}>
            {t("configAccess.retry")}
          </Button>
        </div>
      )}
      {query.data && !query.isError && (
        <>
          <fieldset
            disabled={save.isPending}
            className="grid gap-x-8 sm:grid-cols-2"
          >
            {query.data.map((item) => (
              <label
                key={item.key}
                className="flex items-center justify-between gap-4 border-b py-3 text-sm"
              >
                <span>{t(`nav.${item.key}`)}</span>
                <span className="flex items-center gap-2">
                  {item.alwaysOn && (
                    <span className="text-xs text-secondary">
                      {t(
                        item.key === "config"
                          ? "configAccess.permissionOnly"
                          : "configAccess.fixed",
                      )}
                    </span>
                  )}
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-indigo-600"
                    disabled={item.alwaysOn}
                    checked={item.alwaysOn || (draft[item.key] ?? item.visible)}
                    onChange={(e) => {
                      save.reset();
                      setDraft((old) => {
                        const next = { ...old };
                        if (e.target.checked === item.visible)
                          delete next[item.key];
                        else next[item.key] = e.target.checked;
                        return next;
                      });
                    }}
                  />
                </span>
              </label>
            ))}
          </fieldset>
          <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
            {dirty && (
              <span className="text-sm text-amber-700">
                {t("configAccess.unsaved")}
              </span>
            )}
            {save.isSuccess && !dirty && (
              <span role="status" className="text-sm">
                {t("configAccess.saved")}
              </span>
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
              onClick={() => save.mutate()}
            >
              {t(save.isPending ? "configAccess.saving" : "configAccess.save")}
            </Button>
          </div>
          {save.isError && (
            <p role="alert" className="mt-3 text-sm text-red-600">
              {t("configAccess.saveError")}
            </p>
          )}
        </>
      )}
    </section>
  );
}
