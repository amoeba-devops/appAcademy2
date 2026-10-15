import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { Building2 } from "lucide-react";
import { clsx } from "clsx";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { useConfigScope } from "../hooks/use-config-access";
import { GeneralConfigPage } from "./general-config-page";

const ROLES = ["ADMIN", "TEACHER", "STAFF"] as const;
type Role = (typeof ROLES)[number];
interface RoleMenuItem {
  key: string;
  roles: Record<Role, boolean>;
  alwaysOn: boolean;
  locked: Role[];
}
const GROUP_OF_WORK = new Set(["chat", "projects", "documents", "drive"]);

/** REQ-261015C — /admin/tenant 테넌트 설정 (테넌트 마스터 전용). */
export function TenantSettingsPage() {
  const { t } = useTranslation("common");
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "general" ? "general" : "menus";
  return (
    <div className="w-full min-w-0">
      <header className="mb-4 flex items-center gap-2">
        <Building2 size={20} className="text-accent-700" />
        <h1 className="text-xl font-semibold text-primary">
          {t("tenantConfig.title")}
        </h1>
      </header>
      <div className="mb-6 flex gap-1 border-b" role="tablist">
        {(["menus", "general"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setParams(k === "menus" ? {} : { tab: k })}
            className={clsx(
              "-mb-px border-b-2 px-4 py-2 text-sm font-medium",
              tab === k
                ? "border-accent-600 text-accent-700"
                : "border-transparent text-secondary hover:text-primary",
            )}
          >
            {t(`tenantConfig.tabs.${k}`)}
          </button>
        ))}
      </div>
      {tab === "menus" ? <RoleMenuMatrix /> : <GeneralConfigPage embedded />}
    </div>
  );
}

function RoleMenuMatrix() {
  const { t } = useTranslation("common");
  const scope = useConfigScope();
  const qc = useQueryClient();
  const key = ["tenant-role-menus", ...scope];
  // draft: `${role}:${menuKey}` → visible
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const dirty = Object.keys(draft).length > 0;
  const query = useQuery({
    queryKey: key,
    queryFn: async () =>
      (await apiClient.get<RoleMenuItem[]>("/acm/tenant/menus")).data,
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
    mutationFn: async (items: { key: string; role: Role; visible: boolean }[]) =>
      (await apiClient.put<RoleMenuItem[]>("/acm/tenant/menus", { items }))
        .data,
    onSuccess: async (items) => {
      qc.setQueryData(key, items);
      setDraft({});
      await qc.invalidateQueries({ queryKey: ["me-menus"] });
    },
  });
  const submit = (items: { key: string; role: Role; visible: boolean }[]) =>
    save.mutate(items);
  const resetAll = () => {
    if (!query.data || !window.confirm(t("tenantConfig.menus.resetConfirm")))
      return;
    submit(
      query.data.flatMap((i) =>
        ROLES.filter(
          (r) => !i.alwaysOn && !i.locked.includes(r) && !i.roles[r],
        ).map((role) => ({ key: i.key, role, visible: true })),
      ),
    );
  };
  return (
    <section aria-label={t("tenantConfig.tabs.menus")}>
      <p className="mb-4 text-sm text-secondary">
        {t("tenantConfig.menus.description")}
      </p>
      {query.isLoading && <p role="status">{t("configAccess.loading")}</p>}
      {query.isError && (
        <div role="alert">
          {t("configAccess.loadError")}{" "}
          <Button variant="outline" onClick={() => query.refetch()}>
            {t("configAccess.retry")}
          </Button>
        </div>
      )}
      {query.data && (
        <>
          <div className="overflow-x-auto rounded-lg border bg-surface">
            <table className="w-full min-w-[28rem] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-secondary">
                  <th className="px-4 py-3">{t("tenantConfig.menus.menu")}</th>
                  {ROLES.map((r) => (
                    <th key={r} className="px-4 py-3 text-center">
                      {t(`tenantConfig.roles.${r}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {query.data.map((item, i, all) => {
                  const group = GROUP_OF_WORK.has(item.key) ? "work" : "academy";
                  const prev = all[i - 1];
                  const newGroup =
                    !prev ||
                    (GROUP_OF_WORK.has(prev.key) ? "work" : "academy") !== group;
                  return [
                    newGroup && (
                      <tr key={`g-${group}`} className="bg-[var(--gray-50)]">
                        <td
                          colSpan={4}
                          className="px-4 py-2 text-xs font-semibold text-secondary"
                        >
                          {t(`nav.group.${group}`)}
                        </td>
                      </tr>
                    ),
                    <tr key={item.key} className="border-b last:border-0">
                      <td className="px-4 py-2">{t(`nav.${item.key}`)}</td>
                      {ROLES.map((role) => {
                        const fixed = item.alwaysOn || item.locked.includes(role);
                        const id = `${role}:${item.key}`;
                        return (
                          <td key={role} className="px-4 py-2 text-center">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-indigo-600"
                              aria-label={`${t(`nav.${item.key}`)} · ${t(`tenantConfig.roles.${role}`)}`}
                              title={
                                item.alwaysOn
                                  ? t("tenantConfig.menus.fixed")
                                  : fixed
                                    ? t("tenantConfig.menus.locked")
                                    : undefined
                              }
                              disabled={fixed || save.isPending}
                              checked={draft[id] ?? item.roles[role]}
                              onChange={(e) => {
                                save.reset();
                                setDraft((old) => {
                                  const next = { ...old };
                                  if (e.target.checked === item.roles[role])
                                    delete next[id];
                                  else next[id] = e.target.checked;
                                  return next;
                                });
                              }}
                            />
                          </td>
                        );
                      })}
                    </tr>,
                  ];
                })}
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
              <span role="status" className="text-sm">
                {t("configAccess.saved")}
              </span>
            )}
            {save.isError && (
              <span role="alert" className="text-sm text-red-600">
                {t("configAccess.saveError")}
              </span>
            )}
            <Button
              variant="outline"
              disabled={save.isPending}
              onClick={resetAll}
            >
              {t("tenantConfig.menus.reset")}
            </Button>
            <Button
              variant="outline"
              disabled={!dirty || save.isPending}
              onClick={() => setDraft({})}
            >
              {t("configAccess.cancel")}
            </Button>
            <Button
              disabled={!dirty || save.isPending}
              onClick={() =>
                submit(
                  Object.entries(draft).map(([id, visible]) => {
                    const [role, menuKey] = id.split(":") as [Role, string];
                    return { key: menuKey, role, visible };
                  }),
                )
              }
            >
              {save.isPending ? t("configAccess.saving") : t("configAccess.save")}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
