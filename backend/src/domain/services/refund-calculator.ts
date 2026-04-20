import type { RefundPolicyTier } from '../entities/refund-policy.js';

export interface RefundCalculation {
  elapsedRatio: number;
  matchedTier: RefundPolicyTier;
  refundAmount: number;
  retainedAmount: number;
}

/**
 * RefundCalculator — 수업일 기준 환불 계산 (학원법 시행령 §18)
 *
 * elapsed_ratio = held_session_count / total_session_count
 * tier = matching tier where min < ratio ≤ max
 * refund_amount = FLOOR(order_amount × tier.refund_rate)
 */
export class RefundCalculator {
  static calculate(
    orderAmount: number,
    heldSessionCount: number,
    totalSessionCount: number,
    tiers: RefundPolicyTier[],
  ): RefundCalculation {
    if (totalSessionCount <= 0) {
      throw new Error('Total session count must be greater than 0');
    }

    const elapsedRatio = heldSessionCount / totalSessionCount;

    // Find matching tier: min < ratio ≤ max
    const sorted = [...tiers].sort((a, b) => a.tierOrder - b.tierOrder);
    const matchedTier = sorted.find(
      (t) => elapsedRatio > t.elapsedRatioMin && elapsedRatio <= t.elapsedRatioMax,
    );

    if (!matchedTier) {
      throw new Error(
        `No matching refund tier for elapsed ratio ${elapsedRatio.toFixed(4)}`,
      );
    }

    const refundAmount = Math.floor(orderAmount * matchedTier.refundRate);
    const retainedAmount = orderAmount - refundAmount;

    return { elapsedRatio, matchedTier, refundAmount, retainedAmount };
  }
}
