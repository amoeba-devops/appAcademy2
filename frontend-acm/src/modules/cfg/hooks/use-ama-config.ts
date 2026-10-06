import { useConfigScope } from "./use-config-access";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

/** AMA 연동 설정 (REQ-260609B). */
export interface AmaConfig {
  id: string;
  entId: string;
  amaEntityId: string;
  appCode: string;
  isActive: boolean;
  /** local_config: whether a Custom App HS256 secret is stored (value never returned). */
  customAppSecretIsSet: boolean;
  expectedScope?: string | null;
  /** local_config: whether a Custom Category HS256 secret is stored (value never returned). */
  categorySecretIsSet: boolean;
  /** Expected eccSlug for custom_category:context tokens. */
  categorySlug?: string | null;
  /** REQ-261006 — ACM 알림을 AMA 알림으로 전달 */
  forwardEnabled: boolean;
  forwardTypes: string[];
  forwardEnabledAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const AMA_FORWARD_TYPES = [
  "CSL_CREATED",
  "CSL_STAGE",
  "CAL_CREATED",
  "CAL_UPDATED",
  "CHAT_MENTION",
] as const;
export type AmaForwardType = (typeof AMA_FORWARD_TYPES)[number];

export interface AmaForwardStatus {
  counts: Record<"PENDING" | "SENT" | "FAILED" | "SKIPPED", number>;
  lastSentAt: string | null;
  lastError: string | null;
  amaLinkedUsers: number;
  recent: Array<{
    id: string;
    type: string;
    status: string;
    attempts: number;
    recipients: number;
    error: string | null;
    sentAt: string | null;
    createdAt: string;
  }>;
}

export interface UpdateAmaConfigInput {
  amaEntityId?: string;
  appCode?: string;
  isActive?: boolean;
  /** Send only to set/rotate; omit to keep existing. */
  customAppSecret?: string;
  expectedScope?: string;
  /** Custom Category secret — send only to set/rotate; omit to keep existing. */
  categorySecret?: string;
  categorySlug?: string;
  forwardEnabled?: boolean;
  forwardTypes?: string[];
}

const KEY = "ama-config";

export function useAmaConfig() {
  return useQuery({
    queryKey: [KEY, ...useConfigScope()],
    queryFn: async () => {
      // GET returns null in initial-setup state (no row yet).
      const res = await apiClient.get<AmaConfig | null>(
        "/acm/admin/ama-config",
      );
      return res.data;
    },
  });
}

export function useUpdateAmaConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateAmaConfigInput) => {
      const res = await apiClient.put<AmaConfig>(
        "/acm/admin/ama-config",
        input,
      );
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

/** REQ-261006 — AMA 알림 전달 현황 (최근 7일). */
export function useAmaForwardStatus(enabled = true) {
  return useQuery({
    queryKey: [KEY, "forward-status", ...useConfigScope()],
    enabled,
    refetchInterval: 30_000,
    queryFn: async () => {
      const res = await apiClient.get<AmaForwardStatus>(
        "/acm/admin/ama-config/forward/status",
      );
      return res.data;
    },
  });
}

/** REQ-261006 — 현재 사용자에게 AMA 테스트 알림 전송. */
export function useAmaForwardTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<{ created: number; skipped: number }>(
        "/acm/admin/ama-config/forward/test",
      );
      return res.data;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: [KEY, "forward-status"] }),
  });
}
