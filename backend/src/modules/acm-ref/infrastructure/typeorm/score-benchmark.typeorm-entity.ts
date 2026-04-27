import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export type SbmExamType = 'MAP' | 'ISEE' | 'SSAT';
export type SbmDataStatus = 'COMPLETE' | 'INHERITED_FROM' | 'PLACEHOLDER';

@Entity('amb_acm_ref_score_benchmarks')
@Index('idx_acm_ref_sbm_ent_examtype', ['entId', 'examType'])
export class ScoreBenchmarkTypeormEntity {
  @PrimaryColumn({ name: 'sbm_id', type: 'uuid' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'sbm_code', type: 'varchar', length: 50 })
  code!: string;

  @Column({ name: 'sbm_exam_type', type: 'varchar', length: 10 })
  examType!: SbmExamType;

  @Column({ name: 'sbm_level_label', type: 'varchar', length: 50 })
  levelLabel!: string;

  // numeric -> string in TypeORM
  @Column({ name: 'sbm_map_reading_score', type: 'numeric', precision: 5, scale: 1, nullable: true })
  mapReadingScore?: string | null;

  @Column({ name: 'sbm_map_math_score', type: 'numeric', precision: 5, scale: 1, nullable: true })
  mapMathScore?: string | null;

  @Column({ name: 'sbm_map_no_upper_bound', type: 'boolean', default: false })
  mapNoUpperBound!: boolean;

  @Column({ name: 'sbm_general_pct', type: 'numeric', precision: 5, scale: 2, nullable: true })
  generalPct?: string | null;

  @Column({ name: 'sbm_general_stanine', type: 'varchar', length: 20, nullable: true })
  generalStanine?: string | null;

  @Column({ name: 'sbm_premium_private_pct', type: 'numeric', precision: 5, scale: 2, nullable: true })
  premiumPrivatePct?: string | null;

  @Column({ name: 'sbm_premium_private_stanine', type: 'varchar', length: 20, nullable: true })
  premiumPrivateStanine?: string | null;

  @Column({ name: 'sbm_top_boarding_pct', type: 'numeric', precision: 5, scale: 2, nullable: true })
  topBoardingPct?: string | null;

  @Column({ name: 'sbm_top_boarding_stanine', type: 'varchar', length: 20, nullable: true })
  topBoardingStanine?: string | null;

  @Column({ name: 'sbm_data_status', type: 'varchar', length: 20, default: 'COMPLETE' })
  dataStatus!: SbmDataStatus;

  @Column({ name: 'sbm_inherits_from_sbm_id', type: 'uuid', nullable: true })
  inheritsFromSbmId?: string | null;

  @Column({ name: 'sbm_version_no', type: 'int', default: 1 })
  versionNo!: number;

  @Column({ name: 'sbm_effective_from', type: 'date' })
  effectiveFrom!: string;

  @Column({ name: 'sbm_effective_to', type: 'date', nullable: true })
  effectiveTo?: string | null;

  @Column({ name: 'sbm_supersedes_id', type: 'uuid', nullable: true })
  supersedesId?: string | null;

  @Column({ name: 'sbm_last_reviewed_at', type: 'timestamptz', nullable: true })
  lastReviewedAt?: Date | null;

  @Column({ name: 'sbm_last_reviewed_by', type: 'uuid', nullable: true })
  lastReviewedBy?: string | null;

  @CreateDateColumn({ name: 'sbm_created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'sbm_updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'sbm_deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
