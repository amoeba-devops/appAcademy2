import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type ClsStartedFrom = 'CSL_PIPELINE' | 'DIRECT_ENROLLMENT' | 'MIGRATION';
export type ClsSubjectType =
  | 'MAP_TEST'
  | 'SSAT'
  | 'ISEE'
  | 'WRITING'
  | 'LANGUAGE_ARTS'
  | 'MATH'
  | 'INTL_PREP'
  | 'DEMO'
  | 'OTHER';
export type ClsStatus = 'PROPOSED' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
export type ClsVisibility = 'ENTITY' | 'CELL' | 'PRIVATE';

@Entity('amb_acm_cls_classes')
@Index('idx_acm_cls_classes_ent_status', ['entId', 'status'])
export class ClassTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'cls_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'cls_code', type: 'varchar', length: 50 })
  code!: string;

  @Column({ name: 'cls_inq_id', type: 'uuid', nullable: true })
  inqId?: string | null;

  @Column({ name: 'cls_started_from', type: 'varchar', length: 20, default: 'DIRECT_ENROLLMENT' })
  startedFrom!: ClsStartedFrom;

  @Column({ name: 'cls_subject_type', type: 'varchar', length: 20 })
  subjectType!: ClsSubjectType;

  @Column({ name: 'cls_subject_label', type: 'varchar', length: 200, nullable: true })
  subjectLabel?: string | null;

  @Column({ name: 'cls_ref_guideline_id', type: 'uuid', nullable: true })
  refGuidelineId?: string | null;

  @Column({ name: 'cls_teacher_user_id', type: 'uuid' })
  teacherUserId!: string;

  @Column({ name: 'cls_is_demo', type: 'boolean', default: false })
  isDemo!: boolean;

  @Column({ name: 'cls_is_group', type: 'boolean', default: false })
  isGroup!: boolean;

  @Column({ name: 'cls_is_in_person_default', type: 'boolean', default: false })
  isInPersonDefault!: boolean;

  @Column({ name: 'cls_status', type: 'varchar', length: 20, default: 'PROPOSED' })
  status!: ClsStatus;

  @Column({ name: 'cls_started_at', type: 'date' })
  startedAt!: string;

  @Column({ name: 'cls_ended_at', type: 'date', nullable: true })
  endedAt?: string | null;

  @Column({ name: 'cls_completed_at', type: 'date', nullable: true })
  completedAt?: string | null;

  @Column({ name: 'cls_visibility', type: 'varchar', length: 20, default: 'ENTITY' })
  visibility!: ClsVisibility;

  @Column({ name: 'cls_remark', type: 'text', nullable: true })
  remark?: string | null;

  @Column({ name: 'cls_created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'cls_updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'cls_deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
