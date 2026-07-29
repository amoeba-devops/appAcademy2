import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { TalkMemberKind } from './talk-member.typeorm-entity';

/** REQ-260728C — 로비채팅 메시지. TEXT | FILE(메시지당 1파일 ≤50MB). */
export type TalkMessageType = 'TEXT' | 'FILE';

@Entity('amb_acm_talk_message')
@Index('idx_acm_talk_msg_chn', ['entId', 'channelId', 'createdAt'], {
  where: 'deleted_at IS NULL',
})
export class TalkMessageTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'tms_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'tlc_id', type: 'uuid' })
  channelId!: string;

  @Column({ name: 'tms_sender_kind', type: 'varchar', length: 10 })
  senderKind!: TalkMemberKind;

  @Column({ name: 'tms_sender_ref', type: 'uuid' })
  senderRef!: string;

  @Column({ name: 'tms_type', type: 'varchar', length: 10, default: 'TEXT' })
  type!: TalkMessageType;

  @Column({ name: 'tms_content', type: 'text', default: '' })
  content!: string;

  @Column({
    name: 'tms_filename',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  filename?: string | null;

  @Column({ name: 'tms_mime', type: 'varchar', length: 100, nullable: true })
  mime?: string | null;

  @Column({ name: 'tms_size_bytes', type: 'bigint', nullable: true })
  sizeBytes?: string | null;

  @Column({ name: 'tms_s3_key', type: 'varchar', length: 500, nullable: true })
  s3Key?: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
