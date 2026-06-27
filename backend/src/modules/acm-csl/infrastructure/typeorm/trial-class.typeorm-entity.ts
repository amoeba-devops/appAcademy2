import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/** @deprecated REQ-260626 FR-CSL-124 — replaced by `completed` + feedback_* columns. */
export type FeedbackStatus = 'SENT' | 'PENDING' | 'NA';

/**
 * Trial class sub-table (1:N — multiple sessions allowed; F-14 ~ F-15).
 * @see acm-req-csl-001 v2.1 §3 (Q-CSL-007 Sunday/holiday allowed with confirm)
 */
@Entity('amb_acm_csl_trial_class')
@Index('idx_acm_csl_tcl_inq', ['inqId', 'heldAt'])
export class TrialClassTypeormEntity {
  @PrimaryColumn({ name: 'tcl_id', type: 'uuid' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'inq_id', type: 'uuid' })
  inqId!: string;

  /** F-14 */
  @Column({ name: 'tcl_held_at', type: 'date' })
  heldAt!: string;

  /**
   * @deprecated REQ-260626 FR-CSL-124 — no longer written; replaced by
   * `completed` + feedback_* columns. Kept for back-compat read.
   */
  @Column({ name: 'tcl_feedback_status', type: 'varchar', length: 16, default: 'PENDING' })
  feedbackStatus!: FeedbackStatus;
  @Column({ name: 'tcl_feedback_sent_at', type: 'timestamptz', nullable: true })
  feedbackSentAt?: Date | null;
  @Column({ name: 'tcl_note', type: 'text', nullable: true })
  note?: string | null;

  // ── REQ-260626 (DSN §3.2 ALTER — demo class) ───────────────────────────

  /** FR-CSL-122 — 30-min granularity time (paired with heldAt). */
  @Column({ name: 'tcl_held_time', type: 'time', nullable: true })
  heldTime?: string | null;

  /** FR-CSL-123 — assigned demo teacher (AMA Client via amb_acm_tch_teacher). */
  @Column({ name: 'tcl_teacher_id', type: 'uuid', nullable: true })
  teacherId?: string | null;

  /** FR-CSL-125 — completion flag (replaces deprecated feedbackStatus PENDING/SENT). */
  @Column({ name: 'tcl_completed', type: 'boolean', default: false })
  completed!: boolean;

  /** FR-CSL-127 — teacher writes feedback after the session. */
  @Column({ name: 'tcl_feedback_body', type: 'text', nullable: true })
  feedbackBody?: string | null;
  @Column({ name: 'tcl_feedback_authored_by', type: 'uuid', nullable: true })
  feedbackAuthoredBy?: string | null;
  @Column({ name: 'tcl_feedback_authored_at', type: 'timestamptz', nullable: true })
  feedbackAuthoredAt?: Date | null;

  /** FR-CSL-128 — operator confirm before parent delivery (KakaoTalk manual copy). */
  @Column({ name: 'tcl_feedback_confirmed_by', type: 'uuid', nullable: true })
  feedbackConfirmedBy?: string | null;
  @Column({ name: 'tcl_feedback_confirmed_at', type: 'timestamptz', nullable: true })
  feedbackConfirmedAt?: Date | null;
  @Column({ name: 'tcl_feedback_delivered_at', type: 'timestamptz', nullable: true })
  feedbackDeliveredAt?: Date | null;

  /** FR-CSL-122 — CAL event link via meetKey csl:{inq}:DEMO:{tcl}. */
  @Column({ name: 'tcl_cal_event_id', type: 'uuid', nullable: true })
  calEventId?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
