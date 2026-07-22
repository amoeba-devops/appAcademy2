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

export interface BodaInviteeView {
  kind: 'STUDENT' | 'TEACHER' | 'PARENT';
  refId: string;
  name: string;
  subLabel: string | null;
  notified: boolean;
}

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
  // SPEC_823 v823.002 — bodaOpen()/bodaJoin() 의 1번째 위치 인자(bodaWeb) +
  // joinUser 의 회사 식별자(CId/CCd).
  bodaWeb: string;
  companyId?: string | null;
  companyCode?: string | null;
  evtTitle: string;
  evtStartAt: string;
  evtEndAt: string;
  // PLN-260716 — 일정 메모(설명)
  evtDescription?: string | null;
  // REQ-260619 FR-LX-4 — 헤더 컨텍스트 + 임베디드 강의실 URL
  ownerName: string;
  evtSource: 'MANUAL' | 'INSTANT' | 'CLS_SESSION';
  invitees: BodaInviteeView[];
  embedUrl?: string | null;
  webBrowserUrl?: string | null;
}

export interface BodaRoomStatusInfo {
  status: BodaRoomStatus;
  openedAt?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  closedAt?: string | null;
  closeType?: string | null;
}

/**
 * Pull the BODA launch context for an event. Called once on page mount —
 * `enabled` guard lets the page render an explicit auth-check spinner before
 * firing.
 */
