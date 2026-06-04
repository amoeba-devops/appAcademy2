import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AcademyEntity } from '../../../infrastructure/database/entities/academy.entity';

const ACCEPTED_STATUSES = ['ACTIVE', 'TRIALING'] as const;
type AcceptedStatus = (typeof ACCEPTED_STATUSES)[number];

/**
 * Verifies that an AMA tenant has an active app-academy subscription before
 * an AMA-sourced login is allowed to proceed.
 *
 * Source of truth is `tac_academies.acd_subscription_status`, kept current
 * by the AMA subscription webhook ([ama-subscription-webhook.controller.ts]
 * + [lifecycle.use-case.ts]). We rely on that local copy rather than calling
 * AMA live — webhook latency on a healthy network is sub-second and avoids
 * adding an extra hop to every login.
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
    @InjectRepository(AcademyEntity)
    private readonly academyRepo: Repository<AcademyEntity>,
  ) {}

  async ensureActive(amaEntityId: string): Promise<void> {
    const academy = await this.academyRepo.findOne({
      where: { acdAmaTenantId: amaEntityId },
    });

    if (!academy) {
      this.logger.warn(
        `subscription denied entId=${amaEntityId} reason=NO_ACADEMY`,
      );
      throw new HttpException(
        {
          code: 'NO_ACADEMY',
          message: 'Tenant not provisioned for app-academy',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    const status = academy.acdSubscriptionStatus;
    if (!ACCEPTED_STATUSES.includes(status as AcceptedStatus)) {
      this.logger.warn(
        `subscription denied entId=${amaEntityId} acdId=${academy.acdId} reason=SUBSCRIPTION_INACTIVE status=${status}`,
      );
      throw new HttpException(
        {
          code: `SUBSCRIPTION_${status}`,
          message: `Subscription is ${status}`,
          data: {
            entityId: amaEntityId,
            status,
            canceledAt: academy.acdCanceledAt,
            deprovisionedAt: academy.acdDeprovisionedAt,
          },
        },
        HttpStatus.FORBIDDEN,
      );
    }
  }
}
