import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

/** 카카오 알림톡(Solapi) 설정 (REQ-260903E). */
export interface KakaoConfig {
  apiKey: string | null;
  apiSecretIsSet: boolean;
  pfId: string | null;
  templateId: string | null;
  senderPhone: string | null;
  smsFallback: boolean;
  isActive: boolean;
  updatedAt: string | null;
}

export interface UpdateKakaoConfigInput {
  apiKey?: string;
  /** 입력 시에만 교체, 빈 문자열이면 삭제, 생략 시 유지. */
  apiSecret?: string;
  pfId?: string;
  templateId?: string;
  senderPhone?: string;
  smsFallback?: boolean;
  isActive?: boolean;
}

const KEY = 'kakao-config';

export function useKakaoConfig() {
  return useQuery({
    queryKey: [KEY],
    queryFn: async () =>
      (await apiClient.get<KakaoConfig>('/acm/admin/kakao-config')).data,
  });
}

export function useUpdateKakaoConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateKakaoConfigInput) =>
      (await apiClient.put<KakaoConfig>('/acm/admin/kakao-config', input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useTestKakao() {
  return useMutation({
    mutationFn: async (to: string) =>
      (await apiClient.post<{ ok: boolean }>('/acm/admin/kakao-config/test', { to }))
        .data,
  });
}
