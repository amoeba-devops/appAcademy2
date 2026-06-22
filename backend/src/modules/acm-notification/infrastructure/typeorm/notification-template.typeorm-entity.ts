import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type NotificationChannel = 'EMAIL' | 'AMOEBATALK' | 'SMS';

/**
 * 알림 템플릿 — 채널 × locale 별 1행.
 *
 * @see sql/acm/960-acm-notification-schema.sql §1
 */
@Entity('amb_acm_notification_template')
@Index(
  'uq_acm_notification_template_code',
  ['entId', 'code', 'channel', 'locale'],
  { unique: true },
)
export class NotificationTemplateTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'ntp_id' })
  id!: string;

  @Column({ name: 'legacy_id', type: 'bigint', nullable: true, unique: true })
  legacyId?: string | null;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  /** Business code — e.g. 'enrollment.confirmed', 'class.session.reminder'. */
  @Column({ name: 'ntp_code', type: 'varchar', length: 40 })
  code!: string;

  @Column({ name: 'ntp_channel', type: 'varchar', length: 20 })
  channel!: NotificationChannel;

  @Column({ name: 'ntp_locale', type: 'varchar', length: 10, default: 'ko' })
  locale!: string;

  @Column({ name: 'ntp_subject', type: 'varchar', length: 200, nullable: true })
  subject?: string | null;

  @Column({ name: 'ntp_body_text', type: 'text', nullable: true })
  bodyText?: string | null;

  @Column({ name: 'ntp_body_html', type: 'text', nullable: true })
  bodyHtml?: string | null;

  @Column({ name: 'ntp_is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
