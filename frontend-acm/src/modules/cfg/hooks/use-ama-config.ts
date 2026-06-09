import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

/** AMA 연동 설정 (REQ-260609B). */
export interface AmaConfig {
  id: string;
  entId: string;
  amaEntityId: string;
  appCode: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateAmaConfigInput {
  amaEntityId?: string;
  appCode?: string;
  isActive?: boolean;
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
