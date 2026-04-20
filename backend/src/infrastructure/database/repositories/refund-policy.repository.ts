import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { PayRefundPolicyEntity } from '../entities/pay-refund-policy.entity';
import { PayRefundPolicyTierEntity } from '../entities/pay-refund-policy-tier.entity';
import { RefundPolicy, RefundPolicyTier } from '../../../domain/entities/refund-policy.js';
import type { IRefundPolicyRepository } from '../../../domain/repositories/refund-policy-repository.interface.js';

@Injectable()
export class RefundPolicyRepository implements IRefundPolicyRepository {
  constructor(
    @InjectRepository(PayRefundPolicyEntity)
    private readonly repo: Repository<PayRefundPolicyEntity>,
    @InjectRepository(PayRefundPolicyTierEntity)
    private readonly tierRepo: Repository<PayRefundPolicyTierEntity>,
  ) {}

  async findByIdWithTiers(id: number): Promise<RefundPolicy | null> {
    const entity = await this.repo.findOne({
      where: { rfpId: id },
      relations: ['tiers'],
    });
    return entity ? this.toDomain(entity) : null;
  }

  async findActiveByAcademyId(academyId: number): Promise<RefundPolicy | null> {
    const entity = await this.repo.findOne({
      where: { acdId: academyId, rfpEffectiveTo: IsNull() },
      relations: ['tiers'],
      order: { rfpVersion: 'DESC' },
    });
    return entity ? this.toDomain(entity) : null;
  }

  async findAllByAcademyId(academyId: number): Promise<RefundPolicy[]> {
    const entities = await this.repo.find({
      where: { acdId: academyId },
      relations: ['tiers'],
      order: { rfpVersion: 'DESC' },
    });
    return entities.map((e) => this.toDomain(e));
  }

  async create(data: Partial<RefundPolicy>): Promise<RefundPolicy> {
    // If there's a currently active policy, close it
    if (!data.effectiveTo) {
      const active = await this.repo.findOne({
        where: { acdId: data.academyId!, rfpEffectiveTo: IsNull() },
        order: { rfpVersion: 'DESC' },
      });
      if (active) {
        await this.repo.update(
          { rfpId: active.rfpId },
          { rfpEffectiveTo: new Date().toISOString().slice(0, 19).replace('T', ' ') },
        );
      }
    }

    const policyEntity = this.repo.create({
      acdId: data.academyId!,
      rfpVersion: data.version ?? 1,
      rfpBasis: data.basis ?? 'SESSION',
      rfpLabel: data.label ?? '',
      rfpEffectiveFrom: data.effectiveFrom
        ? new Date(data.effectiveFrom).toISOString().slice(0, 19).replace('T', ' ')
        : new Date().toISOString().slice(0, 19).replace('T', ' '),
      rfpEffectiveTo: data.effectiveTo
        ? new Date(data.effectiveTo).toISOString().slice(0, 19).replace('T', ' ')
        : null,
      rfpIsDefaultTemplate: data.isDefaultTemplate ? 1 : 0,
      rfpCreatedBy: data.createdBy ?? null,
    });
    const saved = await this.repo.save(policyEntity);

    // Create tiers
    if (data.tiers && data.tiers.length > 0) {
      const tierEntities = data.tiers.map((t) =>
        this.tierRepo.create({
          rfpId: saved.rfpId,
          rptTierOrder: t.tierOrder,
          rptElapsedRatioMin: String(t.elapsedRatioMin),
          rptElapsedRatioMax: String(t.elapsedRatioMax),
          rptRefundRate: String(t.refundRate),
          rptNote: t.note ?? null,
        }),
      );
      await this.tierRepo.save(tierEntities);
    }

    return this.findByIdWithTiers(saved.rfpId) as Promise<RefundPolicy>;
  }

  private toDomain(entity: PayRefundPolicyEntity): RefundPolicy {
    const policy = new RefundPolicy();
    policy.id = entity.rfpId;
    policy.academyId = entity.acdId;
    policy.version = entity.rfpVersion;
    policy.basis = entity.rfpBasis;
    policy.label = entity.rfpLabel;
    policy.effectiveFrom = entity.rfpEffectiveFrom;
    policy.effectiveTo = entity.rfpEffectiveTo;
    policy.isDefaultTemplate = entity.rfpIsDefaultTemplate === 1;
    policy.createdBy = entity.rfpCreatedBy;
    policy.createdAt = entity.rfpCreatedAt;
    policy.tiers = (entity.tiers ?? [])
      .map((t) => {
        const tier = new RefundPolicyTier();
        tier.id = t.rptId;
        tier.policyId = t.rfpId;
        tier.tierOrder = t.rptTierOrder;
        tier.elapsedRatioMin = Number(t.rptElapsedRatioMin);
        tier.elapsedRatioMax = Number(t.rptElapsedRatioMax);
        tier.refundRate = Number(t.rptRefundRate);
        tier.note = t.rptNote;
        return tier;
      })
      .sort((a, b) => a.tierOrder - b.tierOrder);
    return policy;
  }
}
