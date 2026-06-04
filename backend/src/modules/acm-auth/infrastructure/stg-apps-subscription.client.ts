/**
 * stg-apps.amoeba.site — AMA App Store subscription service.
 *
 * Source of truth for whether a given AMA entity has an active app-academy
 * subscription. ACM calls this on every AMA-sourced login (REQ-260604 v2
 * FR-1, A1) before issuing an ACM JWT. On 5xx/timeout the caller (see
 * SubscriptionCheckService) falls back to the local
 * tac_academies.acd_subscription_status copy (kept current by the AMA
 * subscription webhook).
 *
 * Implementations:
 *   • StgAppsSubscriptionMockClient — fixture-driven, default for dev/test
 *   • StgAppsSubscriptionHttpClient — real Bearer-auth HTTP client
 *
 * Selection driven by env `AMA_SERVICES_MODE` (mock|http) — see acm-auth.module.
 */

export const SUBSCRIPTION_STATUSES = [
  'ACTIVE',
  'TRIALING',
  'SUSPENDED',
  'CANCELED',
  'DEPROVISIONED',
  'NOT_SUBSCRIBED',
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export interface SubscriptionInfo {
  status: SubscriptionStatus;
  /** Subscription plan key (e.g. "trinity-pro"). null when NOT_SUBSCRIBED. */
  plan?: string | null;
  /** ISO-8601. Present for TRIALING and most ACTIVE plans. */
  expiresAt?: string | null;
}

/**
 * Thrown by HTTP client implementations on 5xx, network error, or timeout.
 * The mock client never throws this. Callers should catch and decide whether
 * to fall back (e.g. SubscriptionCheckService.cacheFallback).
 */
export class StgAppsUnavailableException extends Error {
  constructor(
    public readonly reason: string,
    public readonly cause?: unknown,
  ) {
    super(`stg-apps unavailable: ${reason}`);
    this.name = 'StgAppsUnavailableException';
  }
}

export interface IStgAppsSubscriptionClient {
  /**
   * @param entityId AMA entity (=tenant) id.
   * @param appCode  "tpi-acm" or whatever appCode is whitelisted in
   *                 AMA_JWT_ALLOWED_APP_CODES.
   * @returns
   *   • `SubscriptionInfo` on 200, including NOT_SUBSCRIBED as a status
   *     when stg-apps returns it explicitly
   *   • `null` when stg-apps returns 404 (treat as NOT_SUBSCRIBED)
   * @throws StgAppsUnavailableException on 5xx / network / timeout. Callers
   *         must decide whether to fall back to local cache or fail-closed.
   */
  checkSubscription(
    entityId: string,
    appCode: string,
  ): Promise<SubscriptionInfo | null>;
}

export const STG_APPS_SUBSCRIPTION_CLIENT = Symbol(
  'STG_APPS_SUBSCRIPTION_CLIENT',
);
