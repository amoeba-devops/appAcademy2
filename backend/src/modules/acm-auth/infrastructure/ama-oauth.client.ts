/**
 * AMA OAuth gateway client — `ama_session` grant exchange + RFC 7662 introspection.
 *
 * REQ-260609C / MANUAL-260609 (Option C). ACM does NOT verify the `ama_token`
 * signature locally. Instead it exchanges the token at the AMA OAuth gateway
 * (which validates signature / expiry / user status on our behalf) for an
 * OAuth access_token, then introspects it for the session context.
 *
 *   ① POST {AMA_GATEWAY_URL}/oauth/token       (grant_type=ama_session)
 *   ② POST {AMA_GATEWAY_URL}/oauth/introspect  (Basic client_id:client_secret)
 *
 * Implementations:
 *   • AmaOAuthMockClient — fixture-driven, default for dev/test
 *   • AmaOAuthHttpClient — real HTTP client
 * Selection driven by env `AMA_SERVICES_MODE` (mock|http) — see acm-auth.module.
 */

/** OAuth scope requested for SSO entry (MANUAL §3.2). */
export const AMA_SESSION_SCOPE = 'app_store:context';

export interface AmaOAuthTokenResult {
  accessToken: string;
  scope: string;
  /** seconds */
  expiresIn: number;
}

/** RFC 7662 introspection context (MANUAL §3.3). */
export interface AmaIntrospectResult {
  active: boolean;
  sub?: string;
  /** AMA 법인 ID (UUID) — gate compares this against /admin/config. */
  entId?: string;
  scope?: string;
  clientId?: string;
  exp?: number;
  iat?: number;
}

/** Gateway error codes that are the caller's/user's fault (not transient). */
export type AmaOAuthRejectCode =
  | 'invalid_ama_token'
  | 'invalid_scope'
  | 'user_inactive'
  | 'invalid_client'
  | 'unknown';

/**
 * Thrown on an explicit gateway rejection (4xx with an OAuth error code).
 * Deterministic — the caller maps the code to a 4xx/5xx HTTP status.
 */
export class AmaOAuthRejectedException extends Error {
  constructor(
    public readonly code: AmaOAuthRejectCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'AmaOAuthRejectedException';
  }
}

/**
 * Thrown on 5xx / network error / timeout. The mock never throws this.
 * Callers fail-closed (503 AMA_UNAVAILABLE), mirroring UserMembershipGuard.
 */
export class AmaOAuthUnavailableException extends Error {
  constructor(
    public readonly reason: string,
    public readonly cause?: unknown,
  ) {
    super(`ama oauth unavailable: ${reason}`);
    this.name = 'AmaOAuthUnavailableException';
  }
}

export interface IAmaOAuthClient {
  /**
   * Exchange a one-time `ama_token` for an OAuth access_token.
   * @throws AmaOAuthRejectedException on explicit gateway rejection.
   * @throws AmaOAuthUnavailableException on 5xx / network / timeout.
   */
  exchangeSession(amaToken: string): Promise<AmaOAuthTokenResult>;

  /**
   * Introspect an access_token for the session context (RFC 7662).
   * @throws AmaOAuthUnavailableException on 5xx / network / timeout.
   *         An inactive token returns `{ active: false }` (not an exception).
   */
  introspect(accessToken: string): Promise<AmaIntrospectResult>;
}

export const AMA_OAUTH_CLIENT = Symbol('AMA_OAUTH_CLIENT');
