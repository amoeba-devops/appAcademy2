import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

/** 테넌트 메일(SMTP) 설정 (REQ-260902B). */
export interface MailConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string | null;
  /** 앱 비밀번호 저장 여부 (값은 절대 반환되지 않음). */
  passwordIsSet: boolean;
  fromName: string | null;
  fromAddress: string | null;
  isActive: boolean;
  updatedAt: string | null;
}

export interface UpdateMailConfigInput {
  host?: string;
  port?: number;
  secure?: boolean;
  username?: string;
  /** 입력 시에만 교체, 빈 문자열이면 삭제, 생략 시 유지. */
  password?: string;
  fromName?: string;
  fromAddress?: string;
  isActive?: boolean;
}

const KEY = 'mail-config';

export function useMailConfig() {
  return useQuery({
    queryKey: [KEY],
    queryFn: async () =>
      (await apiClient.get<MailConfig>('/acm/admin/mail-config')).data,
  });
}

export function useUpdateMailConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateMailConfigInput) =>
      (await apiClient.put<MailConfig>('/acm/admin/mail-config', input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useTestMail() {
  return useMutation({
    mutationFn: async (to: string) =>
      (await apiClient.post<{ ok: boolean }>('/acm/admin/mail-config/test', { to }))
        .data,
  });
}
