import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BodaRoomTypeormEntity } from './boda-room.typeorm-entity';

export type BodaUserKind = 'TEACHER' | 'STUDENT' | 'OPERATOR' | 'UNKNOWN';

/**
 * BODA 룸 입·퇴장 기록 (room 1 : N participant).
 *
 * 한 사용자가 같은 룸에 여러 번 입장할 수 있음 (네트워크 끊김 등) — **매 입장이
 * 새 행**. 퇴장 webhook (이벤트 12) 수신 시 직전 행의 `leftAt` / `totalSeconds`
 * 를 갱신한다 (FR-EVENT-6/7).
 *
 * `bodaUserId` 는 BODA 측에 보낸 `UId` (= 앱 사용자 uuid 32hex). 역매핑된
 * `refUserId` 가 채워지면 CLS 회차 출결 (`amb_acm_cls_attendance`) 으로 UPSERT.
 */
@Entity('amb_acm_cal_boda_participant')
@Index('idx_acm_boda_participant_room', ['roomId', 'joinedAt'])
@Index('idx_acm_boda_participant_user', ['entId', 'bodaUserId'])
export class BodaParticipantTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'bdp_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'bdr_id', type: 'uuid' })
  roomId!: string;

  @ManyToOne(() => BodaRoomTypeormEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bdr_id', referencedColumnName: 'id' })
  room?: BodaRoomTypeormEntity;

  @Column({ name: 'bdp_boda_user_id', type: 'varchar', length: 60 })
  bodaUserId!: string;

  @Column({
    name: 'bdp_user_kind',
    type: 'varchar',
    length: 20,
    default: 'UNKNOWN',
  })
  userKind!: BodaUserKind;

  @Column({ name: 'bdp_ref_user_id', type: 'uuid', nullable: true })
  refUserId?: string | null;

  @Column({ name: 'bdp_joined_at', type: 'timestamptz' })
  joinedAt!: Date;

  @Column({ name: 'bdp_left_at', type: 'timestamptz', nullable: true })
  leftAt?: Date | null;

  @Column({ name: 'bdp_total_seconds', type: 'integer', nullable: true })
  totalSeconds?: number | null;

  @Column({
    name: 'bdp_client_type',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  clientType?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
