import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth.store";
import { apiClient } from "@/lib/api-client";

export function useConfigScope() {
  const user = useAuthStore((s) => s.user);
  return [user?.entId, user?.id] as const;
}
export function useConfigAccess() {
  const scope = useConfigScope();
  const query = useQuery({
    queryKey: ["config-access", ...scope],
    enabled: !!scope[0] && !!scope[1],
    queryFn: async () =>
      (
        await apiClient.get<{
          canManageConfig: boolean;
          canManageTenant?: boolean;
          canViewAudit?: boolean;
        }>(
          "/acm/me/config-access",
        )
      ).data,
    staleTime: 0,
    refetchOnMount: "always",
    refetchInterval: 15_000,
    retry: false,
  });
  return {
    ...query,
    allowed: !query.isError && query.data?.canManageConfig === true,
    // REQ-261015C — 테넌트 마스터(테넌트 설정 메뉴).
    tenantAllowed: !query.isError && query.data?.canManageTenant === true,
    // REQ-261021B — 감사 메뉴(테넌트 마스터 또는 감사 조회 권한).
    auditAllowed: !query.isError && query.data?.canViewAudit === true,
  };
}
