import axios, { type AxiosInstance } from 'axios';
import { useAuthStore } from '@/stores/auth.store';

export const apiClient: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 15000,
  // Serialize array params as repeated keys (?ids=a&ids=b) — NestJS Express
  // default query parser expects this form for `string[]` DTO fields.
  paramsSerializer: { indexes: null },
});

/**
 * Parent-side endpoints. Requests to these paths use the parent JWT (issued
 * by `/auth/parent/verify-otp`, signed with JWT_SECRET) — admin's ACM JWT
 * would 401 because backend uses different guard/secret.
 */
function isParentEndpoint(url: string): boolean {
  return url.startsWith('/portal/my') || url.startsWith('/auth/parent');
}

/**
 * PLN-260706 — the unified portal (student/parent/teacher) uses its own JWT for
 * `/portal/cal`, `/portal/posts`, and the authenticated portal-auth calls.
 * `/portal/my` + `/auth/parent` stay on the legacy parent OTP token.
 */
function isPortalEndpoint(url: string): boolean {
  return (
    url.startsWith('/portal/cal') ||
    url.startsWith('/portal/posts') ||
    url.startsWith('/portal/materials') ||
    // FIX-260719 — 강사 수강생관리(/portal/teacher/*)가 누락되어 포털 JWT 없이
    // 호출 → 401 → 로그인 리다이렉트. 포털 신규 API 경로는 반드시 여기 추가.
    url.startsWith('/portal/teacher') ||
    // REQ-260728C — 로비채팅 (강사 포털).
    url.startsWith('/portal/talk') ||
    url === '/portal/auth/change-password'
  );
}

apiClient.interceptors.request.use((config) => {
  const url = config.url ?? '';
  const state = useAuthStore.getState();
  const token = isPortalEndpoint(url)
    ? state.portal.token
    : isParentEndpoint(url)
      ? state.parent.token
      : state.token;
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
      const reqUrl: string = err.config?.url ?? '';
      // Auth-form endpoints return 401 for *credential* errors (wrong password,
      // wrong current password during forced rotation) — NOT session expiry.
      // Let the page surface the error inline instead of wiping the session and
      // hard-redirecting to login (which stranded first-login password changes).
      if (
        reqUrl === '/portal/auth/change-password' ||
        reqUrl === '/portal/auth/login' ||
        reqUrl === '/acm/auth/change-password'
      ) {
        return Promise.reject(err);
      }
      const isParent = isParentEndpoint(reqUrl);
      const isPortal = isPortalEndpoint(reqUrl);
      const store = useAuthStore.getState();
      // REQ-260520 FR-03 — group-based auth URLs.
      const onLoginPage =
        path.startsWith('/admin/login') ||
        path.startsWith('/parent/login') ||
        path.startsWith('/portal/login') ||
        path === '/login' ||
        path.startsWith('/login/');
      if (isPortal) {
        store.clearPortal();
        if (!onLoginPage) {
          const returnTo = encodeURIComponent(path + window.location.search);
          window.location.assign(`/portal/login?returnTo=${returnTo}`);
        }
      } else if (isParent) {
        store.clearParent();
        if (!onLoginPage) {
          const returnTo = encodeURIComponent(path + window.location.search);
          window.location.assign(`/parent/login?returnTo=${returnTo}`);
        }
      } else {
        store.clearAdmin();
        if (!onLoginPage) {
          const returnTo = encodeURIComponent(path + window.location.search);
          window.location.assign(`/admin/login?returnTo=${returnTo}`);
        }
      }
    }
    return Promise.reject(err);
  },
);
