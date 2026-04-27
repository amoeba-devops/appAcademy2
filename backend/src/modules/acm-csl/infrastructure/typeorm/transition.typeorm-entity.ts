import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Stage transition log (immutable). Append-only.
 * @see C-10, C-11, AUD-CSL-003
 */
@Entity('amb_acm_csl_transition')
@Index('idx_acm_csl_transition_inq_at', ['inqId', 'occurredAt'])
export class TransitionTypeormEntity {
  @PrimaryColumn({ name: 'tr_id', type: 'uuid' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  /** Foreign key to consultation (a.k.a. inquiry) */
  @Column({ name: 'inq_id', type: 'uuid' })
  inqId!: string;

  @Column({ name: 'from_status', type: 'varchar', length: 32, nullable: true })
  fromStatus?: string | null;

  @Column({ name: 'to_status', type: 'varchar', length: 32 })
  toStatus!: string;

  @Column({ name: 'direction', type: 'varchar', length: 16, default: 'FORWARD' })
  direction!: 'FORWARD' | 'BACKWARD' | 'CANCEL' | 'REACTIVATE';

  @Column({ name: 'reason_code', type: 'varchar', length: 50, nullable: true })
  reasonCode?: string | null;

  @Column({ name: 'note', type: 'text', nullable: true })
  note?: string | null;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId?: string | null;

  @CreateDateColumn({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;
}
