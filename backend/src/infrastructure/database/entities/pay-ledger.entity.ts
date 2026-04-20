import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PayOrderEntity } from './pay-order.entity';
import { PayRefundPolicyTierEntity } from './pay-refund-policy-tier.entity';

@Entity('tac_pay_ledger')
export class PayLedgerEntity {
  @PrimaryGeneratedColumn({ name: 'ldg_id', type: 'bigint', unsigned: true })
  ldgId: number;

  @Column({ name: 'pod_id', type: 'bigint', unsigned: true })
  podId: number;

  @Column({ name: 'ldg_entry_type', type: 'varchar', length: 20 })
  ldgEntryType: string;

  @Column({ name: 'ldg_amount', type: 'decimal', precision: 12, scale: 2 })
  ldgAmount: string;

  @Column({ name: 'ldg_balance_after', type: 'decimal', precision: 12, scale: 2 })
  ldgBalanceAfter: string;

  @Column({ name: 'rpt_id', type: 'bigint', unsigned: true, nullable: true })
  rptId: number | null;

  @Column({ name: 'ldg_elapsed_ratio_at_refund', type: 'decimal', precision: 5, scale: 4, nullable: true })
  ldgElapsedRatioAtRefund: string | null;

  @Column({ name: 'ldg_memo', type: 'varchar', length: 200, nullable: true })
  ldgMemo: string | null;

  @Column({ name: 'ldg_recorded_by', type: 'bigint', unsigned: true, nullable: true })
  ldgRecordedBy: number | null;

  @Column({ name: 'ldg_recorded_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  ldgRecordedAt: Date;

  @ManyToOne(() => PayOrderEntity, (o) => o.ledgerEntries)
  @JoinColumn({ name: 'pod_id' })
  order: PayOrderEntity;

  @ManyToOne(() => PayRefundPolicyTierEntity)
  @JoinColumn({ name: 'rpt_id' })
  refundTier: PayRefundPolicyTierEntity;
}
