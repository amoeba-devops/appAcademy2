import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AcademyEntity } from '../../infrastructure/database/entities/academy.entity';
import { SubscriptionEventEntity } from '../../infrastructure/database/entities/subscription-event.entity';

export type LifecycleAction =
  | 'SUSPEND'
  | 'RESUME'
  | 'CANCEL'
  | 'DEPROVISION'
  | 'PLAN_CHANGED';

export interface LifecycleInput {
  amaTenantId: string;
  action: LifecycleAction;
  plan?: string | null;
  eventNonce: string;
  eventAt: Date;
  signature: string;
  rawPayload: Record<string, unknown>;
}

const ACTION_TO_EVENT: Record<LifecycleAction, string> = {
  SUSPEND: 'SUBSCRIPTION_SUSPENDED',
  RESUME: 'SUBSCRIPTION_RESUMED',
  CANCEL: 'SUBSCRIPTION_CANCELED',
  DEPROVISION: 'SUBSCRIPTION_DEPROVISIONED',
  PLAN_CHANGED: 'SUBSCRIPTION_PLAN_CHANGED',
};

const ACTION_TO_STATUS: Record<LifecycleAction, string | null> = {
  SUSPEND: 'SUSPENDED',
  RESUME: 'ACTIVE',
  CANCEL: 'CANCELED',
  DEPROVISION: 'DEPROVISIONED',
  PLAN_CHANGED: null,
};

@Injectable()
export class LifecycleUseCase {
  private readonly logger = new Logger(LifecycleUseCase.name);

  constructor(
    @InjectRepository(AcademyEntity)
    private readonly academyRepo: Repository<AcademyEntity>,
    @InjectRepository(SubscriptionEventEntity)
    private readonly eventRepo: Repository<SubscriptionEventEntity>,
  ) {}

  async apply(input: LifecycleInput): Promise<{ acdId: number }> {
    const academy = await this.academyRepo.findOne({
      where: { acdAmaTenantId: input.amaTenantId },
    });
    if (!academy) {
      throw new NotFoundException(`Tenant not provisioned: ${input.amaTenantId}`);
    }

    const status = ACTION_TO_STATUS[input.action];
    const patch: Partial<AcademyEntity> = {};
    if (status) patch.acdSubscriptionStatus = status;
    if (input.action === 'CANCEL') patch.acdCanceledAt = input.eventAt;
    if (input.action === 'DEPROVISION') patch.acdDeprovisionedAt = input.eventAt;
    if (input.action === 'RESUME') {
      patch.acdCanceledAt = null;
      patch.acdDeprovisionedAt = null;
    }
    if (input.action === 'PLAN_CHANGED' && input.plan != null) {
      patch.acdSubscriptionPlan = input.plan;
    }
    if (Object.keys(patch).length > 0) {
      await this.academyRepo.update(academy.acdId, patch);
    }

    const evt = this.eventRepo.create({
      acdId: academy.acdId,
      subAmaTenantId: input.amaTenantId,
      subEventType: ACTION_TO_EVENT[input.action],
      subPlan: input.plan ?? null,
      subNonce: input.eventNonce,
      subSignature: input.signature,
      subEventAt: input.eventAt,
      subPayload: input.rawPayload,
      subProcessedAt: new Date(),
      subProcessingError: null,
    } as Partial<SubscriptionEventEntity>);
    await this.eventRepo.save(evt);

    this.logger.log(
      `Lifecycle action=${input.action} acdId=${academy.acdId} ama=${input.amaTenantId}`,
    );
    return { acdId: academy.acdId };
  }
}
