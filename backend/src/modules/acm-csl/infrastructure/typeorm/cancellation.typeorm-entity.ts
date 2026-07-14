import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

export type CancellationReasonCode =
  | 'SIMPLE_INQUIRY_END'
  | 'ACADEMY_CANCELLED'
  | 'STUDENT_ILLNESS'
  | 'STUDENT_SCHEDULE_CHANGE'
  | 'PAYMENT_DECLINED'
  | 'LOST_TO_COMPETITOR'
  | 'OTHER';

/**
 * Cancellation log (1:N) — structured drop reasons per Q-CSL-006.
 * Append-only.
 */
@Entity('amb_acm_csl_cancellation')
@Index('idx_acm_csl_cnc_inq', ['inqId', 'occurredAt'])
export class CancellationTypeormEntity {
  @PrimaryColumn({ name: 'cnc_id', type: 'uuid' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'inq_id', type: 'uuid' })
  inqId!: string;

  @Column({ name: 'cnc_reason_code', type: 'varchar', length: 40 })
  reasonCode!: CancellationReasonCode;

  @Column({ name: 'cnc_reason_other', type: 'text', nullable: true })
  reasonOther?: string | null;

  @Column({ name: 'cnc_actor_id', type: 'uuid', nullable: true })
  actorId?: string | null;

  @CreateDateColumn({ name: 'cnc_occurred_at', type: 'timestamptz' })
  occurredAt!: Date;
}
