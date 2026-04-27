import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AcademyEntity } from '../../infrastructure/database/entities/academy.entity';
import { SubscriptionEventEntity } from '../../infrastructure/database/entities/subscription-event.entity';

export interface ProvisionInput {
  amaTenantId: string;
  plan?: string | null;
  /** Initial academy display name (from AMA tenant profile or default). */
  name?: string | null;
  slug?: string | null;
  isDemo?: boolean;
  eventNonce: string;
  eventAt: Date;
  signature: string;
  rawPayload: Record<string, unknown>;
}

export interface ProvisionResult {
  acdId: number;
  created: boolean;
}

/**
 * Idempotent tenant provisioning.
 * - Looks up existing academy by acd_ama_tenant_id.
 * - If exists: updates subscription_status=ACTIVE/plan; no duplicate seed.
 * - If new:    INSERT academy + apply seed template inside a transaction.
 * - Records SubscriptionEvent ledger row regardless.
 */
@Injectable()
export class ProvisioningUseCase {
  private readonly logger = new Logger(ProvisioningUseCase.name);

  constructor(
    @InjectRepository(AcademyEntity)
    private readonly academyRepo: Repository<AcademyEntity>,
    @InjectRepository(SubscriptionEventEntity)
    private readonly eventRepo: Repository<SubscriptionEventEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async provision(input: ProvisionInput): Promise<ProvisionResult> {
    const existing = await this.academyRepo.findOne({
      where: { acdAmaTenantId: input.amaTenantId },
    });

    if (existing) {
      // Idempotent path — re-activate / update plan only.
      const patch: Partial<AcademyEntity> = {
        acdSubscriptionStatus: 'ACTIVE',
        acdCanceledAt: null,
        acdDeprovisionedAt: null,
      };
      if (input.plan != null) patch.acdSubscriptionPlan = input.plan;
      if (existing.acdProvisionedAt == null) patch.acdProvisionedAt = new Date();
      await this.academyRepo.update(existing.acdId, patch);
      await this.recordEvent(existing.acdId, input, null);
      return { acdId: existing.acdId, created: false };
    }

    // New tenant — transactional create + seed.
    const acdId = await this.dataSource.transaction(async (mgr) => {
      const academyRepo = mgr.getRepository(AcademyEntity);
      const academy = academyRepo.create({
        acdName: input.name ?? `Tenant ${input.amaTenantId}`,
        acdAmaTenantId: input.amaTenantId,
        acdSlug: input.slug ?? null,
        acdStatus: 'ACTIVE',
        acdSubscriptionStatus: 'ACTIVE',
        acdSubscriptionPlan: input.plan ?? null,
        acdProvisionedAt: new Date(),
        acdIsDemo: input.isDemo ? 1 : 0,
      } as Partial<AcademyEntity>);
      const saved = await academyRepo.save(academy);
      await this.applySeedTemplate(mgr, saved.acdId);
      return saved.acdId;
    });

    await this.recordEvent(acdId, input, null);
    this.logger.log(`Provisioned tenant acdId=${acdId} ama=${input.amaTenantId}`);
    return { acdId, created: true };
  }

  /**
   * Default refund policy (학원법 시행령 §18) seed.
   * Uses INSERT IGNORE for idempotency safety.
   */
  private async applySeedTemplate(
    mgr: import('typeorm').EntityManager,
    acdId: number,
  ): Promise<void> {
    await mgr.query(
      `INSERT IGNORE INTO tac_pay_refund_policies
         (acd_id, rfp_version, rfp_basis, rfp_label,
          rfp_effective_from, rfp_is_default_template)
       VALUES (?, 1, 'SESSION', '학원법 §18 기본 환불정책 v1', CURDATE(), 1)`,
      [acdId],
    );
    const rows: Array<{ rfp_id: number }> = await mgr.query(
      `SELECT rfp_id FROM tac_pay_refund_policies
        WHERE acd_id = ? AND rfp_version = 1
        ORDER BY rfp_id DESC LIMIT 1`,
      [acdId],
    );
    const rfpId = rows[0]?.rfp_id;
    if (rfpId == null) return;
    await mgr.query(
      `INSERT IGNORE INTO tac_pay_refund_policy_tiers
         (rfp_id, rpt_tier_order, rpt_elapsed_ratio_min, rpt_elapsed_ratio_max,
          rpt_refund_rate, rpt_note)
       VALUES
         (?, 1, 0.0000, 0.0001, 1.0000, '수강 개시 전 — 전액 환불'),
         (?, 2, 0.0001, 0.3333, 0.6667, '1/3 경과 전 — 2/3 환불'),
         (?, 3, 0.3334, 0.5000, 0.5000, '1/2 경과 전 — 1/2 환불'),
         (?, 4, 0.5001, 1.0000, 0.0000, '1/2 경과 후 — 환불 불가')`,
      [rfpId, rfpId, rfpId, rfpId],
    );
  }

  private async recordEvent(
    acdId: number,
    input: ProvisionInput,
    error: string | null,
  ): Promise<void> {
    const evt = this.eventRepo.create({
      acdId,
      subAmaTenantId: input.amaTenantId,
      subEventType: 'SUBSCRIPTION_CREATED',
      subPlan: input.plan ?? null,
      subNonce: input.eventNonce,
      subSignature: input.signature,
      subEventAt: input.eventAt,
      subPayload: input.rawPayload,
      subProcessedAt: new Date(),
      subProcessingError: error,
    } as Partial<SubscriptionEventEntity>);
    await this.eventRepo.save(evt);
  }
}
