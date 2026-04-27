import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type SesStatus =
  | 'SCHEDULED'
  | 'HELD'
  | 'CANCELLED'
  | 'RESCHEDULED'
  | 'NO_SHOW'
  | 'MAKEUP_REPLACEMENT';
export type SesMode = 'IN_PERSON' | 'ONLINE' | 'TWO_PERSON_IN_PERSON' | 'HYBRID';
export type SesCancelReason =
  | 'STUDENT_ABSENCE'
  | 'STUDENT_ILLNESS'
  | 'TEACHER_ABSENCE'
  | 'TEACHER_BUSINESS_TRIP'
  | 'TEACHER_CONSULTING_PREP'
  | 'STUDENT_DAY_OF_CANCEL'
  | 'FAMILY_TRAVEL'
  | 'HOLIDAY'
  | 'OTHER';
export type SesCancelDisposition = 'MAKEUP_PLANNED' | 'CARRYOVER_TO_NEXT_MONTH' | 'NO_MAKEUP';
export type SesVideoProvider = 'GOOGLE_MEET' | 'BODASCHOOL' | 'NONE';
export type SesGcalPushStatus = 'NOT_REQUESTED' | 'PUSHED' | 'FAILED' | 'OUTDATED';

@Entity('amb_acm_cls_sessions')
@Index('idx_acm_cls_ses_cls_sched_idx', ['clsId', 'scheduledAt'])
export class SessionTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'ses_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'cls_id', type: 'uuid' })
  clsId!: string;

  @Column({ name: 'ses_seq_no', type: 'int' })
  seqNo!: number;

  @Column({ name: 'ses_scheduled_at', type: 'timestamptz' })
  scheduledAt!: Date;

  @Column({ name: 'ses_duration_min', type: 'int' })
  durationMin!: number;

  @Column({ name: 'ses_held_at', type: 'timestamptz', nullable: true })
  heldAt?: Date | null;

  @Column({ name: 'ses_actual_minutes', type: 'int', nullable: true })
  actualMinutes?: number | null;

  @Column({ name: 'ses_status', type: 'varchar', length: 25, default: 'SCHEDULED' })
  status!: SesStatus;

  @Column({ name: 'ses_mode', type: 'varchar', length: 25, default: 'ONLINE' })
  mode!: SesMode;

  @Column({ name: 'ses_cancel_reason', type: 'varchar', length: 35, nullable: true })
  cancelReason?: SesCancelReason | null;

  @Column({ name: 'ses_cancel_note', type: 'text', nullable: true })
  cancelNote?: string | null;

  @Column({ name: 'ses_cancelled_by', type: 'uuid', nullable: true })
  cancelledBy?: string | null;

  @Column({ name: 'ses_cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt?: Date | null;

  @Column({ name: 'ses_cancel_disposition', type: 'varchar', length: 30, nullable: true })
  cancelDisposition?: SesCancelDisposition | null;

  @Column({ name: 'ses_is_makeup', type: 'boolean', default: false })
  isMakeup!: boolean;

  @Column({ name: 'ses_replaces_ses_id', type: 'uuid', nullable: true })
  replacesSesId?: string | null;

  @Column({ name: 'ses_video_provider', type: 'varchar', length: 15, default: 'NONE' })
  videoProvider!: SesVideoProvider;

  @Column({ name: 'ses_video_url', type: 'varchar', length: 500, nullable: true })
  videoUrl?: string | null;

  @Column({ name: 'ses_video_link_sent_at', type: 'timestamptz', nullable: true })
  videoLinkSentAt?: Date | null;

  @Column({ name: 'ses_gcal_event_id', type: 'varchar', length: 200, nullable: true })
  gcalEventId?: string | null;

  @Column({ name: 'ses_gcal_pushed_at', type: 'timestamptz', nullable: true })
  gcalPushedAt?: Date | null;

  @Column({ name: 'ses_gcal_push_status', type: 'varchar', length: 15, default: 'NOT_REQUESTED' })
  gcalPushStatus!: SesGcalPushStatus;

  @Column({ name: 'ses_modification_count', type: 'int', default: 0 })
  modificationCount!: number;

  @Column({ name: 'ses_created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'ses_updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'ses_deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
