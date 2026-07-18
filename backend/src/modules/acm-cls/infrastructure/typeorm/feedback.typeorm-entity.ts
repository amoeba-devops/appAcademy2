import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type FbkStatus = 'DRAFT' | 'SUBMITTED' | 'DELIVERED_TO_PARENT';

@Entity('amb_acm_cls_feedbacks')
@Index('idx_acm_cls_fbk_ent_status_idx', ['entId', 'status'])
export class FeedbackTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'fbk_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'ses_id', type: 'uuid' })
  sesId!: string;

  @Column({ name: 'fbk_student_user_id', type: 'uuid' })
  studentUserId!: string;

  @Column({ name: 'fbk_progress', type: 'text', nullable: true })
  progress?: string | null;

  @Column({ name: 'fbk_feedback', type: 'text', nullable: true })
  feedback?: string | null;

  @Column({ name: 'fbk_homework', type: 'text', nullable: true })
  homework?: string | null;

  @Column({ name: 'fbk_weakness_dev', type: 'text', nullable: true })
  weaknessDev?: string | null;

  @Column({ name: 'fbk_academic_plan', type: 'text', nullable: true })
  academicPlan?: string | null;

  @Column({ name: 'fbk_written_at', type: 'timestamptz', nullable: true })
  writtenAt?: Date | null;

  @Column({ name: 'fbk_written_by', type: 'uuid', nullable: true })
  writtenBy?: string | null;

  @Column({ name: 'fbk_status', type: 'varchar', length: 25, default: 'DRAFT' })
  status!: FbkStatus;

  @Column({ name: 'fbk_sla_breached', type: 'boolean', default: false })
  slaBreached!: boolean;

  @Column({
    name: 'fbk_delivered_to_parent_at',
    type: 'timestamptz',
    nullable: true,
  })
  deliveredToParentAt?: Date | null;

  @Column({ name: 'fbk_gcal_synced_at', type: 'timestamptz', nullable: true })
  gcalSyncedAt?: Date | null;

  @Column({ name: 'fbk_created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'fbk_updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'fbk_deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
