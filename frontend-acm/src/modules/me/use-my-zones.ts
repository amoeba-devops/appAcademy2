import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { DEFAULT_TZ } from "@/lib/tz";

/** REQ-261015C — 포털/콘솔 공통 마이페이지 프로필(타임존). */
export interface MyProfile {
  name?: string | null;
  email?: string;
  loginId?: string;
  kind?: string;
  role?: string;
  timezone: string | null;
  tenantTimezone: string;
}
export type ProfileMode = "portal" | "console";
const url = (mode: ProfileMode) =>
  mode === "portal" ? "/portal/me" : "/acm/me/profile";

export function useMyProfile(mode: ProfileMode) {
  const portalId = useAuthStore((s) => s.portal.user?.loginId);
  const consoleId = useAuthStore((s) => s.user?.id);
  const who = mode === "portal" ? portalId : consoleId;
  return useQuery({
    enabled: !!who,
    queryKey: ["my-profile", mode, who],
    queryFn: async () => (await apiClient.get<MyProfile>(url(mode))).data,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useSaveMyProfile(mode: ProfileMode) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (timezone: string | null) =>
      (await apiClient.put<MyProfile>(url(mode), { timezone })).data,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["my-profile", mode] });
    },
  });
}

/** 표시용: 테넌트 기본 + (다르면) 사용자 타임존. 실패 시 기본값만. */
export function useMyZones(mode: ProfileMode) {
  const { data } = useMyProfile(mode);
  return {
    tenantTz: data?.tenantTimezone || DEFAULT_TZ,
    userTz: data?.timezone ?? null,
  };
}
