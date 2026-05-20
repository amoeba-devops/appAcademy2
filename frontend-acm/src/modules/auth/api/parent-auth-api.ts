import { apiClient } from '@/lib/api-client';
import type { ParentUser } from '@/stores/auth.store';

export interface SendOtpResponse {
  message: string;
}

export interface VerifyOtpResponse {
  accessToken: string;
  parent: ParentUser;
}

export async function sendOtp(phone: string): Promise<SendOtpResponse> {
  const { data } = await apiClient.post<SendOtpResponse>('/auth/parent/send-otp', { phone });
  return data;
}

export async function verifyOtp(phone: string, otp: string): Promise<VerifyOtpResponse> {
  const { data } = await apiClient.post<VerifyOtpResponse>('/auth/parent/verify-otp', { phone, otp });
  return data;
}
