import { PaymentOrder } from '../entities/payment-order.js';
import type { IRepository } from './repository.interface.js';

export interface IPaymentOrderRepository extends IRepository<PaymentOrder> {
  findByAcademyIdWithFilters(
    academyId: number,
    filters: {
      status?: string;
      enrollmentId?: number;
      method?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ): Promise<PaymentOrder[]>;

  findByOrderNo(orderNo: string): Promise<PaymentOrder | null>;

  findByIdempotencyKey(key: string): Promise<PaymentOrder | null>;

  findByPgPaymentKey(pgPaymentKey: string): Promise<PaymentOrder | null>;

  findByEnrollmentId(enrollmentId: number): Promise<PaymentOrder[]>;

  updateStatus(id: number, status: string, extra?: Partial<PaymentOrder>): Promise<PaymentOrder>;

  findStalePendingOrders(olderThanMinutes: number): Promise<PaymentOrder[]>;
}

export const PAYMENT_ORDER_REPOSITORY = Symbol('IPaymentOrderRepository');
