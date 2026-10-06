/**
 * REQ-261006 — AMA Open API `POST /open/notifications` 클라이언트 인터페이스.
 *
 * 인증: OAuth client_credentials (AMA PartnerApp 자격, scope `notifications:write`,
 * entity_id = AMA 법인 id). 토큰은 법인별로 캐시한다.
 */
export const AMA_OPEN_NOTIFICATION_CLIENT = Symbol(
  'AMA_OPEN_NOTIFICATION_CLIENT',
);

export const AMA_NOTIFICATIONS_SCOPE = 'notifications:write';

export interface AmaOpenNotificationRequest {
  /** AMA 법인 id (amb_acm_ama_config.amc_ama_entity_id) */
  entityId: string;
  appCode: string;
  /** 멱등 키 — 같은 키는 AMA 가 409 로 거절(이미 전달됨으로 취급) */
  dedupeKey: string;
  title: string;
  body: string;
  /** 클릭 시 열 ACM URL (SSO 재진입: /login?returnTo=…) */
  link: string;
  /** AMA 사용자 id 목록 */
  recipientUserIds: string[];
  priority?: 'normal' | 'high';
}

export interface AmaOpenNotificationResult {
  created: number;
  skipped: number;
  /** 409(dedupe) 로 이미 전달돼 있던 경우 true */
  duplicate?: boolean;
}

export interface IAmaOpenNotificationClient {
  send(req: AmaOpenNotificationRequest): Promise<AmaOpenNotificationResult>;
}

/** 4xx 거절 — 재시도해도 소용없는 오류 (설정/권한/검증). */
export class AmaOpenNotificationRejectedException extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: string,
  ) {
    super(`AMA open notification rejected (${status}): ${detail}`);
    this.name = 'AmaOpenNotificationRejectedException';
  }
}

/** 5xx / 네트워크 / 타임아웃 — 재시도 대상. */
export class AmaOpenNotificationUnavailableException extends Error {
  constructor(
    public readonly reason: string,
    public readonly cause?: unknown,
  ) {
    super(`AMA open notification unavailable: ${reason}`);
    this.name = 'AmaOpenNotificationUnavailableException';
  }
}
