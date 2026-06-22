import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED';

/**
 * 알림 발송 로그 — append-only. BRIN created_at + partial pending/failed.
 *
 * @see sql/acm/960-acm-notification-schema.sql §2
 */
@Entity('amb_acm_notification_log')
@Index('idx_acm_notification_log_recipient', [
  'entId',
  'recipientKind',
  'recipientId',
  'createdAt',
])
export class NotificationLogTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'ntl_id' })
  id!: string;

  @Column({ name: 'legacy_id', type: 'bigint', nullable: true, unique: true })
  legacyId?: string | null;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'ntp_code', type: 'varchar', length: 40, nullable: true })
  templateCode?: string | null;

  @Column({ name: 'ntl_channel', type: 'varchar', length: 20 })
  channel!: string;

  @Column({ name: 'ntl_recipient_kind', type: 'varchar', length: 20, nullable: true })
  recipientKind?: 'STUDENT' | 'PARENT' | 'TEACHER' | 'STAFF' | null;

  @Column({ name: 'ntl_recipient_id', type: 'uuid', nullable: true })
  recipientId?: string | null;

  @Column({ name: 'ntl_to_address', type: 'varchar', length: 200, nullable: true })
  toAddress?: string | null;

  @Column({ name: 'ntl_subject', type: 'varchar', length: 200, nullable: true })
  subject?: string | null;

  @Column({ name: 'ntl_body_summary', type: 'varchar', length: 500, nullable: true })
  bodySummary?: string | null;

  @Column({ name: 'ntl_status', type: 'varchar', length: 20, default: 'PENDING' })
  status!: NotificationStatus;

  @Column({ name: 'ntl_error', type: 'varchar', length: 500, nullable: true })
  error?: string | null;

  @Column({ name: 'ntl_sent_at', type: 'timestamptz', nullable: true })
  sentAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
