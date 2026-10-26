import { useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { isStandalone } from '@/lib/pwa';
import { useAuthStore } from '@/stores/auth.store';

/** PLN-261027 — "로그인 유지" 체크 상태(이 기기만 기억, 비밀번호는 저장하지 않는다). */
const KEEP_KEY = 'acm-login-keep';
export function loadKeepSignedIn(): boolean {
  try {
    return localStorage.getItem(KEEP_KEY) === '1';
  } catch {
    return false;
  }
}
export function saveKeepSignedIn(on: boolean): void {
  try {
    if (on) localStorage.setItem(KEEP_KEY, '1');
    else localStorage.removeItem(KEEP_KEY);
  } catch {
    // 저장 실패는 무시 — 다음 로그인 화면에서 해제 상태로 보인다.
  }
}

/** 서버와 같은 기준: 설치한 앱 또는 휴대폰·태블릿 브라우저. */
export function isMobileDevice(): boolean {
  return isStandalone() || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function issuedAt(token: string): number | null {
  try {
    const p = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { iat?: number };
    return typeof p.iat === 'number' ? p.iat * 1000 : null;
  } catch {
    return null;
  }
}

/** 하루 지난 모바일 로그인은 앱을 열거나 다시 볼 때 30일로 다시 연장한다. */
const RENEW_AFTER_MS = 24 * 3600 * 1000;

/**
 * PLN-261027 — "모바일은 로그인 지속 유지": 쓰는 동안 로그인이 끊기지 않게 자동 연장.
 * PC·브라우저는 서버가 accessToken: null 을 돌려주므로 아무 일도 하지 않는다.
 */
export function MobileSessionKeeper({ mode }: { mode: 'admin' | 'portal' }) {
  const token = useAuthStore((s) => (mode === 'admin' ? s.token : s.portal.token));
  useEffect(() => {
    if (!token || !isMobileDevice()) return;
    const renew = () => {
      const s = useAuthStore.getState();
      const current = mode === 'admin' ? s.token : s.portal.token;
      if (!current) return;
      const at = issuedAt(current);
      if (at !== null && Date.now() - at < RENEW_AFTER_MS) return;
      void apiClient
        .post<{ accessToken: string | null }>(mode === 'admin' ? '/acm/auth/refresh' : '/portal/auth/refresh')
        .then(({ data }) => {
          if (!data.accessToken) return;
          const st = useAuthStore.getState();
          if (mode === 'admin' && st.user) st.setAuth(data.accessToken, st.user);
          if (mode === 'portal' && st.portal.user) st.setPortalAuth(data.accessToken, st.portal.user);
        })
        .catch(() => undefined);
    };
    renew();
    const onVisible = () => document.visibilityState === 'visible' && renew();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [mode, token]);
  return null;
}
