import { useSyncExternalStore } from 'react';

/**
 * REQ-261018D — ACM 앱(PWA): 서비스 워커 등록, 설치 제안(beforeinstallprompt), 새 버전 감지.
 * 서비스 워커는 /acm-sw.js 하나(웹 푸시 + 오프라인 화면). 예전 /acm-push-sw.js 등록은 같은 범위라 자동으로 교체된다.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaState {
  installEvent: BeforeInstallPromptEvent | null;
  installed: boolean;
  waiting: ServiceWorker | null;
}
let state: PwaState = { installEvent: null, installed: false, waiting: null };
const listeners = new Set<() => void>();
const set = (patch: Partial<PwaState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true);

export const isIos = () =>
  typeof navigator !== 'undefined' &&
  (/iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

export function usePwa() {
  return useSyncExternalStore(subscribe, () => state);
}

export async function installApp() {
  const e = state.installEvent;
  if (!e) return false;
  await e.prompt();
  const { outcome } = await e.userChoice;
  set({ installEvent: null, installed: outcome === 'accepted' });
  return outcome === 'accepted';
}

export function applyUpdate() {
  state.waiting?.postMessage({ type: 'SKIP_WAITING' });
}

export function setupPwa() {
  if (typeof window === 'undefined') return;
  set({ installed: isStandalone() });
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    set({ installEvent: e as BeforeInstallPromptEvent });
  });
  window.addEventListener('appinstalled', () => set({ installEvent: null, installed: true }));
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register('/acm-sw.js', { scope: '/' })
      .then((reg) => {
        const track = (w: ServiceWorker | null) => {
          if (!w) return;
          const check = () => {
            // 이미 화면을 제어하는 워커가 있을 때만 "새 버전" — 첫 설치는 바로 적용된다.
            if (w.state === 'installed' && navigator.serviceWorker.controller) set({ waiting: w });
          };
          check();
          w.addEventListener('statechange', check);
        };
        track(reg.waiting);
        reg.addEventListener('updatefound', () => track(reg.installing));
        // 앱을 오래 켜 두는 경우를 위해 1시간마다 확인
        setInterval(() => void reg.update().catch(() => undefined), 60 * 60 * 1000);
      })
      .catch(() => undefined);
  });
}
