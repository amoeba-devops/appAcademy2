import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

/**
 * Mirrors `BodaLaunchContextResponseDto` from backend. Kept inline rather
 * than re-exported because backend/frontend are separate TS projects (same
 * convention as `AmaPlatformUser`).
 */
export type BodaRoomStatus =
  | 'PENDING'
  | 'OPEN'
  | 'STARTED'
  | 'PAUSED'
  | 'ENDED'
  | 'CLOSED';

export interface BodaLaunchContext {
  meetKey: string;
  roomCode: string;
  meetIdx?: string | null;
  status: BodaRoomStatus;
  userType: 11 | 12 | 13;
  uid: string;
  uname: string;
  lang: 'ko' | 'en';
  appApiUrl: string;
  evtTitle: string;
  evtStartAt: string;
  evtEndAt: string;
}

export interface BodaRoomStatusInfo {
  status: BodaRoomStatus;
  openedAt?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  closedAt?: string | null;
}

/**
 * Pull the BODA launch context for an event. Called once on page mount —
 * `enabled` guard lets the page render an explicit auth-check spinner before
 * firing.
 */
export function useBodaLaunchContext(
  evtId: string | undefined,
  lang: 'ko' | 'en' | undefined,
  opts: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: ['boda', 'launch-context', evtId, lang],
    enabled: opts.enabled !== false && !!evtId,
    queryFn: async () => {
      const res = await apiClient.get<BodaLaunchContext>(
        '/cal/boda/launch-context',
        { params: { evtId, lang } },
      );
      return res.data;
    },
    // Time-window failures are 403 — surface immediately, no retry storm.
    retry: false,
    staleTime: 30_000,
  });
}

/**
 * Lightweight status poll. Students keep this firing while the room is in
 * PENDING. The hook is intentionally generic — pass `refetchInterval: 10_000`
 * from the caller to enable polling.
 */
export function useBodaRoomStatus(
  evtId: string | undefined,
  opts: { enabled?: boolean; refetchInterval?: number | false } = {},
) {
  return useQuery({
    queryKey: ['boda', 'room-status', evtId],
    enabled: opts.enabled !== false && !!evtId,
    queryFn: async () => {
      const res = await apiClient.get<BodaRoomStatusInfo>(
        `/cal/boda/rooms/${evtId}/status`,
      );
      return res.data;
    },
    refetchInterval:
      opts.refetchInterval === false ? false : (opts.refetchInterval ?? false),
    refetchIntervalInBackground: false,
    retry: 1,
  });
}

/**
 * Vendor `BodaAppApi.js` shape — we only call two functions, so the surface
 * is intentionally narrow. Declared on `window.BodaAppApi` (BodaAppApi.js is
 * a global-mode script per vendor docs SPEC_823).
 */
export interface BodaAppApiGlobal {
  /**
   * Teacher entry — opens (creates+joins) the room.
   * vendor params: { CCd, CId, AuCd, UTy=11, dup=1, meetKey, roomCode,
   *                  joinUser:{UId,UNm}, joinOpt:{lang} }
   * The launch context provides all of these but `AuCd` (NFR-3) — we send it
   * only when explicitly enabled by Q1 outcome. Until then, leave undefined
   * and let the BODA Client / TCPS resolve it.
   */
  bodaOpen?: (params: unknown) => void;

  /** Student entry — joins an existing room. Same params minus `dup`. */
  bodaJoin?: (params: unknown) => void;

  /** Optional error sink — vendor calls this on `BODA-NOT_INSTALLED` etc. */
  setErrorCallback?: (cb: (code: string, message?: string) => void) => void;
}

declare global {
  interface Window {
    BodaAppApi?: BodaAppApiGlobal;
  }
}

/**
 * Idempotently load BodaAppApi.js from the launch context. Resolves once
 * `window.BodaAppApi.bodaOpen` (or `bodaJoin`) is defined. Rejects after
 * 10s. Caller decides whether to fall back to WebRTC.
 */
export function loadBodaAppApi(scriptUrl: string): Promise<BodaAppApiGlobal> {
  return new Promise((resolve, reject) => {
    if (window.BodaAppApi?.bodaOpen || window.BodaAppApi?.bodaJoin) {
      resolve(window.BodaAppApi);
      return;
    }
    const SCRIPT_ID = 'boda-app-api-script';
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!existing) {
      const tag = document.createElement('script');
      tag.id = SCRIPT_ID;
      tag.src = scriptUrl;
      tag.async = true;
      tag.onerror = () => reject(new Error('BODA-SCRIPT_LOAD_FAILED'));
      document.head.appendChild(tag);
    }
    // Poll for the global. Vendor docs say BodaAppApi.js attaches on DOMContentLoaded
    // but in modern SPAs that may already have fired — poll instead.
    const start = Date.now();
    const tick = () => {
      if (window.BodaAppApi?.bodaOpen || window.BodaAppApi?.bodaJoin) {
        resolve(window.BodaAppApi);
        return;
      }
      if (Date.now() - start > 10_000) {
        reject(new Error('BODA-SCRIPT_TIMEOUT'));
        return;
      }
      window.setTimeout(tick, 200);
    };
    tick();
  });
}
