import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ACM_DS } from '../acm-common/datasource';
import { PayLedgerTypeormEntity } from './infrastructure/typeorm/pay-ledger.typeorm-entity';
import { PayOrderTypeormEntity } from './infrastructure/typeorm/pay-order.typeorm-entity';
import { PayReceiptTypeormEntity } from './infrastructure/typeorm/pay-receipt.typeorm-entity';
import { PayRefundPolicyTierTypeormEntity } from './infrastructure/typeorm/pay-refund-policy-tier.typeorm-entity';
import { PayRefundPolicyTypeormEntity } from './infrastructure/typeorm/pay-refund-policy.typeorm-entity';
import { PayTaxInvoiceTypeormEntity } from './infrastructure/typeorm/pay-tax-invoice.typeorm-entity';
import { PayOrderService } from './application/services/pay-order.service';

/**
 * REQ-260622 Phase 2 — `acm-pay` 모듈.
 *
 * Migrates the legacy `presentation/payment.module.ts` (which reads from
 * MySQL `tac_pay_*`) to the PG-only world. Wires 6 TypeORM entities +
 * service stack against the `ACM_DS` datasource (db_acm).
 *
 * **NOT yet imported into `app.module.ts`** — Phase 2 actual implementation
 * will add this to the root imports, swap out the legacy payment.module,
 * and rewrite controllers. Until then the module compiles, type-checks,
 * and is unit-test ready but does not participate in the running app.
 *
 * @see docs/plan/PLN-260622-mysql-to-postgres-full-migration.md §3 (Phase 2)
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
  providers: [PayOrderService],
  exports: [PayOrderService],
})
export class AcmPayModule {}
