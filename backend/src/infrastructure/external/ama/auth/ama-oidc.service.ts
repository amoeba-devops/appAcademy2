import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AmaOidcAuthorizeUrlInput,
  AmaOidcService,
  AmaOidcTokenResponse,
  AmaOidcUserInfo,
} from './interfaces/ama-oidc.interface';

/**
 * Real HTTP-based AMA OIDC client.
 *
 * Discovery 는 `AMA_OIDC_ISSUER` + `/.well-known/openid-configuration` 가정.
 * 실제 명세 확정(A-2) 후 endpoint 매핑/응답 키만 조정하면 된다.
 */
@Injectable()
export class AmaOidcHttpService implements AmaOidcService {
  private readonly logger = new Logger(AmaOidcHttpService.name);
  private readonly issuer: string;
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(config: ConfigService) {
    this.issuer = String(config.get('AMA_OIDC_ISSUER', '')).replace(/\/$/, '');
    this.clientId = String(config.get('AMA_OIDC_CLIENT_ID', ''));
    this.clientSecret = String(config.get('AMA_OIDC_CLIENT_SECRET', ''));
    if (!this.issuer || !this.clientId || !this.clientSecret) {
      this.logger.warn(
        'AMA_OIDC_* env not fully configured — http client will fail on use',
      );
    }
  }

  buildAuthorizeUrl(input: AmaOidcAuthorizeUrlInput): string {
    const url = new URL(`${this.issuer}/authorize`);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('redirect_uri', input.redirectUri);
    url.searchParams.set(
      'scope',
      (input.scopes ?? ['openid', 'profile', 'email']).join(' '),
    );
    url.searchParams.set('state', input.state);
    url.searchParams.set('code_challenge', input.codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    return url.toString();
  }

  async exchangeCode(input: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }): Promise<AmaOidcTokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code: input.code,
      code_verifier: input.codeVerifier,
      redirect_uri: input.redirectUri,
    });
    const res = await fetch(`${this.issuer}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) {
      throw new Error(`AMA OIDC token exchange failed: ${res.status}`);
    }
    const data = (await res.json()) as Record<string, unknown>;
    return {
      accessToken: String(data.access_token ?? ''),
      idToken: String(data.id_token ?? ''),
      refreshToken: data.refresh_token ? String(data.refresh_token) : undefined,
      expiresIn: Number(data.expires_in ?? 3600),
      tokenType: 'Bearer',
    };
  }

  async fetchUserInfo(accessToken: string): Promise<AmaOidcUserInfo> {
    const res = await fetch(`${this.issuer}/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`AMA OIDC userinfo failed: ${res.status}`);
    }
    const data = (await res.json()) as Record<string, unknown>;
    return {
      sub: String(data.sub ?? ''),
      email: data.email ? String(data.email) : undefined,
      name: data.name ? String(data.name) : undefined,
      picture: data.picture ? String(data.picture) : undefined,
      tenantMemberships: Array.isArray(data.tenant_memberships)
        ? (data.tenant_memberships as Array<Record<string, unknown>>).map((m) => ({
            amaTenantId: String(m.ama_tenant_id ?? ''),
            role: m.role ? String(m.role) : undefined,
          }))
        : [],
    };
  }
}