export function useBodaLaunchContext(
  evtId: string | undefined,
  lang: 'ko' | 'en' | undefined,
  opts: { enabled?: boolean; portal?: boolean; pollWhilePending?: boolean } = {},
) {
  // PLN-260716 — portal(학생/강사) 세션이면 포털 가드 엔드포인트를 쓴다.
  const base = opts.portal
    ? '/portal/cal/boda/launch-context'
    : '/cal/boda/launch-context';
  return useQuery({
    queryKey: ['boda', 'launch-context', opts.portal ? 'portal' : 'console', evtId, lang],
    enabled: opts.enabled !== false && !!evtId,
    queryFn: async () => {
      const res = await apiClient.get<BodaLaunchContext>(base, {
        params: { evtId, lang },
      });
      return res.data;
    },
    // Time-window failures are 403 — surface immediately, no retry storm.
    retry: false,
    staleTime: 30_000,
    // 포털엔 별도 status 폴링 엔드포인트가 없어, PENDING 동안 컨텍스트를 재조회해
    // 강사가 방을 열면 자동 반영한다.
    refetchInterval: opts.pollWhilePending
      ? (q) => (q.state.data?.status === 'PENDING' ? 10_000 : false)
      : false,
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
 * Vendor `BodaAppApi.js` shapes — SPEC_823 v823.002 (BODA APP API 가이드).
 * `bodaOpen`/`bodaJoin` take **5 positional arguments**, NOT a single object:
 *   (bodaWeb, joinUser, roomOpt, appOpt, joinOpt)
 */
export interface BodaJoinUser {
  /** 사용자 인덱스 (항상 0) */
  UI?: number;
  /** 등록할 사용자 아이디 (≤32). 공란이면 임시 사용자 */
  UId?: string;
  /** 사용자 이름 (≤32) */
  UNm: string;
  /** 사용자 타입 — 10 참석자 / 11 강사 / 12 학생 / 13 운영자 */
  UTy: number;
  /** 회사 인덱스 (opt) */
  CCd?: number;
  /** 회사 아이디 (opt) */
  CId?: string;
  /** 인증키 (opt) */
  AuCd?: number;
}

/** bodaOpen: { roomCode, roomTitle, roomPwd, dup, meetKey } / bodaJoin: { meetKey, meetIdx, inviteCode } */
export interface BodaRoomOpt {
  roomCode?: string;
  roomTitle?: string;
  roomPwd?: string;
  dup?: number;
  /** SPEC v823.002: String (was Integer) — "+" 문자열 사용 불가 */
  meetKey?: string;
  meetIdx?: string;
  inviteCode?: string;
}

export interface BodaJoinOpt {
  lang?: 'ko' | 'en';
  /** true 이면 윈도우 앱 자동실행 (823.001.8) */
  hide?: boolean;
}

type BodaEnterFn = (
  bodaWeb: string,
  joinUser: BodaJoinUser,
  roomOpt: BodaRoomOpt,
  appOpt?: Record<string, unknown>,
  joinOpt?: BodaJoinOpt,
) => void;

export interface BodaAppApiGlobal {
  /** Teacher entry — opens (creates+joins) the room. */
  bodaOpen?: BodaEnterFn;
  /** Student entry — joins an existing room. */
  bodaJoin?: BodaEnterFn;
  /** Error sink — vendor calls this on `BODA-NOT_INSTALLED` etc. (823.001.4) */
  setErrorCallback?: (cb: (code: string, message?: string) => void) => void;
}

// SPEC_823 v823.002 room-metadata caps: roomTitle ≤100, roomPwd ≤8. The vendor
// truncates roomTitle itself, but we clamp client-side so what we send is
// explicit and never trips the length guard.
const ROOM_TITLE_MAX = 100;
const ROOM_PWD_MAX = 8;

/**
 * Build the 5 positional args and invoke `bodaOpen` (teacher) / `bodaJoin`
 * (student) per SPEC_823 v823.002. Centralizes the mapping so the two call
 * sites (autoStart side-effect + desktop card) can't drift.
 *
 * REQ-260722:
 *   - FR-2: teacher open carries `roomTitle = evtTitle` so the vendor client
 *     shows the class name instead of a default title.
 *   - FR-5: optional `roomPwd` (≤8) for password-protected rooms.
 *   - FR-6: `appOpt` is now caller-supplied instead of a hard-coded `{}` so
 *     attendance/material features (AO_ScCap, agendaAdd, …) can be layered in.
 *
 * @returns false if the vendor function is missing (client not installed).
 */
export function enterBodaRoom(
  api: BodaAppApiGlobal,
  ctx: BodaLaunchContext,
  opts: {
    isTeacher: boolean;
    hide?: boolean;
    roomPwd?: string;
    appOpt?: Record<string, unknown>;
  },
): boolean {
  const fn = opts.isTeacher ? api.bodaOpen : api.bodaJoin;
  if (!fn) return false;

  const joinUser: BodaJoinUser = {
    UI: 0,
    UId: ctx.uid,
    UNm: ctx.uname,
    UTy: ctx.userType,
  };
  if (ctx.companyId) joinUser.CId = ctx.companyId;
  const ccd = ctx.companyCode != null ? Number(ctx.companyCode) : NaN;
  if (Number.isFinite(ccd)) joinUser.CCd = ccd;

  const roomOpt: BodaRoomOpt = { meetKey: ctx.meetKey };
  if (opts.isTeacher) {
    roomOpt.roomCode = ctx.roomCode;
    roomOpt.dup = 1;
    // FR-2 — room title = class title (bodaOpen only).
    const title = ctx.evtTitle?.trim();
    if (title) roomOpt.roomTitle = title.slice(0, ROOM_TITLE_MAX);
    // FR-5 — optional room password (bodaOpen only).
    if (opts.roomPwd) roomOpt.roomPwd = opts.roomPwd.slice(0, ROOM_PWD_MAX);
  } else if (ctx.meetIdx) {
    // Student join: meetKey (sent above) takes priority over meetIdx per SPEC
    // §2.2.2; meetIdx is added only when the room has already been opened.
    roomOpt.meetIdx = ctx.meetIdx;
  }

  const joinOpt: BodaJoinOpt = { lang: ctx.lang };
  if (opts.hide) joinOpt.hide = true;

  // FR-6 — appOpt is caller-supplied; empty object preserves prior behavior.
  fn(ctx.bodaWeb, joinUser, roomOpt, opts.appOpt ?? {}, joinOpt);
  return true;
}

declare global {
  interface Window {
    BodaAppApi?: BodaAppApiGlobal;
  }
}

/**
 * Platform bucket for BODA entry UX (REQ-260722 FR-4). SPEC_823 §1.3: the app
 * install can be self-detected on Windows but NOT on Mac/Mobile, so those
 * platforms must be offered the browser-entry path with equal prominence.
 * `ua` is injectable for tests; defaults to navigator.userAgent.
 */
export type BodaPlatform = 'windows' | 'mac' | 'mobile' | 'other';

export function detectBodaPlatform(ua?: string): BodaPlatform {
  const s =
    (ua ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '')) || '';
  if (/Android|iPhone|iPad|iPod/i.test(s)) return 'mobile';
  if (/Windows|Win64|Win32/i.test(s)) return 'windows';
  if (/Macintosh|Mac OS X/i.test(s)) return 'mac';
  return 'other';
}

/**
 * True when the client can't self-verify app install (Mac/Mobile) — the browser
 * entry button should then be shown with equal prominence (FR-4).
 */
export function bodaInstallUndetectable(platform: BodaPlatform): boolean {
  return platform === 'mac' || platform === 'mobile';
}

/**
 * Log a BODA entry error for diagnostics (REQ-260722 FR-3). Captures the vendor
 * error code plus the optional `reason` (SPEC error-callback 2nd arg) and WB-*
 * WAS codes. No PII — kept centralized so the error callback and the catch path
 * report identically.
 */
export function logBodaError(code: string, reason?: string): void {
  // eslint-disable-next-line no-console
  console.warn(
    `[BODA] entry error code=${code}${reason ? ` reason=${reason}` : ''}`,
  );
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
