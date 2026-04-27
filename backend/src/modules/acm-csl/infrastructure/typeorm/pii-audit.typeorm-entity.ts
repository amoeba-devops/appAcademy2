import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Audit log for PII reveal events (C-07, NFR-CSL-S01).
 * Append-only.
 */
@Entity('amb_acm_csl_pii_audit')
@Index('idx_acm_csl_pii_audit_inq_at', ['inqId', 'occurredAt'])
@Index('idx_acm_csl_pii_audit_actor_at', ['actorId', 'occurredAt'])
export class PiiAuditTypeormEntity {
  @PrimaryColumn({ name: 'audit_id', type: 'uuid' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'inq_id', type: 'uuid' })
  inqId!: string;

  @Column({ name: 'action', type: 'varchar', length: 32 })
  action!: 'REVEAL_PHONE' | 'REVEAL_NAME';

  @Column({ name: 'actor_id', type: 'uuid' })
  actorId!: string;

  @Column({ name: 'ip', type: 'varchar', length: 45, nullable: true })
  ip?: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 500, nullable: true })
  userAgent?: string | null;

  @CreateDateColumn({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;
}
