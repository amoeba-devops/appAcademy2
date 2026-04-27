import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

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

  /** F-15 */
  @Column({ name: 'tcl_feedback_status', type: 'varchar', length: 16, default: 'PENDING' })
  feedbackStatus!: FeedbackStatus;
  @Column({ name: 'tcl_feedback_sent_at', type: 'timestamptz', nullable: true })
  feedbackSentAt?: Date | null;
  @Column({ name: 'tcl_note', type: 'text', nullable: true })
  note?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
