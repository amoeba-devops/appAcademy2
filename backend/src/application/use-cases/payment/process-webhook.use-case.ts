import { Inject, Injectable, Logger } from '@nestjs/common';
import type { IPaymentOrderRepository } from '../../../domain/repositories/payment-order-repository.interface.js';
import { PAYMENT_ORDER_REPOSITORY } from '../../../domain/repositories/payment-order-repository.interface.js';
import { PaymentOrder } from '../../../domain/entities/payment-order.js';
import { WebhookIdempotencyService } from '../../../infrastructure/webhook/webhook-idempotency.service.js';

export interface TossWebhookPayload {
  eventType: string;
  createdAt: string;
  data: {
    paymentKey: string;
    orderId: string;
    status: string;
    method?: string;
    totalAmount?: number;
    approvedAt?: string;
  };
}

@Injectable()
export class ProcessWebhookUseCase {
  private readonly logger = new Logger(ProcessWebhookUseCase.name);

  constructor(
    @Inject(PAYMENT_ORDER_REPOSITORY)
    private readonly orderRepo: IPaymentOrderRepository,
    private readonly idempotency: WebhookIdempotencyService,
  ) {}

  async execute(payload: TossWebhookPayload): Promise<void> {
    const { data } = payload;

    // Idempotency check — deduplicate by paymentKey + status + timestamp
    const eventKey = `${data.paymentKey}:${data.status}:${payload.createdAt}`;
    const isNew = await this.idempotency.tryAcquire(eventKey);
    if (!isNew) {
      this.logger.log(`Duplicate webhook event skipped: ${eventKey}`);
      return;
    }

    // Find order by paymentKey or orderId
    let order = await this.orderRepo.findByPgPaymentKey(data.paymentKey);
    if (!order) {
      order = await this.orderRepo.findByOrderNo(data.orderId);
    }
    if (!order) {
      this.logger.warn(
        `Order not found for webhook: paymentKey=${data.paymentKey}, orderId=${data.orderId}`,
      );
      return;
    }

    // Skip if already in terminal status
    if (order.status === data.status) {
      this.logger.log(
        `Order ${order.id} already in status ${data.status}, skipping`,
      );
      return;
    }

    // Build update payload
    const extra: Partial<PaymentOrder> = {};
    if (data.method) extra.method = data.method;
    if (data.paymentKey && !order.pgPaymentKey) {
      extra.pgPaymentKey = data.paymentKey;
    }
    if (data.approvedAt) extra.approvedAt = new Date(data.approvedAt);
    if (['CANCELED', 'PARTIAL_CANCELED'].includes(data.status)) {
      extra.canceledAt = new Date();
    }

    await this.orderRepo.updateStatus(order.id, data.status, extra);
    this.logger.log(
      `Webhook processed: order ${order.id} → ${data.status}`,
    );
  }
}
