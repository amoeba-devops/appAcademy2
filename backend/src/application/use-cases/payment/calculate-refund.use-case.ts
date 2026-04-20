import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { IPaymentOrderRepository } from '../../../domain/repositories/payment-order-repository.interface.js';
import { PAYMENT_ORDER_REPOSITORY } from '../../../domain/repositories/payment-order-repository.interface.js';
import type { IRefundPolicyRepository } from '../../../domain/repositories/refund-policy-repository.interface.js';
import { REFUND_POLICY_REPOSITORY } from '../../../domain/repositories/refund-policy-repository.interface.js';
import { RefundCalculator } from '../../../domain/services/refund-calculator.js';
import type { CalculateRefundDto } from '../../dto/payment/calculate-refund.dto.js';

@Injectable()
export class CalculateRefundUseCase {
  constructor(
    @Inject(PAYMENT_ORDER_REPOSITORY)
    private readonly orderRepo: IPaymentOrderRepository,
    @Inject(REFUND_POLICY_REPOSITORY)
    private readonly policyRepo: IRefundPolicyRepository,
  ) {}

  async execute(dto: CalculateRefundDto) {
    const order = await this.orderRepo.findById(dto.orderId);
    if (!order) {
      throw new NotFoundException('Payment order not found');
    }

    if (!['DONE', 'PARTIAL_CANCELED'].includes(order.status)) {
      throw new Error(`Order status '${order.status}' is not eligible for refund`);
    }

    // Load refund policy snapshot from order creation time
    const policy = await this.policyRepo.findByIdWithTiers(order.refundPolicyId);
    if (!policy || policy.tiers.length === 0) {
      throw new Error('Refund policy or tiers not found');
    }

    const result = RefundCalculator.calculate(
      order.amount,
      dto.heldSessionCount,
      dto.totalSessionCount,
      policy.tiers,
    );

    return {
      orderId: order.id,
      orderNo: order.orderNo,
      orderAmount: order.amount,
      studentName: order.studentName,
      programName: order.programName,
      elapsedRatio: result.elapsedRatio,
      matchedTier: {
        id: result.matchedTier.id,
        tierOrder: result.matchedTier.tierOrder,
        refundRate: result.matchedTier.refundRate,
        note: result.matchedTier.note,
      },
      refundAmount: result.refundAmount,
      retainedAmount: result.retainedAmount,
      policy: {
        id: policy.id,
        label: policy.label,
        version: policy.version,
        tiers: policy.tiers.map((t) => ({
          id: t.id,
          tierOrder: t.tierOrder,
          elapsedRatioMin: t.elapsedRatioMin,
          elapsedRatioMax: t.elapsedRatioMax,
          refundRate: t.refundRate,
          note: t.note,
        })),
      },
    };
  }
}
