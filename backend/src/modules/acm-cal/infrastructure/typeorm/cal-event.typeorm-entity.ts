import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type CalCategory =
  | 'CLASS'
  | 'MEETING'
  | 'EVENT'
  | 'PERSONAL'
  | 'LEVEL_TEST'
  | 'DEMO_CLASS'
  | 'REGULAR_CLASS'
  | 'OTHER';
export type CalMeetingProvider = 'NONE' | 'GOOGLE_MEET' | 'BODASCHOOL' | 'OTHER';
export type CalSource = 'MANUAL' | 'CLS_SESSION' | 'INSTANT';
/** BODA 룸 유형 — 1:1 수업(699) vs 1:N 그룹 수업(881). @see FIX-260724 */
export type CalBodaRoomType = 'ONE_TO_ONE' | 'ONE_TO_MANY';

@Entity('amb_acm_cal_event')
@Index('idx_acm_cal_evt_ent_range', ['entId', 'startAt'], { where: 'deleted_at IS NULL' })
@Index('idx_acm_cal_evt_owner_range', ['entId', 'ownerUserId', 'startAt'], { where: 'deleted_at IS NULL' })
export class CalEventTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'evt_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'evt_owner_user_id', type: 'uuid' })
  ownerUserId!: string;

  @Column({ name: 'evt_category', type: 'varchar', length: 20, default: 'CLASS' })
  category!: CalCategory;

  @Column({ name: 'evt_title', type: 'varchar', length: 200 })
  title!: string;

  @Column({ name: 'evt_description', type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'evt_start_at', type: 'timestamptz' })
  startAt!: Date;

  @Column({ name: 'evt_end_at', type: 'timestamptz' })
  endAt!: Date;

  @Column({ name: 'evt_all_day', type: 'boolean', default: false })
  allDay!: boolean;

  @Column({ name: 'evt_location_text', type: 'varchar', length: 200, nullable: true })
  locationText?: string | null;

  @Column({ name: 'evt_meeting_provider', type: 'varchar', length: 20, default: 'NONE' })
  meetingProvider!: CalMeetingProvider;

  @Column({ name: 'evt_meeting_url', type: 'varchar', length: 500, nullable: true })
  meetingUrl?: string | null;

  /**
   * BODASCHOOL 룸 유형 — 운영자가 수업일정 등록 시 1:1 / 1:N 선택. 룸 발급 시
   * 이 값으로 roomCode(1:1=defaultRoomCode / 1:N=groupRoomCode)를 고른다.
   * @see FIX-260724
   */
  @Column({ name: 'evt_boda_room_type', type: 'varchar', length: 12, default: 'ONE_TO_ONE' })
  bodaRoomType!: CalBodaRoomType;

  @Column({ name: 'evt_cls_id', type: 'uuid', nullable: true })
  clsId?: string | null;

  /**
   * REQ-260630 — 담당자 강사. Separate from `ownerUserId` (작성자) and
   * the `amb_acm_cal_invitee` rows (참석자). FK ON DELETE SET NULL.
   */
  @Column({ name: 'evt_assignee_tch_id', type: 'uuid', nullable: true })
  assigneeTchId?: string | null;

  @Column({ name: 'evt_source', type: 'varchar', length: 20, default: 'MANUAL' })
  source!: CalSource;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
