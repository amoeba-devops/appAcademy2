import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('tac_notification_templates')
export class NotificationTemplateEntity {
  @PrimaryGeneratedColumn({ name: 'ntf_id', type: 'bigint', unsigned: true })
  ntfId: number;

  @Column({ name: 'acd_id', type: 'bigint', unsigned: true, default: 1 })
  acdId: number;

  @Column({ name: 'ntf_event', type: 'varchar', length: 50 })
  ntfEvent: string;

  @Column({ name: 'ntf_channel', type: 'varchar', length: 20, default: 'TALK' })
  ntfChannel: string;

  @Column({ name: 'ntf_title', type: 'varchar', length: 200 })
  ntfTitle: string;

  @Column({ name: 'ntf_body', type: 'text' })
  ntfBody: string;

  @Column({ name: 'ntf_variables', type: 'json', nullable: true })
  ntfVariables: string[] | null;

  @Column({ name: 'ntf_is_active', type: 'tinyint', default: 1 })
  ntfIsActive: number;

  @CreateDateColumn({ name: 'ntf_created_at' })
  ntfCreatedAt: Date;

  @UpdateDateColumn({ name: 'ntf_updated_at' })
  ntfUpdatedAt: Date;

  @Column({ name: 'ntf_deleted_at', type: 'datetime', nullable: true })
  ntfDeletedAt: Date | null;
}
