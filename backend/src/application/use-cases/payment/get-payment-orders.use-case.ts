import { Inject, Injectable } from '@nestjs/common';
import type { IPaymentOrderRepository } from '../../../domain/repositories/payment-order-repository.interface.js';
import { PAYMENT_ORDER_REPOSITORY } from '../../../domain/repositories/payment-order-repository.interface.js';
import { PaymentOrder } from '../../../domain/entities/payment-order.js';
import { PaymentOrderResponseDto } from '../../dto/payment/index.js';

@Injectable()
export class GetPaymentOrdersUseCase {
  constructor(
    @Inject(PAYMENT_ORDER_REPOSITORY)
    private readonly paymentOrderRepo: IPaymentOrderRepository,
  ) {}

  async execute(
    academyId: number,
    filters: {
      status?: string;
      enrollmentId?: number;
      method?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ): Promise<PaymentOrderResponseDto[]> {
    const orders = await this.paymentOrderRepo.findByAcademyIdWithFilters(
      academyId,
      filters,
    );
    return orders.map((o) => this.toResponse(o));
  }

  async executeById(id: number): Promise<PaymentOrderResponseDto | null> {
    const order = await this.paymentOrderRepo.findById(id);
    return order ? this.toResponse(order) : null;
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
