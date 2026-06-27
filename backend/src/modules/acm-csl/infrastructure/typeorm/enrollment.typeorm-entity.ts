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

  // ── REQ-260626 (DSN §3.2 ALTER — enrollment counseling) ────────────────

  /** FR-CSL-131 — operator-recorded counseling memo (phone/in-person notes). */
  @Column({ name: 'enr_counsel_memo', type: 'text', nullable: true })
  counselMemo?: string | null;

  /** FR-CSL-132 — course master FK (amb_acm_csl_course). */
  @Column({ name: 'enr_course_id', type: 'uuid', nullable: true })
  courseId?: string | null;

  /** FR-CSL-132 — freetext course when master entry is absent. */
  @Column({ name: 'enr_course_freetext', type: 'varchar', length: 100, nullable: true })
  courseFreetext?: string | null;

  /** FR-CSL-134 — total session count (>= 0). */
  @Column({ name: 'enr_session_count', type: 'int', nullable: true })
  sessionCount?: number | null;

  /** FR-CSL-135 — enrollment start date. */
  @Column({ name: 'enr_start_date', type: 'date', nullable: true })
  startDate?: string | null;

  /** FR-CSL-135 — enrollment end date (>= start_date when both present). */
  @Column({ name: 'enr_end_date', type: 'date', nullable: true })
  endDate?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
