import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CreatePaymentOrderUseCase,
  ConfirmPaymentUseCase,
  GetPaymentOrdersUseCase,
  ProcessWebhookUseCase,
  CalculateRefundUseCase,
  ExecuteRefundUseCase,
  CreateTaxInvoiceUseCase,
  SubmitTaxInvoiceUseCase,
  GetTaxInvoicesUseCase,
} from '../application/use-cases/payment/index.js';
import { PAYMENT_ORDER_REPOSITORY } from '../domain/repositories/payment-order-repository.interface.js';
import { PAYMENT_PROVIDER } from '../domain/repositories/payment-provider.interface.js';
import { REFUND_POLICY_REPOSITORY } from '../domain/repositories/refund-policy-repository.interface.js';
import { LEDGER_REPOSITORY } from '../domain/repositories/ledger-repository.interface.js';
import { TAX_INVOICE_REPOSITORY } from '../domain/repositories/tax-invoice-repository.interface.js';
import { NTS_ETAX_PROVIDER } from '../domain/repositories/nts-etax-provider.interface.js';
import { PayOrderEntity } from '../infrastructure/database/entities/pay-order.entity';
import { PayRefundPolicyEntity } from '../infrastructure/database/entities/pay-refund-policy.entity';
import { PayRefundPolicyTierEntity } from '../infrastructure/database/entities/pay-refund-policy-tier.entity';
import { PayLedgerEntity } from '../infrastructure/database/entities/pay-ledger.entity';
import { PayTaxInvoiceEntity } from '../infrastructure/database/entities/pay-tax-invoice.entity';
import { PaymentOrderRepository } from '../infrastructure/database/repositories/payment-order.repository';
import { RefundPolicyRepository } from '../infrastructure/database/repositories/refund-policy.repository';
import { LedgerRepository } from '../infrastructure/database/repositories/ledger.repository';
import { TaxInvoiceRepository } from '../infrastructure/database/repositories/tax-invoice.repository';
import { TossPaymentsClient } from '../infrastructure/external/toss/toss-payments.client';
import { DeltaReconcilerService } from '../infrastructure/external/toss/delta-reconciler.service';
import { NtsEtaxAdapter } from '../infrastructure/external/nts/nts-etax.adapter';
import { TaxInvoiceBatchService } from '../infrastructure/external/nts/tax-invoice-batch.service';
import { ManageRefundPolicyUseCase } from '../application/use-cases/payment/manage-refund-policy.use-case';
import { GetReceiptsUseCase } from '../application/use-cases/payment/get-receipts.use-case';
import { RECEIPT_REPOSITORY } from '../domain/repositories/receipt-repository.interface';
import { PayReceiptEntity } from '../infrastructure/database/entities/pay-receipt.entity';
import { ReceiptRepository } from '../infrastructure/database/repositories/receipt.repository';
import { redisProvider } from '../infrastructure/config/redis.provider';
import { WebhookIdempotencyService } from '../infrastructure/webhook/webhook-idempotency.service';
import { PaymentController } from './controllers/payment.controller';
import { WebhookController } from './controllers/webhook.controller';
import { TossWebhookGuard } from './guards/toss-webhook.guard';
import { EnrollmentModule } from './enrollment.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PayOrderEntity, PayRefundPolicyEntity, PayRefundPolicyTierEntity, PayLedgerEntity, PayTaxInvoiceEntity, PayReceiptEntity]),
    EnrollmentModule,
  ],
  controllers: [PaymentController, WebhookController],
  providers: [
    // Infrastructure
    redisProvider,
    { provide: PAYMENT_ORDER_REPOSITORY, useClass: PaymentOrderRepository },
    { provide: PAYMENT_PROVIDER, useClass: TossPaymentsClient },
    { provide: REFUND_POLICY_REPOSITORY, useClass: RefundPolicyRepository },
    { provide: LEDGER_REPOSITORY, useClass: LedgerRepository },
    { provide: TAX_INVOICE_REPOSITORY, useClass: TaxInvoiceRepository },
    { provide: NTS_ETAX_PROVIDER, useClass: NtsEtaxAdapter },
    { provide: RECEIPT_REPOSITORY, useClass: ReceiptRepository },
    WebhookIdempotencyService,
    DeltaReconcilerService,
    TaxInvoiceBatchService,
    TossWebhookGuard,
    // Use Cases
    GetPaymentOrdersUseCase,
    CreatePaymentOrderUseCase,
    ConfirmPaymentUseCase,
    ProcessWebhookUseCase,
    CalculateRefundUseCase,
    ExecuteRefundUseCase,
    CreateTaxInvoiceUseCase,
    SubmitTaxInvoiceUseCase,
    GetTaxInvoicesUseCase,
    ManageRefundPolicyUseCase,
    GetReceiptsUseCase,
  ],
  exports: [PAYMENT_ORDER_REPOSITORY],
})
export class PaymentModule {}
