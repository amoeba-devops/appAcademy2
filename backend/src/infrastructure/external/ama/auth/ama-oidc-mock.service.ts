import { Injectable, Logger } from '@nestjs/common';
import {
  AmaOidcAuthorizeUrlInput,
  AmaOidcService,
  AmaOidcTokenResponse,
  AmaOidcUserInfo,
} from './interfaces/ama-oidc.interface';

/**
 * Mock AMA OIDC IdP — `AMA_MODE=mock` 일 때 사용.
 *
 * - authorize URL 은 본 앱의 callback 으로 즉시 redirect 하도록 mock.
 * - exchangeCode 는 고정 토큰을 반환.
 * - fetchUserInfo 는 access token 의 마지막 segment 를 sub 로 해석해
 *   다중 사용자 시나리오를 손쉽게 테스트할 수 있게 한다.
 *
 * Token format: `mock-access-{sub}` / `mock-id-{sub}`
 */
@Injectable()
export class AmaOidcMockService implements AmaOidcService {
  private readonly logger = new Logger(AmaOidcMockService.name);

  buildAuthorizeUrl(input: AmaOidcAuthorizeUrlInput): string {
    // 개발 편의: callback URL 로 즉시 mock-code 와 state 를 redirect
    const url = new URL(input.redirectUri);
    url.searchParams.set('code', `mock-code-${input.state}`);
    url.searchParams.set('state', input.state);
    this.logger.debug(`[mock] authorize → ${url.toString()}`);
    return url.toString();
  }

  exchangeCode(input: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }): Promise<AmaOidcTokenResponse> {
    // mock-code-<state> → state 추출. state 와 sub 는 분리이므로
    // 별도 헤더가 없으면 default sub 사용.
    const sub = process.env.AMA_MOCK_SUB ?? 'ama-user-001';
    this.logger.debug(`[mock] exchangeCode sub=${sub}`);
    return Promise.resolve({
      accessToken: `mock-access-${sub}`,
      idToken: `mock-id-${sub}`,
      expiresIn: 3600,
      tokenType: 'Bearer',
    });
  }

  fetchUserInfo(accessToken: string): Promise<AmaOidcUserInfo> {
    const sub = accessToken.startsWith('mock-access-')
      ? accessToken.slice('mock-access-'.length)
      : 'ama-user-001';
    this.logger.debug(`[mock] userinfo sub=${sub}`);
    return Promise.resolve({
      sub,
      email: `${sub}@mock.amoeba.site`,
      name: `Mock User ${sub}`,
      picture: undefined,
      tenantMemberships: [],
    });
  }
}
