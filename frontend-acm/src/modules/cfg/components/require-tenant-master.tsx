import { Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useConfigScope, useConfigAccess } from "../hooks/use-config-access";
import { Button } from "@/components/ui/button";

/** REQ-261015C — /admin/tenant 는 테넌트 마스터 전용. 서버도 403 으로 거부한다. */
export function RequireTenantMaster() {
  const access = useConfigAccess();
  const scope = useConfigScope();
  const { t } = useTranslation("common");
  if (access.isLoading) return <p role="status">{t("configAccess.loading")}</p>;
  if (!access.tenantAllowed)
    return (
      <div className="space-y-3 p-6">
        <h1 className="text-xl font-semibold">{t("tenantConfig.denied")}</h1>
        <p>
          {t(access.isError ? "configAccess.loadError" : "tenantConfig.required")}
        </p>
        <Button variant="outline" onClick={() => access.refetch()}>
          {t("configAccess.retry")}
        </Button>
      </div>
    );
  return (
    <div key={scope.join(":")}>
      <Outlet />
    </div>
  );
}
