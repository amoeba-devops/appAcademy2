import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export type MapFeeStatus = 'PAID' | 'UNPAID' | 'WAIVED';
export type MapWaiverReason =
  | 'RETAKE_WITHIN_90D'
  | 'TRIAL_PROMOTION'
  | 'SISTER_ACADEMY_TRANSFER'
  | 'OTHER';
export type MapScheduleStatus = 'SCHEDULED' | 'TAKEN' | 'NOT_TAKING' | 'RESCHEDULED';

/**
 * MAP test sub-table (1:1 with inquiry; F-10 ~ F-13 + waiver scaffolding).
 * @see acm-req-csl-001 v2.1 §3.2.4 / §3.2.7
 */
@Entity('amb_acm_csl_map_test')
@Index('idx_acm_csl_mpt_ent', ['entId'])
export class MapTestTypeormEntity {
  @PrimaryColumn({ name: 'mpt_id', type: 'uuid' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'inq_id', type: 'uuid' })
  inqId!: string;

  /** F-10 */
  @Column({ name: 'mpt_has_prior_score', type: 'boolean', nullable: true })
  hasPriorScore?: boolean | null;

  /** F-11 */
  @Column({ name: 'mpt_fee_status', type: 'varchar', length: 16, nullable: true })
  feeStatus?: MapFeeStatus | null;
  @Column({ name: 'mpt_waiver_reason', type: 'varchar', length: 40, nullable: true })
  waiverReason?: MapWaiverReason | null;
  @Column({ name: 'mpt_waiver_approver_id', type: 'uuid', nullable: true })
  waiverApproverId?: string | null;
  @Column({ name: 'mpt_waiver_approved_at', type: 'timestamptz', nullable: true })
  waiverApprovedAt?: Date | null;
  @Column({ name: 'mpt_waiver_note', type: 'text', nullable: true })
  waiverNote?: string | null;

  /** F-12 */
  @Column({ name: 'mpt_scheduled_at', type: 'date', nullable: true })
  scheduledAt?: string | null;
  @Column({ name: 'mpt_scheduled_status', type: 'varchar', length: 16, nullable: true })
  scheduledStatus?: MapScheduleStatus | null;

  /** F-13 — NWEA range 100-300 */
  @Column({ name: 'mpt_score_reading', type: 'int', nullable: true })
  scoreReading?: number | null;
  @Column({ name: 'mpt_score_math', type: 'int', nullable: true })
  scoreMath?: number | null;
  @Column({ name: 'mpt_score_language', type: 'int', nullable: true })
  scoreLanguage?: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
