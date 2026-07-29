import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** REQ-260728C — 로비채팅 대화방 (GROUP 단체방 / DIRECT 1:1). 운영자만 개설. */
export type TalkChannelType = 'GROUP' | 'DIRECT';

@Entity('amb_acm_talk_channel')
export class TalkChannelTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'tlc_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'tlc_type', type: 'varchar', length: 10 })
  type!: TalkChannelType;

  @Column({ name: 'tlc_name', type: 'varchar', length: 100 })
  name!: string;

  /** 개설 운영자 (amb_acm_user.usr_id). */
  @Column({ name: 'tlc_created_by', type: 'uuid' })
  createdBy!: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
