import { Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useConfigScope, useConfigAccess } from "../hooks/use-config-access";
import { Button } from "@/components/ui/button";
export function RequireConfigAdmin() {
  const access = useConfigAccess();
  const scope = useConfigScope();
  const { t } = useTranslation("common");
  if (access.isLoading) return <p role="status">{t("configAccess.loading")}</p>;
  if (!access.allowed)
    return (
      <div className="space-y-3 p-6">
        <h1 className="text-xl font-semibold">{t("configAccess.denied")}</h1>
        <p>
          {t(
            access.isError ? "configAccess.loadError" : "configAccess.required",
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
