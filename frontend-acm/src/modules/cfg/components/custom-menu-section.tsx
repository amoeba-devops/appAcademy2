import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AxiosError } from "axios";
import { ArrowDown, ArrowUp, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/ui/section";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useConfigScope } from "../hooks/use-config-access";

const ROLES = ["ADMIN", "TEACHER", "STAFF"] as const;
type Role = (typeof ROLES)[number];
interface CustomMenu {
  id: string;
  name: string;
  url: string;
  newTab: boolean;
  roles: Role[];
}
type CustomMenuInput = Omit<CustomMenu, "id">;

const BASE = "/acm/tenant/custom-menus";
const LIMIT = 20;
/** 백엔드 CUSTOM_MENU_URL_PATTERN 과 동일 — 내부 경로(/…) 또는 http(s). */
const URL_PATTERN = /^(\/($|[^/])|https?:\/\/)/;
const isExternal = (url: string) => /^https?:\/\//.test(url);

/** REQ-261026 — 테넌트 설정 > 메뉴 관리: 사용자 메뉴(북마크). */
export function CustomMenuSection() {
  const { t } = useTranslation("common");
  const scope = useConfigScope();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const key = ["tenant-custom-menus", ...scope];
  // null = 닫힘, "new" = 추가, 그 외 = 수정 대상
  const [editing, setEditing] = useState<CustomMenu | "new" | null>(null);
  const query = useQuery({
    queryKey: key,
    queryFn: async () => (await apiClient.get<CustomMenu[]>(BASE)).data,
  });
  const onSaved = async (items: CustomMenu[]) => {
    qc.setQueryData(key, items);
    await qc.invalidateQueries({ queryKey: ["me-menus"] });
  };
  const mutation = useMutation({
    mutationFn: async (
      op:
        | { kind: "create"; body: CustomMenuInput }
        | { kind: "update"; id: string; body: CustomMenuInput }
        | { kind: "delete"; id: string }
        | { kind: "order"; ids: string[] },
    ) =>
      (op.kind === "create"
        ? await apiClient.post<CustomMenu[]>(BASE, op.body)
        : op.kind === "update"
          ? await apiClient.patch<CustomMenu[]>(`${BASE}/${op.id}`, op.body)
          : op.kind === "delete"
            ? await apiClient.delete<CustomMenu[]>(`${BASE}/${op.id}`)
            : await apiClient.put<CustomMenu[]>(`${BASE}/order`, { ids: op.ids })
      ).data,
    onSuccess: async (items) => {
      setEditing(null);
      await onSaved(items);
    },
  });
  const items = query.data ?? [];
  const move = (from: number, to: number) => {
    const ids = items.map((i) => i.id);
    [ids[from], ids[to]] = [ids[to], ids[from]];
    mutation.mutate({ kind: "order", ids });
  };
  const onDelete = async (item: CustomMenu) => {
    if (
      await confirm({
        title: t("tenantConfig.customMenus.deleteConfirm", { name: item.name }),
        confirmLabel: t("tenantConfig.customMenus.delete"),
        variant: "destructive",
      })
    )
      mutation.mutate({ kind: "delete", id: item.id });
  };
  const errorText =
    mutation.error instanceof AxiosError && mutation.error.response?.status === 422
      ? t("tenantConfig.customMenus.limit", { count: LIMIT })
      : t("configAccess.saveError");
  const roleText = (roles: Role[]) =>
    roles.length === ROLES.length
      ? t("tenantConfig.customMenus.allRoles")
      : roles.map((r) => t(`tenantConfig.roles.${r}`)).join("·");

  return (
    <Section
      className="mt-8"
      title={t("tenantConfig.customMenus.title")}
      description={t("tenantConfig.customMenus.description", { count: LIMIT })}
      actions={
        <Button
          size="sm"
          disabled={items.length >= LIMIT || mutation.isPending || !query.data}
          onClick={() => {
            mutation.reset();
            setEditing("new");
          }}
        >
          <Plus size={14} className="mr-1" />
          {t("tenantConfig.customMenus.add")}
        </Button>
      }
      bodyClassName="p-0"
    >
      {query.isLoading && (
        <p role="status" className="p-4 text-sm">
          {t("configAccess.loading")}
        </p>
      )}
      {query.isError && (
        <div role="alert" className="p-4 text-sm">
          {t("configAccess.loadError")}{" "}
          <Button variant="outline" onClick={() => query.refetch()}>
            {t("configAccess.retry")}
          </Button>
        </div>
      )}
      {query.data && items.length === 0 && (
        <p className="p-4 text-sm text-secondary">{t("tenantConfig.customMenus.empty")}</p>
      )}
      {items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-secondary">
                <th className="w-20 px-4 py-3">{t("tenantConfig.customMenus.order")}</th>
                <th className="px-4 py-3">{t("tenantConfig.customMenus.name")}</th>
                <th className="px-4 py-3">{t("tenantConfig.customMenus.url")}</th>
                <th className="px-4 py-3 text-center">{t("tenantConfig.customMenus.newTab")}</th>
                <th className="px-4 py-3">{t("tenantConfig.customMenus.roles")}</th>
                <th className="w-24 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="px-2 py-1">
                    <div className="flex">
                      <IconButton
                        label={t("tenantConfig.customMenus.moveUp")}
                        disabled={i === 0 || mutation.isPending}
                        onClick={() => move(i, i - 1)}
                      >
                        <ArrowUp size={14} />
                      </IconButton>
                      <IconButton
                        label={t("tenantConfig.customMenus.moveDown")}
                        disabled={i === items.length - 1 || mutation.isPending}
                        onClick={() => move(i, i + 1)}
                      >
                        <ArrowDown size={14} />
                      </IconButton>
                    </div>
                  </td>
                  <td className="px-4 py-2 font-medium">{item.name}</td>
                  <td className="max-w-[18rem] px-4 py-2">
                    <span className="flex items-center gap-1 truncate text-secondary" title={item.url}>
                      {isExternal(item.url) && <ExternalLink size={12} className="shrink-0" />}
                      <span className="truncate">{item.url}</span>
                    </span>
                  </td>
                  <td className="px-4 py-2 text-center">{item.newTab ? "✓" : "—"}</td>
                  <td className="px-4 py-2 text-secondary">{roleText(item.roles)}</td>
                  <td className="px-2 py-1">
                    <div className="flex justify-end">
                      <IconButton
                        label={t("tenantConfig.customMenus.edit")}
                        disabled={mutation.isPending}
                        onClick={() => {
                          mutation.reset();
                          setEditing(item);
                        }}
                      >
                        <Pencil size={14} />
                      </IconButton>
                      <IconButton
                        label={t("tenantConfig.customMenus.delete")}
                        disabled={mutation.isPending}
                        onClick={() => void onDelete(item)}
                      >
                        <Trash2 size={14} />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {mutation.isError && !editing && (
        <p role="alert" className="px-4 py-3 text-sm text-red-600">
          {errorText}
        </p>
      )}
      {editing && (
        <CustomMenuDialog
          initial={editing === "new" ? null : editing}
          pending={mutation.isPending}
          error={mutation.isError ? errorText : null}
          onClose={() => setEditing(null)}
          onSubmit={(body) =>
            mutation.mutate(
              editing === "new"
                ? { kind: "create", body }
                : { kind: "update", id: editing.id, body },
            )
          }
        />
      )}
    </Section>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-md text-secondary hover:bg-[var(--gray-100)] hover:text-primary disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

function CustomMenuDialog({
  initial,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  initial: CustomMenu | null;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (body: CustomMenuInput) => void;
}) {
  const { t } = useTranslation("common");
  const [form, setForm] = useState<CustomMenuInput>(
    initial ?? { name: "", url: "", newTab: false, roles: [...ROLES] },
  );
  // 외부 링크는 새 탭이 기본 — 사용자가 직접 바꾸기 전까지만 따라간다.
  const [newTabTouched, setNewTabTouched] = useState(!!initial);
  const name = form.name.trim();
  const url = form.url.trim();
  const urlInvalid = url.length > 0 && !URL_PATTERN.test(url);
  const valid = name.length > 0 && url.length > 0 && !urlInvalid && form.roles.length > 0;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t(initial ? "tenantConfig.customMenus.editTitle" : "tenantConfig.customMenus.addTitle")}
          </DialogTitle>
        </DialogHeader>
        <form
          className="mt-4 grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) onSubmit({ ...form, name, url });
          }}
        >
          <label className="grid gap-1 text-sm">
            <span className="font-medium">{t("tenantConfig.customMenus.name")} *</span>
            <Input
              value={form.name}
              maxLength={30}
              autoFocus
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">{t("tenantConfig.customMenus.url")} *</span>
            <Input
              value={form.url}
              maxLength={500}
              inputMode="url"
              placeholder="/admin/csl"
              aria-invalid={urlInvalid}
              onChange={(e) => {
                const next = e.target.value;
                setForm({
                  ...form,
                  url: next,
                  newTab: newTabTouched ? form.newTab : isExternal(next.trim()),
                });
              }}
            />
            <span className={urlInvalid ? "text-xs text-red-600" : "text-xs text-secondary"}>
              {t(urlInvalid ? "tenantConfig.customMenus.urlInvalid" : "tenantConfig.customMenus.urlHint")}
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-indigo-600"
              checked={form.newTab}
              onChange={(e) => {
                setNewTabTouched(true);
                setForm({ ...form, newTab: e.target.checked });
              }}
            />
            {t("tenantConfig.customMenus.newTabLabel")}
          </label>
          <fieldset className="grid gap-2 text-sm">
            <legend className="mb-1 font-medium">{t("tenantConfig.customMenus.roles")} *</legend>
            <div className="flex flex-wrap gap-4">
              {ROLES.map((role) => (
                <label key={role} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-indigo-600"
                    checked={form.roles.includes(role)}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        roles: e.target.checked
                          ? ROLES.filter((r) => r === role || form.roles.includes(r))
                          : form.roles.filter((r) => r !== role),
                      })
                    }
                  />
                  {t(`tenantConfig.roles.${role}`)}
                </label>
              ))}
            </div>
            <span className="text-xs text-secondary">{t("tenantConfig.customMenus.rolesHint")}</span>
          </fieldset>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("configAccess.cancel")}
            </Button>
            <Button type="submit" disabled={!valid || pending}>
              {pending ? t("configAccess.saving") : t("configAccess.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
