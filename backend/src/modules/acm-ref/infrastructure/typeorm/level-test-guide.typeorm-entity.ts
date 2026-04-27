import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export type LvlExamType = 'ISEE_LEVEL_TEST' | 'SSAT_LEVEL_TEST' | 'OTHER';
export type LvlGradeBasis = 'TARGET_GRADE' | 'CURRENT_GRADE';
export type LvlResourceType = 'DRIVE_FOLDER' | 'EXTERNAL_LINK' | 'INTERNAL_DOC';

export interface LvlProcedureStep {
  step_num: number;
  description: string;
}

@Entity('amb_acm_ref_level_test_guides')
@Index('idx_acm_ref_lvl_ent_examtype', ['entId', 'examType'])
export class LevelTestGuideTypeormEntity {
  @PrimaryColumn({ name: 'lvl_id', type: 'uuid' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'lvl_exam_type', type: 'varchar', length: 30 })
  examType!: LvlExamType;

  @Column({ name: 'lvl_grade_basis', type: 'varchar', length: 20 })
  gradeBasis!: LvlGradeBasis;

  @Column({ name: 'lvl_assignment_rule_text', type: 'text', nullable: true })
  assignmentRuleText?: string | null;

  @Column({ name: 'lvl_resource_url', type: 'varchar', length: 500, nullable: true })
  resourceUrl?: string | null;

  @Column({
    name: 'lvl_resource_type',
    type: 'varchar',
    length: 20,
    default: 'EXTERNAL_LINK',
  })
  resourceType!: LvlResourceType;

  @Column({ name: 'lvl_resource_note', type: 'text', nullable: true })
  resourceNote?: string | null;

  @Column({ name: 'lvl_procedure_steps', type: 'jsonb', nullable: true })
  procedureSteps?: LvlProcedureStep[] | null;

  @Column({ name: 'lvl_default_duration_min', type: 'int', nullable: true })
  defaultDurationMin?: number | null;

  @Column({ name: 'lvl_version_no', type: 'int', default: 1 })
  versionNo!: number;

  @Column({ name: 'lvl_effective_from', type: 'date' })
  effectiveFrom!: string;

  @Column({ name: 'lvl_effective_to', type: 'date', nullable: true })
  effectiveTo?: string | null;

  @Column({ name: 'lvl_supersedes_id', type: 'uuid', nullable: true })
  supersedesId?: string | null;

  @Column({ name: 'lvl_last_reviewed_at', type: 'timestamptz', nullable: true })
  lastReviewedAt?: Date | null;

  @Column({ name: 'lvl_last_reviewed_by', type: 'uuid', nullable: true })
  lastReviewedBy?: string | null;

  @CreateDateColumn({ name: 'lvl_created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'lvl_updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'lvl_deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
