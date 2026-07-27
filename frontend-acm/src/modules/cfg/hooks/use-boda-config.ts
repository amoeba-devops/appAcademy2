import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

/**
 * BODA(보다에듀) 테넌트 연동 설정 (REQ-260526 FR-BODA-CFG / REQ-260619).
 *
 * `*IsSet` 필드는 BYTEA 비밀 (authKey, eventSecret) 의 저장 여부만 노출;
 * 평문은 서버 외부로 절대 반환되지 않는다 (NFR-3).
 */
export interface BodaConfig {
  id: string;
  entId: string;
  bodaWebUrl: string;
  svrUrl: string;
  webrtcUrl: string;
  companyCode: string;
  companyId: string;
  defaultRoomCode: string;
  groupRoomCode?: string | null;
  authKeyIsSet: boolean;
  eventSecretIsSet: boolean;
  webhookAllowCidrs: string | null;
  graceBeforeMin: number;
  graceAfterMin: number;
  reconcileDelayMin: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateBodaConfigInput {
  bodaWebUrl?: string;
  svrUrl?: string;
  webrtcUrl?: string;
  companyCode?: string;
  companyId?: string;
  defaultRoomCode?: string;
  groupRoomCode?: string;
  /** Send only to set/rotate; omit to keep existing. */
  authKey?: string;
  /** Send only to set/rotate; omit to keep existing. */
  eventSecret?: string;
  webhookAllowCidrs?: string;
  graceBeforeMin?: number;
  graceAfterMin?: number;
  reconcileDelayMin?: number;
  isActive?: boolean;
}

const KEY = 'boda-config';

export function useBodaConfig() {
  return useQuery({
    queryKey: [KEY],
    queryFn: async () => {
      // GET returns null in initial-setup state (no row yet).
      const res = await apiClient.get<BodaConfig | null>('/admin/cal/boda/config');
      return res.data;
    },
  });
}

export function useUpdateBodaConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateBodaConfigInput) => {
      const res = await apiClient.put<BodaConfig>('/admin/cal/boda/config', input);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
