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

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const { data } = await apiClient.post<ApiEnvelope<LoginResponse>>('/acm/auth/login', {
    email,
    password,
  });
  return data.data;
}

export async function me(): Promise<{ user: AuthUserDTO }> {
  const { data } = await apiClient.get<ApiEnvelope<{ user: AuthUserDTO }>>('/acm/auth/me');
  return data.data;
}
