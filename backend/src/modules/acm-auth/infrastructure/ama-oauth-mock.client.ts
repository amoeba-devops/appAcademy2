import { Injectable, Logger } from '@nestjs/common';
import {
  AMA_SESSION_SCOPE,
  AmaIntrospectResult,
  AmaOAuthRejectedException,
  AmaOAuthTokenResult,
  AmaOAuthUnavailableException,
  IAmaOAuthClient,
} from './ama-oauth.client';

/**
 * Fixture-driven AMA OAuth client for dev/test (REQ-260609C).
 *
 * Mirrors the stg-apps mock convention — the incoming ama_token text drives
 * the simulated outcome:
 *   • contains 'oauthfail'    → AmaOAuthUnavailableException (5xx/network)
 *   • contains 'oauthinvalid' → AmaOAuthRejectedException('invalid_ama_token')
 *   • contains 'oauthinactive'→ introspect returns { active:false }
 *   • otherwise               → success; sub/entId are decoded best-effort from
 *     the JWT payload so local/integration tokens flow through unchanged.
 */
@Injectable()
export class AmaOAuthMockClient implements IAmaOAuthClient {
  private readonly logger = new Logger(AmaOAuthMockClient.name);

  async exchangeSession(amaToken: string): Promise<AmaOAuthTokenResult> {
    if (amaToken.includes('oauthfail')) {
      throw new AmaOAuthUnavailableException('MOCK_FAIL simulated 5xx');
    }
    if (amaToken.includes('oauthinvalid')) {
      throw new AmaOAuthRejectedException('invalid_ama_token', 'mock invalid');
    }
    this.logger.debug('mock ama_session exchange ok');
    return {
      accessToken: `mock-at::${amaToken}`,
      scope: AMA_SESSION_SCOPE,
      expiresIn: 3600,
    };
  }

  async introspect(accessToken: string): Promise<AmaIntrospectResult> {
    const amaToken = accessToken.startsWith('mock-at::')
      ? accessToken.slice('mock-at::'.length)
      : accessToken;
    if (amaToken.includes('oauthinactive')) {
      return { active: false };
    }
    const claims = decodeJwtPayloadBestEffort(amaToken);
    const now = Math.floor(Date.now() / 1000);
    return {
      active: true,
      sub: typeof claims.sub === 'string' ? claims.sub : 'mock-sub',
      entId:
        typeof claims.entityId === 'string'
          ? claims.entityId
          : '00000000-0000-0000-0000-000000000001',
      scope: AMA_SESSION_SCOPE,
      clientId: 'pap_mock',
      iat: now,
      exp: now + 3600,
    };
  }
}

/** Decode a JWT payload without verifying — mock only. Returns {} on failure. */
function decodeJwtPayloadBestEffort(token: string): Record<string, unknown> {
  try {
    const seg = token.split('.')[1];
    if (!seg) return {};
    const json = Buffer.from(seg, 'base64').toString('utf8');
    const parsed = JSON.parse(json) as unknown;
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
