import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED' | 'RETRYING';

@Entity('tac_notification_logs')
@Index('idx_tac_nlg_academy_event', ['acdId', 'nlgEvent', 'nlgCreatedAt'])
@Index('idx_tac_nlg_status', ['nlgStatus', 'nlgCreatedAt'])
@Index('idx_tac_nlg_subject', ['nlgSubjectKind', 'nlgSubjectId'])
export class NotificationLogEntity {
  @PrimaryGeneratedColumn({ name: 'nlg_id', type: 'bigint', unsigned: true })
  nlgId: number;

  @Column({ name: 'acd_id', type: 'bigint', unsigned: true })
  acdId: number;

  @Column({ name: 'nlg_event', type: 'varchar', length: 50 })
  nlgEvent: string;

  @Column({ name: 'nlg_template_id', type: 'bigint', unsigned: true, nullable: true })
  nlgTemplateId: number | null;

  @Column({ name: 'nlg_channel', type: 'varchar', length: 20, default: 'TALK' })
  nlgChannel: string;

  @Column({ name: 'nlg_recipient', type: 'varchar', length: 40 })
  nlgRecipient: string;

  @Column({ name: 'nlg_recipient_kind', type: 'varchar', length: 20, default: 'PARENT' })
  nlgRecipientKind: string;

  @Column({ name: 'nlg_subject_id', type: 'bigint', unsigned: true, nullable: true })
  nlgSubjectId: number | null;

  @Column({ name: 'nlg_subject_kind', type: 'varchar', length: 30, nullable: true })
  nlgSubjectKind: string | null;

  @Column({ name: 'nlg_body', type: 'text' })
  nlgBody: string;

  @Column({ name: 'nlg_variables', type: 'json', nullable: true })
  nlgVariables: Record<string, unknown> | null;

  @Column({ name: 'nlg_status', type: 'varchar', length: 20, default: 'PENDING' })
  nlgStatus: NotificationStatus;

  @Column({ name: 'nlg_provider_msg_id', type: 'varchar', length: 100, nullable: true })
  nlgProviderMsgId: string | null;

  @Column({ name: 'nlg_error_code', type: 'varchar', length: 50, nullable: true })
  nlgErrorCode: string | null;

  @Column({ name: 'nlg_error_message', type: 'varchar', length: 500, nullable: true })
  nlgErrorMessage: string | null;

  @Column({ name: 'nlg_attempts', type: 'int', unsigned: true, default: 0 })
  nlgAttempts: number;

  @Column({ name: 'nlg_sent_at', type: 'datetime', nullable: true })
  nlgSentAt: Date | null;

  @CreateDateColumn({ name: 'nlg_created_at' })
  nlgCreatedAt: Date;

  @UpdateDateColumn({ name: 'nlg_updated_at' })
  nlgUpdatedAt: Date;
}
