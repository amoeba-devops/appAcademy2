import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ACM_DS } from '../../../acm-common/datasource';
import { PayRefundPolicyTypeormEntity } from '../../infrastructure/typeorm/pay-refund-policy.typeorm-entity';
import { PayRefundPolicyTierTypeormEntity } from '../../infrastructure/typeorm/pay-refund-policy-tier.typeorm-entity';

/**
 * 환불 정책 + 단계 관리.
 *
 * 정책은 **버전 관리** — 신규 정책 등록 시 기존은 effective_to 가 채워지고
 * 새 row 가 생성됨. 이미 발급된 주문 (`amb_acm_pay_order.refund_policy_id`)
 * 은 자기 가입 시점의 정책을 그대로 가리키므로 정책 변경이 소급되지 않음
 * (A-012 — refund policy snapshot at order creation).
 */
@Injectable()
export class PayRefundPolicyService {
  constructor(
    @InjectRepository(PayRefundPolicyTypeormEntity, ACM_DS)
    private readonly policyRepo: Repository<PayRefundPolicyTypeormEntity>,
    @InjectRepository(PayRefundPolicyTierTypeormEntity, ACM_DS)
    private readonly tierRepo: Repository<PayRefundPolicyTierTypeormEntity>,
  ) {}

  /** Currently-active policy for the tenant (today within effective_from / _to). */
  async findActive(entId: string): Promise<PayRefundPolicyTypeormEntity | null> {
    return this.policyRepo
      .createQueryBuilder('p')
      .where('p.entId = :entId', { entId })
      .andWhere('p.effectiveFrom <= CURRENT_DATE')
      .andWhere('(p.effectiveTo IS NULL OR p.effectiveTo >= CURRENT_DATE)')
      .orderBy('p.version', 'DESC')
      .getOne();
  }

  async findById(entId: string, id: string): Promise<PayRefundPolicyTypeormEntity> {
    const row = await this.policyRepo.findOne({ where: { entId, id } });
    if (!row) throw new NotFoundException({ code: 'PAY_REFUND_POLICY_NOT_FOUND', id });
    return row;
  }

  async listTiers(policyId: string): Promise<PayRefundPolicyTierTypeormEntity[]> {
    return this.tierRepo.find({
      where: { policyId },
      order: { tierOrder: 'ASC' },
    });
  }

  /**
   * Resolve the refund tier for an order at the time of cancellation.
   * Falls back to "0% refund" tier (highest order) when elapsedRatio is
   * outside any defined range — defensive against off-by-one at boundaries.
   */
  async resolveTier(
    policyId: string,
    elapsedRatio: number,
  ): Promise<PayRefundPolicyTierTypeormEntity | null> {
    const tiers = await this.listTiers(policyId);
    for (const t of tiers) {
      if (elapsedRatio > t.elapsedRatioMin && elapsedRatio <= t.elapsedRatioMax) {
        return t;
      }
    }
    return null;
  }
}
