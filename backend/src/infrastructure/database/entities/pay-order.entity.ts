import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { AcademyEntity } from './academy.entity';
import { EnrollmentEntity } from './enrollment.entity';
import { PayRefundPolicyEntity } from './pay-refund-policy.entity';
import { PayLedgerEntity } from './pay-ledger.entity';
import { PayReceiptEntity } from './pay-receipt.entity';
import { PayTaxInvoiceEntity } from './pay-tax-invoice.entity';

@Entity('tac_pay_orders')
export class PayOrderEntity {
  @PrimaryGeneratedColumn({ name: 'pod_id', type: 'bigint', unsigned: true })
  podId: number;

  @Column({ name: 'acd_id', type: 'bigint', unsigned: true })
  acdId: number;

  @Column({ name: 'enr_id', type: 'bigint', unsigned: true })
  enrId: number;

  @Column({ name: 'pod_order_no', type: 'varchar', length: 40 })
  podOrderNo: string;

  @Column({ name: 'pod_idempotency_key', type: 'varchar', length: 64 })
  podIdempotencyKey: string;

  @Column({ name: 'pod_amount', type: 'decimal', precision: 12, scale: 2 })
  podAmount: string;

  @Column({ name: 'pod_currency', type: 'char', length: 3, default: 'KRW' })
  podCurrency: string;

  @Column({ name: 'pod_method', type: 'varchar', length: 20, nullable: true })
  podMethod: string | null;

  @Column({ name: 'pod_pg_provider', type: 'varchar', length: 20, default: 'TOSS' })
  podPgProvider: string;

  @Column({ name: 'pod_pg_order_id', type: 'varchar', length: 64, nullable: true })
  podPgOrderId: string | null;

  @Column({ name: 'pod_pg_payment_key', type: 'varchar', length: 200, nullable: true })
  podPgPaymentKey: string | null;

  @Column({ name: 'pod_status', type: 'varchar', length: 30, default: 'READY' })
  podStatus: string;

  @Column({ name: 'rfp_id', type: 'bigint', unsigned: true })
  rfpId: number;

  @Column({ name: 'pod_expires_at', type: 'datetime', nullable: true })
  podExpiresAt: Date | null;

  @Column({ name: 'pod_approved_at', type: 'datetime', nullable: true })
  podApprovedAt: Date | null;

  @Column({ name: 'pod_canceled_at', type: 'datetime', nullable: true })
  podCanceledAt: Date | null;

  @CreateDateColumn({ name: 'pod_created_at' })
  podCreatedAt: Date;

  @UpdateDateColumn({ name: 'pod_updated_at' })
  podUpdatedAt: Date;

  @ManyToOne(() => AcademyEntity)
  @JoinColumn({ name: 'acd_id' })
  academy: AcademyEntity;

  @ManyToOne(() => EnrollmentEntity)
  @JoinColumn({ name: 'enr_id' })
  enrollment: EnrollmentEntity;

  @ManyToOne(() => PayRefundPolicyEntity)
  @JoinColumn({ name: 'rfp_id' })
  refundPolicy: PayRefundPolicyEntity;

  @OneToMany(() => PayLedgerEntity, (l) => l.order)
  ledgerEntries: PayLedgerEntity[];

  @OneToMany(() => PayReceiptEntity, (r) => r.order)
  receipts: PayReceiptEntity[];

  @OneToMany(() => PayTaxInvoiceEntity, (t) => t.order)
  taxInvoices: PayTaxInvoiceEntity[];
}
