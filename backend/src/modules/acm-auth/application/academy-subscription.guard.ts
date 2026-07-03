import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { AcmTenantTypeormEntity } from '../../acm-system/infrastructure/typeorm/acm-tenant.typeorm-entity';

const ACCEPTED_STATUSES = ['ACTIVE', 'TRIALING'] as const;
type AcceptedStatus = (typeof ACCEPTED_STATUSES)[number];

/**
 * @deprecated Superseded by `SubscriptionCheckService` (REQ-260604 v2,
 * commit replacing 6dfadc4). The new service does a live stg-apps check
 * with this guard's cache-only logic as a fallback path. File kept for
 * rollback; remove after 1 sprint of clean v2 operation.
 *
 * --- Original v1 docstring below ---
 *
 * Verifies that an AMA tenant has an active app-academy subscription before
 * an AMA-sourced login is allowed to proceed.
 *
 * Source of truth is the PostgreSQL `amb_acm_tenant.tnt_subscription_status`
 * cache. New code should use `SubscriptionCheckService`, which performs live
 * stg-apps checks and falls back to this cache.
 *
 * Per [REQ-260604](../../../../docs/analysis/REQ-260604-ama-tenant-auth-and-user-directory.md)
 * AC-1-2 / AC-1-3, the guard MUST distinguish between:
 *   • NO_ACADEMY            — tenant never provisioned (no row)
 *   • SUBSCRIPTION_<STATUS> — row exists but status not in the accepted set
 * so the frontend can render an actionable error card.
 */
@Injectable()
export class AcademySubscriptionGuard {
  private readonly logger = new Logger(AcademySubscriptionGuard.name);

  constructor(
    @InjectRepository(AcmTenantTypeormEntity, ACM_DS)
    private readonly tenantRepo: Repository<AcmTenantTypeormEntity>,
  ) {}

  async ensureActive(amaEntityId: string): Promise<void> {
    const tenant = await this.tenantRepo.findOne({
      where: { amaEntityId },
    });

    if (!tenant) {
      this.logger.warn(
        `subscription denied entId=${amaEntityId} reason=NO_TENANT`,
      );
      throw new HttpException(
        {
          code: 'NO_TENANT',
          message: 'Tenant not provisioned for app-academy',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    const status = tenant.subscriptionStatus;
    if (!ACCEPTED_STATUSES.includes(status as AcceptedStatus)) {
      this.logger.warn(
        `subscription denied entId=${amaEntityId} tenant=${tenant.entId} reason=SUBSCRIPTION_INACTIVE status=${status}`,
      );
      throw new HttpException(
        {
          code: `SUBSCRIPTION_${status}`,
          message: `Subscription is ${status}`,
          data: {
            entityId: amaEntityId,
            status,
            canceledAt: tenant.canceledAt,
            deprovisionedAt: tenant.deprovisionedAt,
          },
        },
        HttpStatus.FORBIDDEN,
      );
    }
  }
}
