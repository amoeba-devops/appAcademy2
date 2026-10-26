import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';

/**
 * REQ-261019B·PLN-261027 — 로그인 유지 시간(PC 4h 또는 학원 설정 · 모바일 30일 자동 연장)이 끝나면 화면을 켜 둔 채여도 자동 로그아웃하고
 * 해당 로그인 화면으로 보낸다(만료 안내 `?expired=1`, 보던 화면 `returnTo`).
 */
export function tokenExpiresAt(token: string | null | undefined): number | null {
  if (!token) return null;
  try {
    const part = token.split('.')[1];
    const json = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number };
    return typeof json.exp === 'number' ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

type Slot = 'admin' | 'portal' | 'parent';
const LOGIN: Record<Slot, string> = { admin: '/admin/login', portal: '/portal/login', parent: '/parent/login' };
const AREA: Record<Slot, RegExp> = { admin: /^\/(admin|system)(\/|$)/, portal: /^\/portal(\/|$)/, parent: /^\/my(\/|$)/ };

export function expiredLoginUrl(slot: Slot): string {
  const here = window.location.pathname + window.location.search + window.location.hash;
  return `${LOGIN[slot]}?expired=1&returnTo=${encodeURIComponent(here)}`;
}

function expire(slot: Slot) {
  const s = useAuthStore.getState();
  if (slot === 'admin') s.clearAdmin();
  else if (slot === 'portal') s.clearPortal();
  else s.clearParent();
  if (AREA[slot].test(window.location.pathname)) window.location.assign(expiredLoginUrl(slot));
}

export function SessionExpiryWatcher() {
  const admin = useAuthStore((s) => s.token);
  const portal = useAuthStore((s) => s.portal.token);
  const parent = useAuthStore((s) => s.parent.token);
  useEffect(() => {
    const entries: [Slot, number | null][] = [
      ['admin', tokenExpiresAt(admin)],
      ['portal', tokenExpiresAt(portal)],
      ['parent', tokenExpiresAt(parent)],
    ];
    const check = () => {
      for (const [slot, at] of entries) if (at !== null && Date.now() >= at) expire(slot);
    };
    check();
    // 휴대폰은 백그라운드에서 타이머가 멈추므로 화면이 다시 보일 때도 확인한다.
    const timers = entries
      .filter(([, at]) => at !== null && at > Date.now())
      // 타이머 최대치(약 24.8일)보다 긴 토큰(모바일 30일)도 있어, 시간이 되면 실제 만료 여부를 다시 확인한다.
      .map(([, at]) => window.setTimeout(check, Math.min((at as number) - Date.now() + 500, 2 ** 31 - 1)));
    const onVisible = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', check);
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', check);
    };
  }, [admin, portal, parent]);
  return null;
}
