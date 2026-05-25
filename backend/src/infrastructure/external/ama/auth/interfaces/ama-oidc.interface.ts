/**
 * AMA OIDC integration interfaces.
 *
 * AMA team 의 정식 명세 확정 전이므로 (docs/integration/ama-platform-spec-asks.md A-2),
 * OAuth 2.0 Authorization Code + PKCE + OIDC discovery 를 가정한다.
 * 실제 응답 형태가 달라질 경우 본 인터페이스만 조정하면 된다.
 */
export const AMA_OIDC_SERVICE = Symbol('AMA_OIDC_SERVICE');

export interface AmaOidcAuthorizeUrlInput {
  /** 본 앱이 생성한 CSRF state */
  state: string;
  /** PKCE — base64url(SHA256(code_verifier)) */
  codeChallenge: string;
  /** AMA 측이 callback 으로 redirect 할 URL */
  redirectUri: string;
  /** OIDC scopes (default: ['openid','profile','email']) */
  scopes?: string[];
}

export interface AmaOidcTokenResponse {
  accessToken: string;
  idToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface AmaOidcUserInfo {
  /** AMA SSO sub claim — usr.usr_ama_user_id 매핑 키 */
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
  /**
   * AMA 측이 멤버십을 통보해 줄 경우의 응답 형태 (A-4 미확정).
   * 미회신 시 빈 배열로 가정 → 본 앱이 자체 멤버십 부여.
   */
  tenantMemberships?: Array<{
    amaTenantId: string;
    role?: string;
  }>;
}

export interface AmaOidcService {
  /** OIDC authorize endpoint URL 생성 (302 redirect 대상) */
  buildAuthorizeUrl(input: AmaOidcAuthorizeUrlInput): string;

  /** Authorization code → access/id 토큰 교환 */
  exchangeCode(input: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }): Promise<AmaOidcTokenResponse>;

  /** Access token 으로 userinfo 조회 */
  fetchUserInfo(accessToken: string): Promise<AmaOidcUserInfo>;
}
