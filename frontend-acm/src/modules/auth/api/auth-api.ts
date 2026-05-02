import { apiClient } from '@/lib/api-client';

export interface AuthUserDTO {
  id: string;
  entId: string;
  email: string;
  name: string;
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

export async function me(): Promise<{ user: AuthUserDTO }> {
  const { data } = await apiClient.get<{ user: AuthUserDTO }>('/acm/auth/me');
  return data;
}
