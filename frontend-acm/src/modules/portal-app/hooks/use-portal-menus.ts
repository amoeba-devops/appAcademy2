import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import type { PortalMenuNav } from "../types/portal-menu";

export function usePortalMenuSync() {
  const entId = useAuthStore((s) => s.portal.user?.entId);
  const qc = useQueryClient();
  useEffect(() => {
    if (!entId || typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("acm-portal-menus");
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (event.data === entId)
        void qc.invalidateQueries({ queryKey: ["portal-menus", entId] });
    };
    return () => channel.close();
  }, [qc, entId]);
}

export function usePortalMenus() {
  const user = useAuthStore((s) => s.portal.user);
  return useQuery({
    queryKey: ["portal-menus", user?.entId, user?.id, user?.kind],
    queryFn: async () =>
      (await apiClient.get<PortalMenuNav>("/portal/me/menus")).data,
    enabled: !!user,
    staleTime: 0,
    retry: 1,
    refetchOnWindowFocus: true,
    refetchInterval: 15_000,
  });
}
