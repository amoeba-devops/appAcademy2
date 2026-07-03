import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ACM_DS } from '../acm-common/datasource';
import { PayLedgerTypeormEntity } from './infrastructure/typeorm/pay-ledger.typeorm-entity';
import { PayOrderTypeormEntity } from './infrastructure/typeorm/pay-order.typeorm-entity';
import { PayReceiptTypeormEntity } from './infrastructure/typeorm/pay-receipt.typeorm-entity';
import { PayRefundPolicyTierTypeormEntity } from './infrastructure/typeorm/pay-refund-policy-tier.typeorm-entity';
import { PayRefundPolicyTypeormEntity } from './infrastructure/typeorm/pay-refund-policy.typeorm-entity';
import { PayTaxInvoiceTypeormEntity } from './infrastructure/typeorm/pay-tax-invoice.typeorm-entity';
import { PayLedgerService } from './application/services/pay-ledger.service';
import { PayOrderService } from './application/services/pay-order.service';
import { PayReceiptService } from './application/services/pay-receipt.service';
import { PayRefundPolicyService } from './application/services/pay-refund-policy.service';
import { PayTaxInvoiceService } from './application/services/pay-tax-invoice.service';

/**
 * REQ-260622 Phase 2 — `acm-pay` 모듈.
 *
 * PostgreSQL payment module. Wires 6 TypeORM entities + service stack
 * against the `ACM_DS` datasource (db_acm).
 *
 * Import into `app.module.ts` when payment controllers are enabled.
 *
 * @see sql/acm/950-acm-pay-schema.sql
 */
@Module({
  imports: [
    TypeOrmModule.forFeature(
      [
        PayRefundPolicyTypeormEntity,
        PayRefundPolicyTierTypeormEntity,
        PayOrderTypeormEntity,
        PayLedgerTypeormEntity,
        PayReceiptTypeormEntity,
        PayTaxInvoiceTypeormEntity,
      ],
      ACM_DS,
    ),
  ],
  providers: [
    PayOrderService,
    PayLedgerService,
    PayReceiptService,
    PayRefundPolicyService,
    PayTaxInvoiceService,
  ],
  exports: [
    PayOrderService,
    PayLedgerService,
    PayReceiptService,
    PayRefundPolicyService,
    PayTaxInvoiceService,
  ],
})
export class AcmPayModule {}
