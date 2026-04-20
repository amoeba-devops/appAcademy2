import { Inject, Injectable } from '@nestjs/common';
import type { IRefundPolicyRepository } from '../../../domain/repositories/refund-policy-repository.interface.js';
import { REFUND_POLICY_REPOSITORY } from '../../../domain/repositories/refund-policy-repository.interface.js';
import type { CreateRefundPolicyDto } from '../../dto/payment/create-refund-policy.dto.js';
import { RefundPolicyTier } from '../../../domain/entities/refund-policy.js';

@Injectable()
export class ManageRefundPolicyUseCase {
  constructor(
    @Inject(REFUND_POLICY_REPOSITORY)
    private readonly policyRepo: IRefundPolicyRepository,
  ) {}

  async listPolicies(academyId: number) {
    return this.policyRepo.findAllByAcademyId(academyId);
  }

  async getPolicy(id: number) {
    return this.policyRepo.findByIdWithTiers(id);
  }

  async createPolicy(academyId: number, dto: CreateRefundPolicyDto, userId: number) {
    // Determine next version number
    const existing = await this.policyRepo.findAllByAcademyId(academyId);
    const maxVersion = existing.reduce((max, p) => Math.max(max, p.version), 0);

    const tiers = dto.tiers.map((t) => {
      const tier = new RefundPolicyTier();
      tier.tierOrder = t.tierOrder;
      tier.elapsedRatioMin = t.elapsedRatioMin;
      tier.elapsedRatioMax = t.elapsedRatioMax;
      tier.refundRate = t.refundRate;
      tier.note = t.note ?? null;
      return tier;
    });

    return this.policyRepo.create({
      academyId,
      version: maxVersion + 1,
      basis: dto.basis ?? 'SESSION',
      label: dto.label,
      isDefaultTemplate: false,
      createdBy: userId,
      tiers,
    });
  }
}
