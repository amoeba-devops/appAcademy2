import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PayRefundPolicyTypeormEntity } from './pay-refund-policy.typeorm-entity';

/**
 * NUMERIC(12,2) — KRW amounts; 2 decimal precision is safe in JS number
 * range (< 2^53). Customers don't transact in fractional won at present,
 * but the column allows future multi-currency support.
 */
const numericMoneyTransformer = {
  to: (n: number | null): string | null => (n == null ? null : n.toFixed(2)),
  from: (s: string | null): number | null => (s == null ? null : Number(s)),
};

export type PayOrderStatus =
  | 'READY'
  | 'IN_PROGRESS'
  | 'DONE'
  | 'CANCELED'
  | 'PARTIAL_CANCELED'
  | 'ABORTED'
  | 'EXPIRED';

export type PayOrderMethod = 'CARD' | 'TRANSFER' | 'VACCOUNT' | 'EASY_PAY';

/**
 * Payment order — Toss PG 결제 주문 (운영 핵심).
 *
 * **PCI-DSS SAQ-A 준수**: `pgPaymentKey` 은 Toss 가 발급한 토큰만 저장.
 * 카드 PAN / CVC 절대 저장 X. raw 카드 데이터는 Toss Widget SDK 가 직접
 * Toss 측으로 전송하며, 본 시스템은 토큰화된 paymentKey 만 받음.
 *
 * @see sql/acm/950-acm-pay-schema.sql §3
 */
@Entity('amb_acm_pay_order')
@Index('uq_acm_pay_order_order_no', ['orderNo'], { unique: true })
@Index('uq_acm_pay_order_idempotency', ['idempotencyKey'], { unique: true })
@Index('idx_acm_pay_order_enrollment', ['enrollmentId'])
@Index('idx_acm_pay_order_status', ['entId', 'status'])
@Index('idx_acm_pay_order_created', ['entId', 'createdAt'])
export class PayOrderTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'pod_id' })
  id!: string;

  @Column({ name: 'legacy_id', type: 'bigint', nullable: true, unique: true })
  legacyId?: string | null;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'enrollment_id', type: 'uuid' })
  enrollmentId!: string;

  @Column({ name: 'pod_order_no', type: 'varchar', length: 40 })
  orderNo!: string;

  /** Toss orderId mirror — also enforces business-level idempotency. */
  @Column({ name: 'pod_idempotency_key', type: 'varchar', length: 64 })
  idempotencyKey!: string;

  @Column({
    name: 'pod_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: numericMoneyTransformer,
  })
  amount!: number;

  @Column({ name: 'pod_currency', type: 'char', length: 3, default: 'KRW' })
  currency!: string;

  @Column({ name: 'pod_method', type: 'varchar', length: 20, nullable: true })
  method?: PayOrderMethod | null;

  @Column({ name: 'pod_pg_provider', type: 'varchar', length: 20, default: 'TOSS' })
  pgProvider!: 'TOSS';

  @Column({ name: 'pod_pg_order_id', type: 'varchar', length: 64, nullable: true })
  pgOrderId?: string | null;

  /** Toss paymentKey — 토큰만 저장 (PCI-DSS SAQ-A). */
  @Column({ name: 'pod_pg_payment_key', type: 'varchar', length: 200, nullable: true })
  pgPaymentKey?: string | null;

  @Column({
    name: 'pod_status',
    type: 'varchar',
    length: 30,
    default: 'READY',
  })
  status!: PayOrderStatus;

  /** Snapshot of refund policy version at order creation (A-012). */
  @Column({ name: 'prp_id', type: 'uuid' })
  refundPolicyId!: string;

  @ManyToOne(() => PayRefundPolicyTypeormEntity)
  @JoinColumn({ name: 'prp_id', referencedColumnName: 'id' })
  refundPolicy?: PayRefundPolicyTypeormEntity;

  @Column({ name: 'pod_expires_at', type: 'timestamptz', nullable: true })
  expiresAt?: Date | null;

  @Column({ name: 'pod_approved_at', type: 'timestamptz', nullable: true })
  approvedAt?: Date | null;

  @Column({ name: 'pod_canceled_at', type: 'timestamptz', nullable: true })
  canceledAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
