import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AMA_NOTIFICATIONS_SCOPE,
  AmaOpenNotificationRejectedException,
  AmaOpenNotificationUnavailableException,
  type AmaOpenNotificationRequest,
  type AmaOpenNotificationResult,
  type IAmaOpenNotificationClient,
} from './ama-open-notification.client';

/** AMA 게이트웨이 경로 (/ama/v1/* → /api/v1/open/*) */
export const DEFAULT_OPEN_NOTIFICATIONS_PATH = '/ama/v1/notifications';

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

/**
 * REQ-261006 — 실제 AMA Open API 호출.
 *
 *   ① POST {AMA_GATEWAY_URL}/oauth/token
 *        grant_type=client_credentials, client_id, client_secret, entity_id, scope=notifications:write
 *   ② POST {AMA_GATEWAY_URL}{AMA_OPEN_NOTIFICATIONS_PATH}   (기본 /ama/v1/notifications)
 *      — AMA 게이트웨이(api.amoeba.site)는 /ama/v1/* 를 /api/v1/open/* 로 rewrite 한다.
 *        /open/notifications 는 게이트웨이에서 404 (FIX-261007).
 *   appCode 는 AMA_OPEN_NOTIFICATIONS_APP_CODE 가 있으면 그 값(PartnerApp pap_code)으로 보낸다.
 *      — AMA 는 appCode 를 토큰 앱의 pap_code(또는 연결된 활성 Custom App)로만 허용한다.
 *        Authorization: Bearer <access_token>, JSON body
 *
 * 토큰은 법인별 메모리 캐시(만료 60초 전 갱신). 401 이면 한 번 재발급 후 재시도.
 * AMA 측 엔드포인트 계약: docs/design/SPEC-261006-ama-open-notifications-api.md
 */
@Injectable()
export class AmaOpenNotificationHttpClient implements IAmaOpenNotificationClient {
  private readonly logger = new Logger(AmaOpenNotificationHttpClient.name);
  private readonly gatewayUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly path: string;
  private readonly appCodeOverride: string;
  private readonly timeoutMs: number;
  private readonly tokens = new Map<string, CachedToken>();

  constructor(config: ConfigService) {
    this.gatewayUrl = (config.get<string>('AMA_GATEWAY_URL') ?? '').replace(
      /\/$/,
      '',
    );
    this.clientId = config.get<string>('AMA_CLIENT_ID') ?? '';
    this.clientSecret = config.get<string>('AMA_CLIENT_SECRET') ?? '';
    // compose 는 `${VAR:-}` 로 넘겨 미설정 시 빈 문자열이 온다 → `??` 대신 trim||
    this.path =
      config.get<string>('AMA_OPEN_NOTIFICATIONS_PATH')?.trim() ||
      DEFAULT_OPEN_NOTIFICATIONS_PATH;
    this.appCodeOverride =
      config.get<string>('AMA_OPEN_NOTIFICATIONS_APP_CODE')?.trim() || '';
    this.timeoutMs = Number(config.get('AMA_OAUTH_TIMEOUT_MS', 5000));
    if (!this.gatewayUrl || !this.clientId || !this.clientSecret) {
      this.logger.warn(
        'AMA open notification client missing AMA_GATEWAY_URL / AMA_CLIENT_ID / AMA_CLIENT_SECRET — forwarding will fail until configured',
      );
    }
  }

  async send(
    req: AmaOpenNotificationRequest,
  ): Promise<AmaOpenNotificationResult> {
    let token = await this.token(req.entityId);
    let res = await this.post(token, req);
    if (res.status === 401) {
      this.tokens.delete(req.entityId);
      token = await this.token(req.entityId);
      res = await this.post(token, req);
    }
    if (res.status === 409) {
      return {
        created: 0,
        skipped: req.recipientUserIds.length,
        duplicate: true,
      };
    }
    if (res.status >= 500) {
      throw new AmaOpenNotificationUnavailableException(`HTTP ${res.status}`);
    }
    const json = res.json as {
      success?: boolean;
      data?: { created?: number; skipped?: number };
      error?: { message?: string; code?: string };
    } | null;
    if (!res.ok || json?.success === false) {
      const detail =
        json?.error?.message ?? json?.error?.code ?? `HTTP ${res.status}`;
      throw new AmaOpenNotificationRejectedException(res.status, detail);
    }
    return {
      created: Number(json?.data?.created ?? req.recipientUserIds.length),
      skipped: Number(json?.data?.skipped ?? 0),
    };
  }

  // ── token ────────────────────────────────────────────────────────────

  private async token(entityId: string): Promise<string> {
    const cached = this.tokens.get(entityId);
    if (cached && cached.expiresAt > Date.now() + 60_000)
      return cached.accessToken;
    if (!this.gatewayUrl || !this.clientId || !this.clientSecret) {
      throw new AmaOpenNotificationRejectedException(
        0,
        'AMA OAuth client not configured',
      );
    }
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      entity_id: entityId,
      scope: AMA_NOTIFICATIONS_SCOPE,
    });
    const res = await this.fetch(`${this.gatewayUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (res.status >= 500) {
      throw new AmaOpenNotificationUnavailableException(
        `token HTTP ${res.status}`,
      );
    }
    const json = res.json as {
      success?: boolean;
      data?: { access_token?: string; expires_in?: number };
      error?: { message?: string };
    } | null;
    const accessToken = json?.data?.access_token;
    if (!res.ok || json?.success === false || typeof accessToken !== 'string') {
      throw new AmaOpenNotificationRejectedException(
        res.status,
        json?.error?.message ?? 'token response missing access_token',
      );
    }
    const expiresIn = Number(json?.data?.expires_in ?? 3600);
    this.tokens.set(entityId, {
      accessToken,
      expiresAt: Date.now() + expiresIn * 1000,
    });
    return accessToken;
  }

  private async post(
    token: string,
    req: AmaOpenNotificationRequest,
  ): Promise<{ status: number; ok: boolean; json: unknown }> {
    return this.fetch(`${this.gatewayUrl}${this.path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        entityId: req.entityId,
        appCode: this.appCodeOverride || req.appCode,
        dedupeKey: req.dedupeKey,
        type: 'EXTERNAL_APP',
        title: req.title,
        body: req.body,
        link: req.link,
        recipientUserIds: req.recipientUserIds,
        priority: req.priority ?? 'normal',
      }),
    });
  }

  private async fetch(
    url: string,
    init: { method: string; headers: Record<string, string>; body: BodyInit },
  ): Promise<{ status: number; ok: boolean; json: unknown }> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await fetch(url, { ...init, signal: ctrl.signal });
    } catch (e) {
      const reason =
        e instanceof Error && e.name === 'AbortError' ? 'timeout' : 'network';
      throw new AmaOpenNotificationUnavailableException(reason, e);
    } finally {
      clearTimeout(timer);
    }
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    return { status: res.status, ok: res.ok, json };
  }
}
