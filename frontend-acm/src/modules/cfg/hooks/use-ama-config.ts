import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

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
  createdAt: string;
  updatedAt: string;
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
}

const KEY = 'ama-config';

export function useAmaConfig() {
  return useQuery({
    queryKey: [KEY],
    queryFn: async () => {
      // GET returns null in initial-setup state (no row yet).
      const res = await apiClient.get<AmaConfig | null>('/acm/admin/ama-config');
      return res.data;
    },
  });
}

export function useUpdateAmaConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateAmaConfigInput) => {
      const res = await apiClient.put<AmaConfig>('/acm/admin/ama-config', input);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
