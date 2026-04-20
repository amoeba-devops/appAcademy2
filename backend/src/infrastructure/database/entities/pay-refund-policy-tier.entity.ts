import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PayRefundPolicyEntity } from './pay-refund-policy.entity';

@Entity('tac_pay_refund_policy_tiers')
export class PayRefundPolicyTierEntity {
  @PrimaryGeneratedColumn({ name: 'rpt_id', type: 'bigint', unsigned: true })
  rptId: number;

  @Column({ name: 'rfp_id', type: 'bigint', unsigned: true })
  rfpId: number;

  @Column({ name: 'rpt_tier_order', type: 'tinyint' })
  rptTierOrder: number;

  @Column({ name: 'rpt_elapsed_ratio_min', type: 'decimal', precision: 5, scale: 4 })
  rptElapsedRatioMin: string;

  @Column({ name: 'rpt_elapsed_ratio_max', type: 'decimal', precision: 5, scale: 4 })
  rptElapsedRatioMax: string;

  @Column({ name: 'rpt_refund_rate', type: 'decimal', precision: 5, scale: 4 })
  rptRefundRate: string;

  @Column({ name: 'rpt_note', type: 'varchar', length: 200, nullable: true })
  rptNote: string | null;

  @ManyToOne(() => PayRefundPolicyEntity, (p) => p.tiers)
  @JoinColumn({ name: 'rfp_id' })
  policy: PayRefundPolicyEntity;
}
