import { Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useConfigScope, useConfigAccess } from "../hooks/use-config-access";
import { Button } from "@/components/ui/button";

/**
 * REQ-261018 — 연동 설정(AI·AMA·화상강의·카카오·GA4). 메뉴는 테넌트 마스터에게만 보이지만,
 * 서비스 운영자도 링크 없이 들어올 수 있다(서버 TenantSettingsGuard 와 같은 기준).
 */
export function RequireTenantSettings() {
  const access = useConfigAccess();
  const scope = useConfigScope();
  const { t } = useTranslation("common");
  if (access.isLoading) return <p role="status">{t("configAccess.loading")}</p>;
  if (!access.allowed && !access.tenantAllowed)
    return (
      <div className="space-y-3 p-6">
        <h1 className="text-xl font-semibold">{t("tenantConfig.denied")}</h1>
        <p>{t(access.isError ? "configAccess.loadError" : "tenantConfig.required")}</p>
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

/** 연동 설정 화면의 "목록으로" — 테넌트 마스터는 테넌트 설정의 연동 탭으로. */
export function useIntegrationBackLink() {
  const { tenantAllowed } = useConfigAccess();
  return tenantAllowed ? "/admin/tenant?tab=integrations" : "/admin/config";
}
