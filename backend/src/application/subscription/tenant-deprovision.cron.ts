import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { AcademyEntity } from '../../infrastructure/database/entities/academy.entity';
import { SubscriptionEventEntity } from '../../infrastructure/database/entities/subscription-event.entity';

/**
 * Daily 03:00 sweep — academies CANCELED for ≥ AMA_DEPROVISION_GRACE_DAYS (default 90)
 * are auto-marked DEPROVISIONED. Source-of-truth purge is left to AMA platform call.
 */
@Injectable()
export class TenantDeprovisionCron {
  private readonly logger = new Logger(TenantDeprovisionCron.name);

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(AcademyEntity)
    private readonly academyRepo: Repository<AcademyEntity>,
    @InjectRepository(SubscriptionEventEntity)
    private readonly eventRepo: Repository<SubscriptionEventEntity>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: 'tenant-deprovision-sweep' })
  async sweep(now: Date = new Date()): Promise<{ scanned: number; deprovisioned: number }> {
    const graceDays = Number(this.config.get('AMA_DEPROVISION_GRACE_DAYS', 90));
    const cutoff = new Date(now.getTime() - graceDays * 24 * 60 * 60 * 1000);

    const candidates = await this.academyRepo.find({
      where: {
        acdSubscriptionStatus: 'CANCELED',
        acdCanceledAt: LessThan(cutoff),
      },
    });

    let deprovisioned = 0;
    for (const a of candidates) {
      await this.academyRepo.update(a.acdId, {
        acdSubscriptionStatus: 'DEPROVISIONED',
        acdDeprovisionedAt: now,
      });
      const evt = this.eventRepo.create({
        acdId: a.acdId,
        subAmaTenantId: a.acdAmaTenantId ?? '',
        subEventType: 'SUBSCRIPTION_DEPROVISIONED',
        subPlan: a.acdSubscriptionPlan,
        subNonce: `cron-${a.acdId}-${now.getTime()}`,
        subSignature: 'system-cron',
        subEventAt: now,
        subPayload: { source: 'cron', graceDays, canceledAt: a.acdCanceledAt } as Record<string, unknown>,
        subProcessedAt: now,
        subProcessingError: null,
      } as Partial<SubscriptionEventEntity>);
      await this.eventRepo.save(evt);
      deprovisioned += 1;
    }

    this.logger.log(
      `Deprovision sweep — scanned=${candidates.length} deprovisioned=${deprovisioned} cutoff=${cutoff.toISOString()}`,
    );
    return { scanned: candidates.length, deprovisioned };
  }
}
