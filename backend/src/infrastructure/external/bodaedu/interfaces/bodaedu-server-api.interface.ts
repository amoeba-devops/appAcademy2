import type {
  BodaCloseRequest,
  BodaJoinLogEntry,
  BodaMeetInfo,
} from '../bodaedu.types';

/**
 * Per-tenant SERVER API 인증 정보. 호출자(acm-cal 서비스)가 DB 설정
 * (`amb_acm_cal_boda_config`) 에서 svrUrl + Base64(companyCode:authKey) 를
 * 조립해 각 호출에 전달한다. 미전달(undefined) 이면 구현체는 env
 * (`BODA_SERVER_URL` / `BODA_BASIC_AUTH`) fallback 을 사용한다.
 */
export interface BodaServerAuth {
  /** SERVER API base URL — 테넌트 cfg.svrUrl. */
  baseUrl: string;
  /** Base64(companyCode:authKey) — Authorization: Basic 헤더 값. */
  basicAuth: string;
}

/**
 * BODA SERVER API 포트 — 백엔드 전용.
 *
 * 3 호출 (REQ-260526 v2 §5.5 / §5.6):
 *   1. getMeetInfo(meetKey)   — 룸 상태 동기화 (어드민 새로고침 / reconcile 트리거 전 사전 조회)
 *   2. closeMeet(req)         — 어드민 강제 폐쇄
 *   3. getJoinLog(meetKey)    — 출결 reconcile 권위 데이터
 *
 * 모든 구현체는 5s timeout / 1 retry + 지수 백오프 (NFR-5).
 *
 * Implementations:
 *   - BodaeduServerMockClient — fixture, BODA_MODE=mock (default)
 *   - BodaeduServerHttpClient — Basic auth (테넌트 DB 설정 우선, env fallback)
 *
 * `auth` 는 테넌트별 DB 설정에서 조립한 SERVER API 인증. 생략 시 구현체가
 * env fallback 을 사용한다 (mock 은 무시).
 */
export interface IBodaeduServerClient {
  /** 404 → null. 5xx/timeout → BodaeduUnavailableException. */
  getMeetInfo(meetKey: string, auth?: BodaServerAuth): Promise<BodaMeetInfo | null>;

  /**
   * 강제 폐쇄. BODA 가 idempotent 보장하지 않으면 호출 측이 룸 상태로 가드.
   * 5xx/timeout → BodaeduUnavailableException.
   */
  closeMeet(req: BodaCloseRequest, auth?: BodaServerAuth): Promise<void>;

  /** 비어있는 결과는 빈 배열. 5xx/timeout → BodaeduUnavailableException. */
  getJoinLog(meetKey: string, auth?: BodaServerAuth): Promise<BodaJoinLogEntry[]>;
}

export const BODAEDU_SERVER_CLIENT = Symbol('BODAEDU_SERVER_CLIENT');

/**
 * SERVER API 5xx / 네트워크 / timeout 시 throw. 호출자 (BodaRoomService /
 * BodaReconcileService) 가 핸들링 — admin 동작은 403 변환, reconcile cron 은
 * 다음 주기 재시도로 처리.
 */
export class BodaeduUnavailableException extends Error {
  constructor(
    public readonly reason: string,
    public readonly cause?: unknown,
  ) {
    super(`bodaedu server unavailable: ${reason}`);
    this.name = 'BodaeduUnavailableException';
  }
}
