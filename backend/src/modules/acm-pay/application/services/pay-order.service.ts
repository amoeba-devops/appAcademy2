import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ACM_DS } from '../../../acm-common/datasource';
import {
  PayOrderStatus,
  PayOrderTypeormEntity,
} from '../../infrastructure/typeorm/pay-order.typeorm-entity';

/**
 * Reference service for `amb_acm_pay_order` — minimal CRUD with tenant
 * guard. Pattern reused by the other 5 pay services (ledger, receipt,
 * tax_invoice etc.) during Phase 2 expansion.
 *
 * Tenant guard: every query is filtered by `entId`. The controller layer
 * (`OwnEntityGuard`) provides this from the JWT; this service trusts it.
 *
 * Soft delete: not supported — payment rows are immutable for audit /
 * compliance. State transitions go through `updateStatus()`.
 */
@Injectable()
export class PayOrderService {
  constructor(
    @InjectRepository(PayOrderTypeormEntity, ACM_DS)
    private readonly repo: Repository<PayOrderTypeormEntity>,
  ) {}

  /**
   * Idempotent create — same idempotency-key for the same tenant returns
   * the existing row instead of inserting a duplicate. Required for Toss
   * webhook retries (NFR-MYSQL-OUT-4 carries over to PG cutover).
   */
  async createIdempotent(input: {
    entId: string;
    enrollmentId: string;
    orderNo: string;
    idempotencyKey: string;
    amount: number;
    refundPolicyId: string;
    expiresAt?: Date | null;
  }): Promise<PayOrderTypeormEntity> {
    const existing = await this.repo.findOne({
      where: { entId: input.entId, idempotencyKey: input.idempotencyKey },
    });
    if (existing) return existing;

    const row = this.repo.create({
      entId: input.entId,
      enrollmentId: input.enrollmentId,
      orderNo: input.orderNo,
      idempotencyKey: input.idempotencyKey,
      amount: input.amount,
      currency: 'KRW',
      pgProvider: 'TOSS',
      status: 'READY',
      refundPolicyId: input.refundPolicyId,
      expiresAt: input.expiresAt ?? null,
    });
    return this.repo.save(row);
  }

  async findById(entId: string, id: string): Promise<PayOrderTypeormEntity> {
    const row = await this.repo.findOne({ where: { entId, id } });
    if (!row) throw new NotFoundException({ code: 'PAY_ORDER_NOT_FOUND', id });
    return row;
  }

  async findByOrderNo(
    entId: string,
    orderNo: string,
  ): Promise<PayOrderTypeormEntity | null> {
    return this.repo.findOne({ where: { entId, orderNo } });
  }

  async listForEnrollment(
    entId: string,
    enrollmentId: string,
  ): Promise<PayOrderTypeormEntity[]> {
    return this.repo.find({
      where: { entId, enrollmentId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * State transition via Toss webhook or admin action. Strictly forward —
   * REFUND / CANCEL go through the ledger service in Phase 2 follow-up.
   */
  async updateStatus(
    entId: string,
    id: string,
    next: PayOrderStatus,
    paymentKey?: string | null,
  ): Promise<PayOrderTypeormEntity> {
    const row = await this.findById(entId, id);
    row.status = next;
    if (paymentKey !== undefined) row.pgPaymentKey = paymentKey;
    if (next === 'DONE' && !row.approvedAt) row.approvedAt = new Date();
    if (
      (next === 'CANCELED' || next === 'PARTIAL_CANCELED') &&
      !row.canceledAt
    ) {
      row.canceledAt = new Date();
    }
    return this.repo.save(row);
  }

  // ────────────────────────────────────────────────────────────────────
  // Suppress unused-import warning on IsNull — kept for future soft
  // delete extension if business needs change.
  // ────────────────────────────────────────────────────────────────────
  private static readonly _isNullPlaceholder = IsNull;
}
