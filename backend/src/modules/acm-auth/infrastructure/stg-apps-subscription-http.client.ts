import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IStgAppsSubscriptionClient,
  StgAppsUnavailableException,
  SubscriptionInfo,
  SUBSCRIPTION_STATUSES,
  SubscriptionStatus,
} from './stg-apps-subscription.client';

/**
 * Real stg-apps subscription HTTP client.
 *
 * Activated by env `AMA_SERVICES_MODE=http`. Requires `AMA_APPSTORE_BASE_URL`
 * and `AMA_APPSTORE_SERVICE_TOKEN` to be set. Both are issued by the AMA team
 * — see [REQ-260604 § 6.1](../../../../docs/analysis/REQ-260604-ama-tenant-auth-and-user-directory.md#61-인증-방식)
 * for the auth flow.
 *
 * Contract (REQ-260604 v2 A1):
 *   GET {baseUrl}/api/v1/subscriptions?entityId=…&appCode=tpi-acm
 *   Authorization: Bearer {AMA_APPSTORE_SERVICE_TOKEN}
 *   →  200 { status, plan?, expiresAt? }
 *   →  404 (treated as NOT_SUBSCRIBED)
 *   →  5xx / timeout → StgAppsUnavailableException (caller falls back)
 */
@Injectable()
export class StgAppsSubscriptionHttpClient
  implements IStgAppsSubscriptionClient
{
  private readonly logger = new Logger(StgAppsSubscriptionHttpClient.name);
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    this.baseUrl = (config.get<string>('AMA_APPSTORE_BASE_URL') ?? '').replace(
      /\/$/,
      '',
    );
    this.token = config.get<string>('AMA_APPSTORE_SERVICE_TOKEN') ?? '';
    this.timeoutMs = Number(config.get('AMA_APPSTORE_TIMEOUT_MS', 3000));
  }

  async checkSubscription(
    entityId: string,
    appCode: string,
  ): Promise<SubscriptionInfo | null> {
    if (!this.baseUrl) {
      throw new StgAppsUnavailableException('AMA_APPSTORE_BASE_URL not set');
    }
    if (!this.token) {
      throw new StgAppsUnavailableException(
        'AMA_APPSTORE_SERVICE_TOKEN not set',
      );
    }

    const qs = new URLSearchParams({ entityId, appCode });
    const url = `${this.baseUrl}/api/v1/subscriptions?${qs.toString()}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
    } catch (e) {
      const reason =
        e instanceof Error && e.name === 'AbortError'
          ? `timeout after ${this.timeoutMs}ms`
          : `network error: ${e instanceof Error ? e.message : String(e)}`;
      this.logger.warn(
        `stg-apps GET ${url.split('?')[0]} failed — ${reason}`,
      );
      throw new StgAppsUnavailableException(reason, e);
    } finally {
      clearTimeout(timeoutId);
    }

    if (res.status === 404) {
      this.logger.debug(`stg-apps 404 — entityId=${entityId} (NOT_SUBSCRIBED)`);
      return null;
    }
    if (res.status >= 500) {
      throw new StgAppsUnavailableException(`5xx status=${res.status}`);
    }
    if (!res.ok) {
      // 4xx other than 404 — config/auth bug; not a transient issue.
      // Don't fall back to cache (that would hide real problems).
      const body = await res.text().catch(() => '');
      throw new StgAppsUnavailableException(
        `client error status=${res.status} body=${body.slice(0, 200)}`,
      );
    }

    const body = (await res.json()) as Partial<SubscriptionInfo>;
    if (!body?.status || !this.isStatus(body.status)) {
      this.logger.warn(
        `stg-apps returned 200 with unrecognised status="${body?.status}" — treating as NOT_SUBSCRIBED`,
      );
      return null;
    }
    return {
      status: body.status,
      plan: body.plan ?? null,
      expiresAt: body.expiresAt ?? null,
    };
  }

  private isStatus(s: unknown): s is SubscriptionStatus {
    return (
      typeof s === 'string' &&
      (SUBSCRIPTION_STATUSES as readonly string[]).includes(s)
    );
  }
}
