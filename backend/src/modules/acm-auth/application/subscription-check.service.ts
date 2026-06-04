import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AcademyEntity } from '../../../infrastructure/database/entities/academy.entity';
import {
  STG_APPS_SUBSCRIPTION_CLIENT,
  type IStgAppsSubscriptionClient,
  type SubscriptionInfo,
} from '../infrastructure/stg-apps-subscription.client';

const ACCEPTED_STATUSES = ['ACTIVE', 'TRIALING'] as const;
const CACHE_FALLBACK_TTL_MS = 24 * 60 * 60 * 1000; // 24h — PLN v2 § 8 Q4

export interface SubscriptionCheckResult {
  /** True when stg-apps live failed and we fell back to local cache. */
  degraded: boolean;
  /** stg-apps verdict, or the cached row when degraded=true. */
  status: string;
}

/**
 * REQ-260604 v2 FR-1 + FR-9 — gate for AMA-sourced login.
 *
 * Order of operations on each call:
 *   1. Live  → stg-apps `GET /api/v1/subscriptions?entityId=…&appCode=tpi-acm`
 *      • 200 ACTIVE / TRIALING                     → pass, refresh cache, return
 *      • 200 SUSPENDED / CANCELED / DEPROVISIONED  → 403 SUBSCRIPTION_<status>
 *      • 200 NOT_SUBSCRIBED  or  404               → 403 NO_SUBSCRIPTION
 *   2. live 5xx / network / timeout → cache fallback
 *      • no tac_academies row                       → 403 NO_ACADEMY
 *      • cache age ≤ 24h  and  cached status ACTIVE/TRIALING → pass (degraded)
 *      • cache age > 24h  or  cached status not active       → 503 AMA_UNAVAILABLE
 *
 * The 24h ceiling exists so a hard stg-apps outage can't paper over a real
 * lapsed subscription forever — the AMA subscription webhook normally keeps
 * `acd_subscription_status` fresh within seconds, so anything older than 24h
 * almost certainly means webhooks are broken too.
 *
 * Absorbs the v1 [AcademySubscriptionGuard](./academy-subscription.guard.ts)
 * (commit `6dfadc4`) — that file is now deprecated; see PLN-260604 v2 § 7.
 */
@Injectable()
export class SubscriptionCheckService {
  private readonly logger = new Logger(SubscriptionCheckService.name);

  constructor(
    @InjectRepository(AcademyEntity)
    private readonly academyRepo: Repository<AcademyEntity>,
    @Inject(STG_APPS_SUBSCRIPTION_CLIENT)
    private readonly client: IStgAppsSubscriptionClient,
  ) {}

  async ensureActive(
    amaEntityId: string,
  ): Promise<SubscriptionCheckResult> {
    let info: SubscriptionInfo | null;
    try {
      info = await this.client.checkSubscription(amaEntityId, 'tpi-acm');
    } catch (e) {
      this.logger.warn(
        `stg-apps live failed entId=${amaEntityId} reason=${e instanceof Error ? e.message : String(e)} — trying cache`,
      );
      return await this.cacheFallback(amaEntityId);
    }

    if (info === null || info.status === 'NOT_SUBSCRIBED') {
      throw this.deny('NO_SUBSCRIPTION', amaEntityId);
    }
    if (!(ACCEPTED_STATUSES as readonly string[]).includes(info.status)) {
      throw this.deny(
        `SUBSCRIPTION_${info.status}`,
        amaEntityId,
        info.status,
      );
    }

    await this.refreshCache(amaEntityId, info);
    return { degraded: false, status: info.status };
  }

  private async cacheFallback(
    amaEntityId: string,
  ): Promise<SubscriptionCheckResult> {
    const academy = await this.academyRepo.findOne({
      where: { acdAmaTenantId: amaEntityId },
    });
    if (!academy) {
      throw this.deny('NO_ACADEMY', amaEntityId);
    }
    const cachedAt = academy.acdUpdatedAt
      ? new Date(academy.acdUpdatedAt).getTime()
      : 0;
    const age = Date.now() - cachedAt;
    if (age > CACHE_FALLBACK_TTL_MS) {
      this.logger.error(
        `live failed + cache stale (age=${Math.round(age / 3_600_000)}h) entId=${amaEntityId}`,
      );
      throw new HttpException(
        {
          code: 'AMA_UNAVAILABLE',
          message: 'AMA subscription service unavailable and cache is stale',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    const status = academy.acdSubscriptionStatus;
    if (!(ACCEPTED_STATUSES as readonly string[]).includes(status)) {
      throw this.deny(`SUBSCRIPTION_${status}`, amaEntityId, status);
    }
    this.logger.warn(
      `degraded mode (live 5xx + cache hit, age=${Math.round(age / 60_000)}m) entId=${amaEntityId} status=${status}`,
    );
    return { degraded: true, status };
  }

  private async refreshCache(
    amaEntityId: string,
    info: SubscriptionInfo,
  ): Promise<void> {
    try {
      await this.academyRepo.update(
        { acdAmaTenantId: amaEntityId },
        {
          acdSubscriptionStatus: info.status,
          acdSubscriptionPlan: info.plan ?? null,
        },
      );
    } catch (e) {
      // Don't fail login if cache refresh fails — webhook will catch up.
      this.logger.warn(
        `cache refresh failed entId=${amaEntityId} reason=${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  private deny(
    code: string,
    entityId: string,
    status?: string,
  ): HttpException {
    this.logger.warn(`subscription denied entId=${entityId} code=${code}`);
    return new HttpException(
      {
        code,
        message: code,
        data: { entityId, ...(status ? { status } : {}) },
      },
      HttpStatus.FORBIDDEN,
    );
  }
}
