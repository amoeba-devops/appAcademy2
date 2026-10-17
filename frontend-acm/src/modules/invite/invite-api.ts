import { apiClient } from '@/lib/api-client';
import type { LoginResponse } from '@/modules/auth/api/auth-api';

/** REQ-261018 — 사용자 초대 API. */
export type InviteRole = 'ADMIN' | 'STAFF';
export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
export interface InviteRow {
  inv_id: string;
  inv_email: string;
  inv_name: string;
  inv_role: InviteRole;
  inv_grant_config_admin: boolean;
  inv_status: InviteStatus;
  inv_expires_at: string;
  inv_mail_sent: boolean;
  accepted_at: string | null;
  created_at: string;
  invited_by_name: string | null;
}
export interface InviteSendResult {
  id: string;
  mailSent: boolean;
  expiresAt: string;
  inviteUrl?: string;
}
export interface InviteInfo {
  email: string;
  name: string;
  role: InviteRole;
  tenantName: string | null;
  expiresAt: string;
}

export const inviteApi = {
  list: async (status?: InviteStatus) =>
    (await apiClient.get<InviteRow[]>('/acm/admin/invites', { params: status ? { status } : {} })).data,
  create: async (body: { email: string; name: string; role: InviteRole; grantConfigAdmin: boolean }) =>
    (await apiClient.post<InviteSendResult>('/acm/admin/invites', body)).data,
  resend: async (id: string) => (await apiClient.post<InviteSendResult>(`/acm/admin/invites/${id}/resend`)).data,
  revoke: async (id: string) => apiClient.post(`/acm/admin/invites/${id}/revoke`),
  describe: async (token: string) =>
    (await apiClient.get<InviteInfo>(`/acm/auth/invites/${encodeURIComponent(token)}`)).data,
  accept: async (token: string, password: string) =>
    (await apiClient.post<LoginResponse>(`/acm/auth/invites/${encodeURIComponent(token)}/accept`, { password })).data,
};

/** REQ-261018B — 등록 사용자 목록(읽기 전용). */
export type RegisteredUserType = 'ALL' | 'ADMIN' | 'STAFF' | 'TEACHER' | 'STUDENT';
export interface RegisteredUser {
  source: 'CONSOLE' | 'PORTAL';
  id: string;
  ref_id: string | null;
  type: Exclude<RegisteredUserType, 'ALL'>;
  name: string;
  login_id: string;
  auth_source: string;
  permissions: string[];
  locked: boolean;
  status: string;
  created_at: string;
  last_login_at: string | null;
}
export const registeredUserApi = {
  list: async (type: RegisteredUserType, q: string) =>
    (
      await apiClient.get<{ users: RegisteredUser[]; counts: Record<RegisteredUserType, number> }>(
        '/acm/admin/registered-users',
        { params: { type, ...(q.trim() ? { q: q.trim() } : {}) } },
      )
    ).data,
};
