import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth.store";
import { usePortalMenus } from "../hooks/use-portal-menus";
import type { PortalMenuKey } from "../types/portal-menu";

function MenuStatus({ error, retry }: { error: boolean; retry: () => void }) {
  const { t } = useTranslation("common");
  if (!error) return <p role="status">{t("configAccess.loading")}</p>;
  return (
    <div role="alert" className="space-y-3 text-sm">
      <p>{t("portalMenus.loadError")}</p>
      <Button variant="outline" onClick={retry}>
        {t("configAccess.retry")}
      </Button>
    </div>
  );
}

export function PortalLanding() {
  const menus = usePortalMenus();
  if (menus.isError || !menus.data)
    return (
      <MenuStatus error={menus.isError} retry={() => void menus.refetch()} />
    );
  return <Navigate to={menus.data.home} replace />;
}

export function RequirePortalMenu({
  menu,
  children,
}: {
  menu: PortalMenuKey;
  children: ReactNode;
}) {
  const menus = usePortalMenus();
  if (menus.isError || !menus.data)
    return (
      <MenuStatus error={menus.isError} retry={() => void menus.refetch()} />
    );
  if (!menus.data.visible.includes(menu))
    return <Navigate to={menus.data.home} replace />;
  return <>{children}</>;
}

export function PortalEventDetailGate({ children }: { children: ReactNode }) {
  const kind = useAuthStore((s) => s.portal.user?.kind);
  // Students use shared event details through class links, not the teacher calendar.
  return (
    <RequirePortalMenu menu={kind === "TEACHER" ? "calendar" : "links"}>
      {children}
    </RequirePortalMenu>
  );
}
