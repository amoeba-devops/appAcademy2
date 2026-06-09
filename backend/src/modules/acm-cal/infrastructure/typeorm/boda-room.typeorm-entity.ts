import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type BodaRoomStatus =
  | 'PENDING'
  | 'OPEN'
  | 'STARTED'
  | 'PAUSED'
  | 'ENDED'
  | 'CLOSED';

/**
 * BODA 룸 — 캘린더 이벤트 1 : 0..1 매핑.
 *
 * `evt_meeting_provider = 'BODASCHOOL'` 인 이벤트가 생성될 때 `PENDING` 으로
 * 생성되고, 강사 `bodaOpen()` 호출 → BODA Webhook 이벤트 1 수신 시 `OPEN` 으로
 * 전이. 상태 머신 전체:
 *
 *   PENDING → OPEN → STARTED → (PAUSED) → ENDED → CLOSED
 *
 * @see REQ-260526 v2 §5.2 FR-ROOM-1 ~ 8
 */
@Entity('amb_acm_cal_boda_room')
@Index('uq_acm_boda_room_evt', ['evtId'], { unique: true })
@Index('uq_acm_boda_room_meet_key', ['meetKey'], { unique: true })
@Index('idx_acm_boda_room_ent_status', ['entId', 'status'])
export class BodaRoomTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'bdr_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'evt_id', type: 'uuid' })
  evtId!: string;

  @Column({ name: 'ses_id', type: 'uuid', nullable: true })
  sesId?: string | null;

  /**
   * `tac-{evtId hex 32}`. 전역 유일 · 불변 (FR-ROOM-2). CHECK 제약으로
   * 형식 강제.
   */
  @Column({ name: 'bdr_meet_key', type: 'varchar', length: 255 })
  meetKey!: string;

  @Column({ name: 'bdr_room_code', type: 'varchar', length: 30 })
  roomCode!: string;

  /** 개설 (이벤트 1) 수신 시 저장. SERVER API 호출의 핵심 키. */
  @Column({ name: 'bdr_meet_idx', type: 'varchar', length: 60, nullable: true })
  meetIdx?: string | null;

  @Column({
    name: 'bdr_status',
    type: 'varchar',
    length: 20,
    default: 'PENDING',
  })
  status!: BodaRoomStatus;

  @Column({ name: 'bdr_opened_at', type: 'timestamptz', nullable: true })
  openedAt?: Date | null;

  @Column({ name: 'bdr_started_at', type: 'timestamptz', nullable: true })
  startedAt?: Date | null;

  @Column({ name: 'bdr_ended_at', type: 'timestamptz', nullable: true })
  endedAt?: Date | null;

  @Column({ name: 'bdr_closed_at', type: 'timestamptz', nullable: true })
  closedAt?: Date | null;

  @Column({
    name: 'bdr_close_type',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  closeType?: string | null;

  @Column({ name: 'bdr_reconciled_at', type: 'timestamptz', nullable: true })
  reconciledAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
