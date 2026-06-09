/**
 * BODA(보다에듀) 외부 연동 — 공유 타입 정의.
 *
 * - REQ-260526 §2.3 (3 채널 — APP API · SERVER API · 이벤트 Webhook)
 * - 본 파일은 SERVER API 응답 + 도메인 enum 일부. 이벤트 Webhook payload 는
 *   `webhook/` 디렉토리에서 별도 정의.
 */

/**
 * BODA 룸 상태 — DB CHECK 제약과 동기화 (sql/acm/910 참조).
 *   PENDING  : ACM 측에서 meetKey 선발급, BODA 측 룸은 아직 없음
 *   OPEN     : 강사 bodaOpen() → BODA 룸 실체화 (이벤트 1)
 *   STARTED  : 수업 시작 (이벤트 2)
 *   PAUSED   : 일시정지 (이벤트 3)
 *   ENDED    : 수업 종료 (이벤트 4)
 *   CLOSED   : 룸 폐쇄 (이벤트 5/10 또는 admin 강제)
 */
export const BODA_ROOM_STATUSES = [
  'PENDING',
  'OPEN',
  'STARTED',
  'PAUSED',
  'ENDED',
  'CLOSED',
] as const;
export type BodaRoomStatus = (typeof BODA_ROOM_STATUSES)[number];

/**
 * BODA 이벤트 코드 — REQ §5.4 (FR-EVENT-4..8).
 * P0 — 1·2·3·4·5·10·11·12 처리. P1 — 9·13·21·22·23·24·25·26·27·28 (log only).
 */
export const BODA_EVENT_CODES = {
  ROOM_OPENED: 1,
  ROOM_STARTED: 2,
  ROOM_PAUSED: 3,
  ROOM_ENDED: 4,
  ROOM_CLOSED: 5,
  ROOM_INFO_CHANGED: 9, // P1
  ROOM_ALL_CLOSED: 10,
  USER_JOINED: 11,
  USER_LEFT: 12,
  USER_SCORE: 13, // P1
} as const;
export type BodaEventCode = (typeof BODA_EVENT_CODES)[keyof typeof BODA_EVENT_CODES];

/**
 * SERVER API GET /svr/meet/info?meetKey= 응답 일부.
 * vendor docs (SPEC_823 v823.002) 의 부분 집합 — 본 서비스가 실제로 쓰는
 * 필드만 매핑. 나머지는 raw payload 로 별도 보관해도 무방.
 */
export interface BodaMeetInfo {
  meetKey: string;
  meetIdx?: string | null;
  status: BodaRoomStatus;
  openedAt?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  closedAt?: string | null;
  /** 현재 입장 중인 사용자 수. SERVER API 가 제공하면 채워짐. */
  currentUserCount?: number | null;
}

/**
 * SERVER API GET /svr/meet/log/user/join?meetKey= 응답.
 * reconcile 시 권위 데이터 — Webhook 누락 보정에 사용 (FR-ATT-2).
 */
export interface BodaJoinLogEntry {
  meetKey: string;
  /** BODA 측 userId — `UId` (= 앱 사용자 uuid 32 hex). */
  userId: string;
  joinedAt: string;
  leftAt?: string | null;
  totalSeconds?: number | null;
  clientType?: string | null;
}

/**
 * SERVER API POST /svr/meet/close 요청.
 * 어드민 강제 폐쇄용 (FR-ADMIN-1).
 */
export interface BodaCloseRequest {
  meetKey: string;
  /** 폐쇄 사유 (audit). vendor 가 받지 않으면 무시. */
  reason?: string;
}
