import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PayOrderTypeormEntity } from './pay-order.typeorm-entity';
import { PayRefundPolicyTierTypeormEntity } from './pay-refund-policy-tier.typeorm-entity';

const numericMoneyTransformer = {
  to: (n: number | null): string | null => (n == null ? null : n.toFixed(2)),
  from: (s: string | null): number | null => (s == null ? null : Number(s)),
};

const numericRatioTransformer = {
  to: (n: number | null | undefined): string | null =>
    n == null ? null : n.toFixed(4),
  from: (s: string | null): number | null => (s == null ? null : Number(s)),
};

export type PayLedgerEntryType = 'CHARGE' | 'REFUND' | 'ADJUSTMENT';

/**
 * 결제 / 환불 / 조정 원장 — append-only audit (FR-046).
 *
 * @see sql/acm/950-acm-pay-schema.sql §4
 */
@Entity('amb_acm_pay_ledger')
@Index('idx_acm_pay_ledger_order', ['orderId', 'recordedAt'])
export class PayLedgerTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'ldg_id' })
  id!: string;

  @Column({ name: 'legacy_id', type: 'bigint', nullable: true, unique: true })
  legacyId?: string | null;

  @Column({ name: 'pod_id', type: 'uuid' })
  orderId!: string;

  @ManyToOne(() => PayOrderTypeormEntity)
  @JoinColumn({ name: 'pod_id', referencedColumnName: 'id' })
  order?: PayOrderTypeormEntity;

  @Column({ name: 'ldg_entry_type', type: 'varchar', length: 20 })
  entryType!: PayLedgerEntryType;

  @Column({
    name: 'ldg_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: numericMoneyTransformer,
  })
  amount!: number;

  @Column({
    name: 'ldg_balance_after',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: numericMoneyTransformer,
  })
  balanceAfter!: number;

  /** Refund tier snapshot (audit — A-013). */
  @Column({ name: 'prt_id', type: 'uuid', nullable: true })
  refundTierId?: string | null;

  @ManyToOne(() => PayRefundPolicyTierTypeormEntity, { nullable: true })
  @JoinColumn({ name: 'prt_id', referencedColumnName: 'id' })
  refundTier?: PayRefundPolicyTierTypeormEntity | null;

  @Column({
    name: 'ldg_elapsed_ratio_at_refund',
    type: 'numeric',
    precision: 5,
    scale: 4,
    nullable: true,
    transformer: numericRatioTransformer,
  })
  elapsedRatioAtRefund?: number | null;

  @Column({ name: 'ldg_memo', type: 'varchar', length: 200, nullable: true })
  memo?: string | null;

  @Column({ name: 'ldg_recorded_by', type: 'uuid', nullable: true })
  recordedBy?: string | null;

  @Column({ name: 'ldg_recorded_at', type: 'timestamptz' })
  recordedAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
