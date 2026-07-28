import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * REQ-260728C — 대화방 멤버. 운영자(USER→usr_id)·강사(TEACHER→tch_id) 혼합.
 * 읽음 포인터(lastReadAt)를 멤버 행에 통합 (아메바톡 read_status 등가).
 */
export type TalkMemberKind = 'USER' | 'TEACHER';
export type TalkMemberRole = 'OWNER' | 'MEMBER';

@Entity('amb_acm_talk_member')
@Index('idx_acm_talk_member_ref', ['entId', 'kind', 'refId'], {
  where: 'tlm_left_at IS NULL',
})
@Index('idx_acm_talk_member_chn', ['entId', 'channelId'], {
  where: 'tlm_left_at IS NULL',
})
export class TalkMemberTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'tlm_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'tlc_id', type: 'uuid' })
  channelId!: string;

  @Column({ name: 'tlm_kind', type: 'varchar', length: 10 })
  kind!: TalkMemberKind;

  @Column({ name: 'tlm_ref_id', type: 'uuid' })
  refId!: string;

  @Column({ name: 'tlm_role', type: 'varchar', length: 10, default: 'MEMBER' })
  role!: TalkMemberRole;

  @Column({ name: 'tlm_last_read_at', type: 'timestamptz', nullable: true })
  lastReadAt?: Date | null;

  @Column({
    name: 'tlm_joined_at',
    type: 'timestamptz',
    default: () => 'NOW()',
  })
  joinedAt!: Date;

  @Column({ name: 'tlm_left_at', type: 'timestamptz', nullable: true })
  leftAt?: Date | null;
}
