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
 * PG NUMERIC → string by default. We surface as JS number for ratios in
 * the 0..1 range (no precision loss at 4 decimal places).
 */
const numericTransformer = {
  to: (n: number | null): string | null => (n == null ? null : n.toString()),
  from: (s: string | null): number | null => (s == null ? null : Number(s)),
};

/**
 * 환불 정책 단계 — 경과 비율 별 환불률 (CHECK 제약으로 0..1 범위 강제).
 *
 * @see sql/acm/950-acm-pay-schema.sql §2
 */
@Entity('amb_acm_pay_refund_policy_tier')
@Index('uq_acm_pay_refund_policy_tier_order', ['policyId', 'tierOrder'], { unique: true })
export class PayRefundPolicyTierTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'prt_id' })
  id!: string;

  @Column({ name: 'legacy_id', type: 'bigint', nullable: true, unique: true })
  legacyId?: string | null;

  @Column({ name: 'prp_id', type: 'uuid' })
  policyId!: string;

  @ManyToOne(() => PayRefundPolicyTypeormEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'prp_id', referencedColumnName: 'id' })
  policy?: PayRefundPolicyTypeormEntity;

  @Column({ name: 'prt_tier_order', type: 'smallint' })
  tierOrder!: number;

  /** Exclusive lower bound (0.0000 = 교습 개시). */
  @Column({
    name: 'prt_elapsed_ratio_min',
    type: 'numeric',
    precision: 5,
    scale: 4,
    transformer: numericTransformer,
  })
  elapsedRatioMin!: number;

  /** Inclusive upper bound (1.0000 = 교습 종료). */
  @Column({
    name: 'prt_elapsed_ratio_max',
    type: 'numeric',
    precision: 5,
    scale: 4,
    transformer: numericTransformer,
  })
  elapsedRatioMax!: number;

  @Column({
    name: 'prt_refund_rate',
    type: 'numeric',
    precision: 5,
    scale: 4,
    transformer: numericTransformer,
  })
  refundRate!: number;

  @Column({ name: 'prt_note', type: 'varchar', length: 200, nullable: true })
  note?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
