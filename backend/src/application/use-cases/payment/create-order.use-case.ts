import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { PaymentOrder } from '../../../domain/entities/payment-order.js';
import type { IPaymentOrderRepository } from '../../../domain/repositories/payment-order-repository.interface.js';
import { PAYMENT_ORDER_REPOSITORY } from '../../../domain/repositories/payment-order-repository.interface.js';
import type { IEnrollmentRepository } from '../../../domain/repositories/enrollment-repository.interface.js';
import { ENROLLMENT_REPOSITORY } from '../../../domain/repositories/enrollment-repository.interface.js';
import type { CreatePaymentOrderDto } from '../../dto/payment/index.js';
import { PaymentOrderResponseDto } from '../../dto/payment/index.js';
import { randomBytes } from 'crypto';

@Injectable()
export class CreatePaymentOrderUseCase {
  constructor(
    @Inject(PAYMENT_ORDER_REPOSITORY)
    private readonly paymentOrderRepo: IPaymentOrderRepository,
    @Inject(ENROLLMENT_REPOSITORY)
    private readonly enrollmentRepo: IEnrollmentRepository,
  ) {}

  async execute(
    academyId: number,
    dto: CreatePaymentOrderDto,
  ): Promise<PaymentOrderResponseDto> {
    // Validate enrollment belongs to academy
    const enrollment = await this.enrollmentRepo.findById(dto.enrollmentId);
    if (!enrollment || enrollment.academyId !== academyId) {
      throw new BadRequestException('Enrollment not found');
    }
    if (enrollment.status !== 'CONFIRMED') {
      throw new BadRequestException('Enrollment must be CONFIRMED to create a payment');
    }

    // Idempotency check
    const existing = await this.paymentOrderRepo.findByIdempotencyKey(dto.idempotencyKey);
    if (existing) {
      throw new ConflictException('Duplicate idempotency key');
    }

    // Generate order number: TAC-{YYYYMMDD}-{random}
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = randomBytes(4).toString('hex').toUpperCase();
    const orderNo = `TAC-${dateStr}-${rand}`;

    // TODO: Lookup active refund policy for this academy
    // For now, use a placeholder rfpId = 1 — will be resolved in Task 4-3
    const refundPolicyId = 1;

    const order = new PaymentOrder();
    order.academyId = academyId;
    order.enrollmentId = dto.enrollmentId;
    order.orderNo = orderNo;
    order.idempotencyKey = dto.idempotencyKey;
    order.amount = dto.amount;
    order.currency = 'KRW';
    order.method = null;
    order.pgProvider = 'TOSS';
    order.pgOrderId = orderNo; // Toss orderId = our orderNo
    order.pgPaymentKey = null;
    order.status = 'READY';
    order.refundPolicyId = refundPolicyId;
    order.expiresAt = new Date(now.getTime() + 30 * 60 * 1000); // 30min expiry
    order.approvedAt = null;
    order.canceledAt = null;

    const saved = await this.paymentOrderRepo.create(order);
    return this.toResponse(saved);
  }

  private toResponse(o: PaymentOrder): PaymentOrderResponseDto {
    const dto = new PaymentOrderResponseDto();
    dto.id = o.id;
    dto.orderNo = o.orderNo;
    dto.enrollmentId = o.enrollmentId;
    dto.amount = o.amount;
    dto.currency = o.currency;
    dto.method = o.method;
    dto.pgProvider = o.pgProvider;
    dto.pgPaymentKey = o.pgPaymentKey;
    dto.status = o.status;
    dto.approvedAt = o.approvedAt?.toISOString() ?? null;
    dto.canceledAt = o.canceledAt?.toISOString() ?? null;
    dto.createdAt = o.createdAt instanceof Date ? o.createdAt.toISOString() : String(o.createdAt);
    dto.studentName = o.studentName ?? null;
    dto.parentName = o.parentName ?? null;
    dto.programName = o.programName ?? null;
    dto.className = o.className ?? null;
    return dto;
  }
}
