import axios, { type AxiosInstance } from 'axios';
import { useAuthStore } from '@/stores/auth.store';

export const apiClient: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (res) => {
    // Unwrap backend TransformInterceptor envelope: { success, data, meta? } → data
    const body = res.data;
    if (
      body &&
      typeof body === 'object' &&
      'success' in body &&
      'data' in body
    ) {
      res.data = (body as { data: unknown }).data;
    }
    return res;
  },
  (err) => {
    if (err.response?.status === 401) {
      const path = window.location.pathname;
      useAuthStore.getState().clear();
      // Avoid redirect loop on the login page itself.
      if (!path.startsWith('/login')) {
        const returnTo = encodeURIComponent(path + window.location.search);
        window.location.assign(`/login?returnTo=${returnTo}`);
      }
    }
    return Promise.reject(err);
  },
);
