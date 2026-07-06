import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

/** PLN-260706 — admin issuance of portal login accounts (student/parent/teacher). */
export type PortalKind = 'STUDENT' | 'PARENT' | 'TEACHER';

export interface PortalAccountView {
  id: string;
  kind: PortalKind;
  refId: string;
  loginId: string;
  status: string;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  lockedAt: string | null;
}

export interface PortalCredential {
  id: string;
  loginId: string;
  tempPassword: string;
}

const KEY = 'portal-account';

export function usePortalAccount(kind: PortalKind, refId: string | undefined) {
  return useQuery({
    enabled: !!refId,
    queryKey: [KEY, kind, refId],
    queryFn: async () => {
      const res = await apiClient.get<PortalAccountView | null>(
        '/acm/portal-accounts',
        { params: { kind, refId } },
      );
      return res.data ?? null;
    },
  });
}

export function useIssuePortalAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { kind: PortalKind; refId: string }) =>
      (await apiClient.post<PortalCredential>('/acm/portal-accounts', v)).data,
    onSuccess: (_d, v) =>
      qc.invalidateQueries({ queryKey: [KEY, v.kind, v.refId] }),
  });
}

export function useResetPortalAccount(kind: PortalKind, refId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await apiClient.post<PortalCredential>(`/acm/portal-accounts/${id}/reset`, {}))
        .data,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, kind, refId] }),
  });
}
