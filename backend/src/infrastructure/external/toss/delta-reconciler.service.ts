import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { IPaymentOrderRepository } from '../../../domain/repositories/payment-order-repository.interface.js';
import { PAYMENT_ORDER_REPOSITORY } from '../../../domain/repositories/payment-order-repository.interface.js';
import type { IPaymentProvider } from '../../../domain/repositories/payment-provider.interface.js';
import { PAYMENT_PROVIDER } from '../../../domain/repositories/payment-provider.interface.js';
import { PaymentOrder } from '../../../domain/entities/payment-order.js';

@Injectable()
export class DeltaReconcilerService {
  private readonly logger = new Logger(DeltaReconcilerService.name);

  constructor(
    @Inject(PAYMENT_ORDER_REPOSITORY)
    private readonly orderRepo: IPaymentOrderRepository,
    @Inject(PAYMENT_PROVIDER)
    private readonly paymentProvider: IPaymentProvider,
  ) {}

  /**
   * Every 5 minutes: find READY/IN_PROGRESS orders that haven't been
   * updated for 5+ minutes, query Toss for their real status, and sync.
   */
  @Cron('*/5 * * * *')
  async reconcile(): Promise<void> {
    const staleOrders = await this.orderRepo.findStalePendingOrders(5);
    if (staleOrders.length === 0) return;

    this.logger.log(`Reconciling ${staleOrders.length} stale order(s)`);

    for (const order of staleOrders) {
      await this.reconcileOrder(order);
    }
  }

  private async reconcileOrder(order: PaymentOrder): Promise<void> {
    // Orders without a pgPaymentKey: check expiry only
    if (!order.pgPaymentKey) {
      if (order.expiresAt && order.expiresAt < new Date()) {
        await this.orderRepo.updateStatus(order.id, 'EXPIRED');
        this.logger.log(`Order ${order.id} expired (no payment key)`);
      }
      return;
    }

    try {
      const tossPayment = await this.paymentProvider.fetchPayment(
        order.pgPaymentKey,
      );

      if (tossPayment.status === order.status) return;

      const extra: Partial<PaymentOrder> = {};
      if (tossPayment.approvedAt) {
        extra.approvedAt = new Date(tossPayment.approvedAt);
      }
      if (['CANCELED', 'PARTIAL_CANCELED'].includes(tossPayment.status)) {
        extra.canceledAt = new Date();
      }

      await this.orderRepo.updateStatus(order.id, tossPayment.status, extra);
      this.logger.log(
        `Reconciled order ${order.id}: ${order.status} → ${tossPayment.status}`,
      );
    } catch (err) {
      this.logger.error(
        `Reconcile failed for order ${order.id}: ${err}`,
      );
    }
  }
}
