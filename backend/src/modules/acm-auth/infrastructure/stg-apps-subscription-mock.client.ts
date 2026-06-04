import { Injectable, Logger } from '@nestjs/common';
import {
  IStgAppsSubscriptionClient,
  SubscriptionInfo,
  SubscriptionStatus,
} from './stg-apps-subscription.client';

/**
 * Mock stg-apps client. Activated when `AMA_SERVICES_MODE=mock` (default
 * before AMA team issues a real service token).
 *
 * Behavior:
 *   • Default → returns ACTIVE so the happy-path AMA login works in dev
 *     without any wiring.
 *   • Per-entityId override → entityIds containing one of the well-known
 *     fragments below force a specific status. Useful for manual UX
 *     testing of the 5 error cards (SUSPENDED / CANCELED / DEPROVISIONED /
 *     NOT_SUBSCRIBED) and the "unknown tenant" fallthrough.
 *
 *   ent-suspended-…       → SUSPENDED
 *   ent-canceled-…        → CANCELED
 *   ent-deprovisioned-…   → DEPROVISIONED
 *   ent-not-subscribed-…  → null (proxies stg-apps 404)
 *   ent-trial-…           → TRIALING
 *   ent-fail-…            → throws (simulates 5xx — exercises cache fallback)
 *
 * @see REQ-260604 v2 § 6 (A1 contract), PLN-260604 v2 T2-02.
 */
@Injectable()
export class StgAppsSubscriptionMockClient
  implements IStgAppsSubscriptionClient
{
  private readonly logger = new Logger(StgAppsSubscriptionMockClient.name);

  async checkSubscription(
    entityId: string,
    appCode: string,
  ): Promise<SubscriptionInfo | null> {
    const lower = (entityId ?? '').toLowerCase();

    if (lower.includes('ent-fail')) {
      // Throw a generic Error — the http client wraps in
      // StgAppsUnavailableException. The check service catches Error too.
      throw new Error(`MOCK_FAIL: simulated stg-apps 5xx for ${entityId}`);
    }

    const status = this.resolveStatus(lower);
    if (status === null) {
      this.logger.debug(
        `mock 404 (NOT_SUBSCRIBED) entityId=${entityId} appCode=${appCode}`,
      );
      return null;
    }

    this.logger.debug(
      `mock status=${status} entityId=${entityId} appCode=${appCode}`,
    );
    return {
      status,
      plan: status === 'ACTIVE' || status === 'TRIALING' ? 'trinity-pro' : null,
      expiresAt:
        status === 'TRIALING'
          ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          : null,
    };
  }

  private resolveStatus(lowerEntityId: string): SubscriptionStatus | null {
    if (lowerEntityId.includes('ent-suspended')) return 'SUSPENDED';
    if (lowerEntityId.includes('ent-canceled')) return 'CANCELED';
    if (lowerEntityId.includes('ent-deprovisioned')) return 'DEPROVISIONED';
    if (lowerEntityId.includes('ent-not-subscribed')) return null;
    if (lowerEntityId.includes('ent-trial')) return 'TRIALING';
    return 'ACTIVE';
  }
}
