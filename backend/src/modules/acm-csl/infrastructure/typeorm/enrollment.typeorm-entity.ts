import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export type NoticeStatus = 'SENT' | 'PENDING' | 'NA';
export type YesNo = 'YES' | 'NO';

/**
 * Enrollment sub-table (1:1 with inquiry; F-16 ~ F-24).
 * @see acm-req-csl-001 v2.1 §3.1 (BR-CSL-012 senior manager only for tuition_paid)
 */
@Entity('amb_acm_csl_enrollment')
@Index('idx_acm_csl_enr_ent', ['entId'])
export class EnrollmentTypeormEntity {
  @PrimaryColumn({ name: 'enr_id', type: 'uuid' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'inq_id', type: 'uuid' })
  inqId!: string;

  /** F-16 */
  @Column({ name: 'enr_payment_notice_status', type: 'varchar', length: 16, nullable: true })
  paymentNoticeStatus?: NoticeStatus | null;

  /** F-17 */
  @Column({ name: 'enr_counsel_done', type: 'varchar', length: 8, nullable: true })
  counselDone?: YesNo | null;

  /** F-18 */
  @Column({ name: 'enr_applied', type: 'boolean', nullable: true })
  applied?: boolean | null;

  /** F-19 */
  @Column({ name: 'enr_payment_notice_sent', type: 'varchar', length: 8, nullable: true })
  paymentNoticeSent?: YesNo | null;

  /** F-20 — minutes parsed from "120분" etc. */
  @Column({ name: 'enr_class_minutes', type: 'int', nullable: true })
  classMinutes?: number | null;

  /** F-21 — KRW, 0 ≤ x ≤ 50_000_000 (Q-CSL-008) */
  @Column({ name: 'enr_tuition_amount', type: 'numeric', precision: 12, scale: 0, nullable: true })
  tuitionAmount?: string | null;

  /** F-22 — BR-CSL-012 senior manager only */
  @Column({ name: 'enr_tuition_paid', type: 'boolean', nullable: true })
  tuitionPaid?: boolean | null;
  @Column({ name: 'enr_tuition_paid_actor_id', type: 'uuid', nullable: true })
  tuitionPaidActorId?: string | null;
  @Column({ name: 'enr_tuition_paid_at', type: 'timestamptz', nullable: true })
  tuitionPaidAt?: Date | null;

  /** F-23 */
  @Column({ name: 'cls_started_at', type: 'date', nullable: true })
  classStartedAt?: string | null;

  /** F-24 — triggers CLS module (ADR-001-A1) */
  @Column({ name: 'cls_started', type: 'varchar', length: 8, nullable: true })
  classStarted?: YesNo | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
