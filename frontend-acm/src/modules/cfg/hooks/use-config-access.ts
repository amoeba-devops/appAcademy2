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
        await apiClient.get<{ canManageConfig: boolean }>(
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
  };
}
