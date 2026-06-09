import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AMA_SESSION_SCOPE,
  AmaIntrospectResult,
  AmaOAuthRejectCode,
  AmaOAuthRejectedException,
  AmaOAuthTokenResult,
  AmaOAuthUnavailableException,
  IAmaOAuthClient,
} from './ama-oauth.client';

const KNOWN_REJECT_CODES: AmaOAuthRejectCode[] = [
  'invalid_ama_token',
  'invalid_scope',
  'user_inactive',
  'invalid_client',
];

/**
 * Real AMA OAuth gateway client (REQ-260609C / MANUAL-260609 §3.2–3.3).
 * Envelope: success `{ success:true, data:{...} }`, error `{ success:false, error:{ message } }`.
 */
@Injectable()
export class AmaOAuthHttpClient implements IAmaOAuthClient {
  private readonly logger = new Logger(AmaOAuthHttpClient.name);
  private readonly gatewayUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    this.gatewayUrl = (config.get<string>('AMA_GATEWAY_URL') ?? '').replace(
      /\/+$/,
      '',
    );
    this.clientId = config.get<string>('AMA_CLIENT_ID') ?? '';
    this.clientSecret = config.get<string>('AMA_CLIENT_SECRET') ?? '';
    this.timeoutMs = Number(config.get('AMA_OAUTH_TIMEOUT_MS', 5000));
    if (!this.gatewayUrl || !this.clientId || !this.clientSecret) {
      this.logger.warn(
        'AMA OAuth client is missing AMA_GATEWAY_URL / AMA_CLIENT_ID / AMA_CLIENT_SECRET — ' +
          'ama_session login will fail until configured.',
      );
    }
  }

  async exchangeSession(amaToken: string): Promise<AmaOAuthTokenResult> {
    const body = new URLSearchParams({
      grant_type: 'ama_session',
      ama_token: amaToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      scope: AMA_SESSION_SCOPE,
    });
    const json = await this.post('/oauth/token', {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const d = (json?.data ?? {}) as Record<string, unknown>;
    const accessToken = typeof d.access_token === 'string' ? d.access_token : '';
    if (!accessToken) {
      throw new AmaOAuthRejectedException(
        'unknown',
        'token response missing access_token',
      );
    }
    return {
      accessToken,
      scope: typeof d.scope === 'string' ? d.scope : '',
      expiresIn: typeof d.expires_in === 'number' ? d.expires_in : 0,
    };
  }

  async introspect(accessToken: string): Promise<AmaIntrospectResult> {
    const basic = Buffer.from(
      `${this.clientId}:${this.clientSecret}`,
    ).toString('base64');
    const json = await this.post('/oauth/introspect', {
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ token: accessToken }),
    });
    const d = (json?.data ?? {}) as Record<string, unknown>;
    return {
      active: !!d.active,
      sub: typeof d.sub === 'string' ? d.sub : undefined,
      entId: typeof d.ent_id === 'string' ? d.ent_id : undefined,
      scope: typeof d.scope === 'string' ? d.scope : undefined,
      clientId: typeof d.client_id === 'string' ? d.client_id : undefined,
      exp: typeof d.exp === 'number' ? d.exp : undefined,
      iat: typeof d.iat === 'number' ? d.iat : undefined,
    };
  }

  /**
   * POST helper. Resolves the `{success,data}` envelope; throws
   * AmaOAuthRejectedException on explicit 4xx error code and
   * AmaOAuthUnavailableException on 5xx / network / timeout.
   */
  private async post(
    path: string,
    init: { headers: Record<string, string>; body: URLSearchParams },
  ): Promise<{ data?: unknown }> {
    if (!this.gatewayUrl) {
      throw new AmaOAuthUnavailableException('AMA_GATEWAY_URL not set');
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await fetch(`${this.gatewayUrl}${path}`, {
        method: 'POST',
        headers: init.headers,
        body: init.body,
        signal: ctrl.signal,
      });
    } catch (e) {
      const reason =
        e instanceof Error && e.name === 'AbortError' ? 'timeout' : 'network';
      throw new AmaOAuthUnavailableException(reason, e);
    } finally {
      clearTimeout(timer);
    }

    if (res.status >= 500) {
      throw new AmaOAuthUnavailableException(`HTTP ${res.status}`);
    }

    let json: {
      success?: boolean;
      data?: unknown;
      error?: { message?: string };
    };
    try {
      json = (await res.json()) as typeof json;
    } catch (e) {
      throw new AmaOAuthUnavailableException('invalid JSON response', e);
    }

    if (!res.ok || json?.success === false) {
      const msg = json?.error?.message ?? `HTTP ${res.status}`;
      const code = KNOWN_REJECT_CODES.find((c) => msg.includes(c)) ?? 'unknown';
      this.logger.warn(`AMA OAuth ${path} rejected code=${code} msg=${msg}`);
      throw new AmaOAuthRejectedException(code, msg);
    }
    return json;
  }
}
