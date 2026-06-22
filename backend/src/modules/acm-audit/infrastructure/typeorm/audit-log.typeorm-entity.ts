import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type AuditAction =
  | 'CREATE'
  | 'READ'
  | 'UPDATE'
  | 'DELETE'
  | 'DECRYPT'
  | 'LOGIN'
  | 'LOGOUT'
  | 'EXPORT';

/**
 * PII 접근 감사 로그 — append-only. BRIN created_at index for time-series
 * compression. 90일 (Q-2 default) 초과 row 는 cron 으로 S3 archive + DELETE.
 *
 * Critical PII trail (NFR-005 / FN-039): DECRYPT action MUST be logged
 * every time a `*_encrypted` column is read into application memory.
 *
 * @see sql/acm/965-acm-audit-log.sql
 */
@Entity('amb_acm_audit_log')
@Index('idx_acm_audit_log_user_created', ['entId', 'userId', 'createdAt'])
@Index('idx_acm_audit_log_entity', ['entId', 'entityType', 'entityId', 'createdAt'])
export class AuditLogTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'adl_id' })
  id!: string;

  @Column({ name: 'legacy_id', type: 'bigint', nullable: true, unique: true })
  legacyId?: string | null;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'adl_user_id', type: 'uuid', nullable: true })
  userId?: string | null;

  @Column({ name: 'adl_action', type: 'varchar', length: 50 })
  action!: AuditAction;

  @Column({ name: 'adl_entity_type', type: 'varchar', length: 50 })
  entityType!: string;

  /** Stored as string — entities may be UUID, BIGINT (legacy), or composite. */
  @Column({ name: 'adl_entity_id', type: 'varchar', length: 64 })
  entityId!: string;

  /** Specific PII field touched (FN-039) — null for non-field actions. */
  @Column({ name: 'adl_field_name', type: 'varchar', length: 100, nullable: true })
  fieldName?: string | null;

  @Column({ name: 'adl_old_value', type: 'text', nullable: true })
  oldValue?: string | null;

  @Column({ name: 'adl_new_value', type: 'text', nullable: true })
  newValue?: string | null;

  @Column({ name: 'adl_ip', type: 'varchar', length: 45, nullable: true })
  ip?: string | null;

  @Column({ name: 'adl_user_agent', type: 'varchar', length: 500, nullable: true })
  userAgent?: string | null;

  @Column({ name: 'adl_reason', type: 'varchar', length: 200, nullable: true })
  reason?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
