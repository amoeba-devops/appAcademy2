import { Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useConfigAccess, useConfigScope } from "../hooks/use-config-access";

export function RequireApiGuide() {
  const access = useConfigAccess(),
    scope = useConfigScope();
  const { t } = useTranslation("common");
  if (access.isLoading) return <p role="status">{t("configAccess.loading")}</p>;
  if (!access.allowed && !access.apiAllowed)
    return (
      <div className="space-y-3 p-6">
        <h1 className="text-xl font-semibold">{t("tenantConfig.denied")}</h1>
        <p>
          {t(
            access.isError ? "configAccess.loadError" : "scheduler.masterOnly",
          )}
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
