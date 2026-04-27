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
  (res) => res,
  (err) => {
    if (err.response?.status === 401) useAuthStore.getState().clear();
    return Promise.reject(err);
  },
);
