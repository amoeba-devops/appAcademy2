import type { RefundPolicy } from '../entities/refund-policy.js';

export interface IRefundPolicyRepository {
  findByIdWithTiers(id: number): Promise<RefundPolicy | null>;
  findActiveByAcademyId(academyId: number): Promise<RefundPolicy | null>;
  findAllByAcademyId(academyId: number): Promise<RefundPolicy[]>;
  create(data: Partial<RefundPolicy>): Promise<RefundPolicy>;
}

export const REFUND_POLICY_REPOSITORY = Symbol('IRefundPolicyRepository');
