import { apiClient } from '@/lib/api-client';

export interface AuthUserDTO {
  id: string;
  entId: string;
  email: string;
  name: string;
  role?: 'ADMIN' | 'TEACHER' | 'STAFF' | 'APP_ADMIN';
  authSource?: 'local' | 'ama';
  /** REQ-260621 — true when the user must rotate their password. */
  mustChangePassword?: boolean;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUserDTO;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>('/acm/auth/login', {
    email,
    password,
  });
  return data;
}

/**
 * Exchange an AMA Custom App context JWT for an ACM JWT.
 * Backend validates HS256 signature, exp, scope, and appCode whitelist.
 * @see docs/analysis/ACM-AMA-SSO-REQ-1.0.0.md FR-AMA-01..15
 */
export async function exchangeAmaToken(amaToken: string): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>('/acm/auth/ama-exchange', {
    amaToken,
  });
  return data;
}

export async function me(): Promise<{ user: AuthUserDTO }> {
  const { data } = await apiClient.get<{ user: AuthUserDTO }>('/acm/auth/me');
  return data;
}

/** REQ-260621 — change own password (verifies current); clears must-change. */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await apiClient.post('/acm/auth/change-password', { currentPassword, newPassword });
}
