import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export type CgdExamType =
  | 'MAP_TEST'
  | 'SSAT'
  | 'ISEE'
  | 'WRITING_COMP'
  | 'SUMMER_CAMP'
  | 'JUNIOR_BOARDING'
  | 'BOARDING'
  | 'INTL_SCHOOL_APP'
  | 'OTHER';

export type CgdDataStatus = 'COMPLETE' | 'PARTIAL' | 'PLACEHOLDER';

export interface CgdWorkflowStep {
  step_num: number;
  role:
    | 'ADVISOR'
    | 'TEAM_LEAD'
    | 'TEACHER'
    | 'SENIOR_MANAGER'
    | 'ADMIN'
    | 'OTHER';
  description: string;
}

@Entity('amb_acm_ref_class_guidelines')
@Index('idx_acm_ref_cgd_ent_examtype', ['entId', 'examType'])
export class ClassGuidelineTypeormEntity {
  @PrimaryColumn({ name: 'cgd_id', type: 'uuid' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'cgd_code', type: 'varchar', length: 50 })
  code!: string;

  @Column({ name: 'cgd_exam_type', type: 'varchar', length: 30 })
  examType!: CgdExamType;

  @Column({ name: 'cgd_label_kr', type: 'varchar', length: 200 })
  labelKr!: string;

  @Column({ name: 'cgd_label_en', type: 'varchar', length: 200, nullable: true })
  labelEn?: string | null;

  @Column({ name: 'cgd_workflow_steps', type: 'jsonb', nullable: true })
  workflowSteps?: CgdWorkflowStep[] | null;

  @Column({ name: 'cgd_remark', type: 'text', nullable: true })
  remark?: string | null;

  @Column({
    name: 'cgd_data_status',
    type: 'varchar',
    length: 20,
    default: 'PLACEHOLDER',
  })
  dataStatus!: CgdDataStatus;

  @Column({ name: 'cgd_version_no', type: 'int', default: 1 })
  versionNo!: number;

  @Column({ name: 'cgd_effective_from', type: 'date' })
  effectiveFrom!: string;

  @Column({ name: 'cgd_effective_to', type: 'date', nullable: true })
  effectiveTo?: string | null;

  @Column({ name: 'cgd_supersedes_id', type: 'uuid', nullable: true })
  supersedesId?: string | null;

  @Column({ name: 'cgd_last_reviewed_at', type: 'timestamptz', nullable: true })
  lastReviewedAt?: Date | null;

  @Column({ name: 'cgd_last_reviewed_by', type: 'uuid', nullable: true })
  lastReviewedBy?: string | null;

  @CreateDateColumn({ name: 'cgd_created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'cgd_updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'cgd_deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
