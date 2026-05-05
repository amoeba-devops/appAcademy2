import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type DkpComputationStatus = 'FRESH' | 'STALE' | 'RECOMPUTING' | 'FAILED';
export type DkpDataCompleteness = 'COMPLETE' | 'PARTIAL_PENDING_MANUAL' | 'PARTIAL_FUTURE';
export type DkpDayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

@Entity('amb_acm_dsh_daily_kpi')
export class DailyKpiTypeormEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'dkp_id' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'dkp_date', type: 'date' })
  date!: string;

  @Column({ name: 'dkp_year_month', type: 'varchar', length: 7 })
  yearMonth!: string;

  @Column({ name: 'dkp_day_of_month', type: 'int' })
  dayOfMonth!: number;

  @Column({ name: 'dkp_day_of_week', type: 'varchar', length: 3 })
  dayOfWeek!: DkpDayOfWeek;

  @Column({ name: 'dkp_day_of_week_kr', type: 'varchar', length: 2 })
  dayOfWeekKr!: string;

  // Marketing
  @Column({ name: 'dkp_marketing_visitor', type: 'int', nullable: true })
  marketingVisitor?: number | null;

  @Column({ name: 'dkp_marketing_cost', type: 'numeric', precision: 12, scale: 0, nullable: true })
  marketingCost?: string | null;

  @Column({ name: 'dkp_marketing_effect', type: 'int', nullable: true })
  marketingEffect?: number | null;

  // CS
  @Column({ name: 'dkp_cs_counseling', type: 'int', default: 0 })
  csCounseling!: number;
  @Column({ name: 'dkp_cs_apply', type: 'int', default: 0 })
  csApply!: number;
  @Column({ name: 'dkp_cs_beginning', type: 'int', default: 0 })
  csBeginning!: number;
  @Column({ name: 'dkp_cs_missing', type: 'int', default: 0 })
  csMissing!: number;
  @Column({ name: 'dkp_cs_trial_class', type: 'int', default: 0 })
  csTrialClass!: number;
  @Column({ name: 'dkp_cs_complain', type: 'int', default: 0 })
  csComplain!: number;

  // Operating
  @Column({ name: 'dkp_ops_new_st', type: 'int', default: 0 })
  opsNewSt!: number;
  @Column({ name: 'dkp_ops_out_st', type: 'int', default: 0 })
  opsOutSt!: number;
  @Column({ name: 'dkp_ops_count_st', type: 'int', default: 0 })
  opsCountSt!: number;
  @Column({ name: 'dkp_ops_new_tc', type: 'int', default: 0 })
  opsNewTc!: number;
  @Column({ name: 'dkp_ops_out_tc', type: 'int', default: 0 })
  opsOutTc!: number;
  @Column({ name: 'dkp_ops_count_tc', type: 'int', default: 0 })
  opsCountTc!: number;

  // Class
  @Column({ name: 'dkp_class_map_test', type: 'int', default: 0 })
  classMapTest!: number;
  @Column({ name: 'dkp_class_tt_class', type: 'numeric', precision: 5, scale: 1, default: 0 })
  classTtClass!: string;
  @Column({ name: 'dkp_class_student', type: 'int', default: 0 })
  classStudent!: number;
  @Column({ name: 'dkp_class_teacher', type: 'int', default: 0 })
  classTeacher!: number;

  // meta
  @Column({ name: 'dkp_computed_at', type: 'timestamptz', nullable: true })
  computedAt?: Date | null;

  @Column({ name: 'dkp_computation_status', type: 'varchar', length: 20, default: 'STALE' })
  computationStatus!: DkpComputationStatus;

  @Column({ name: 'dkp_data_completeness', type: 'varchar', length: 30, default: 'PARTIAL_PENDING_MANUAL' })
  dataCompleteness!: DkpDataCompleteness;

  @Column({ name: 'dkp_source_versions', type: 'jsonb', nullable: true })
  sourceVersions?: Record<string, unknown> | null;

  @Column({ name: 'dkp_last_recompute_reason', type: 'varchar', length: 100, nullable: true })
  lastRecomputeReason?: string | null;

  @Column({ name: 'dkp_created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'dkp_updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'dkp_manually_overridden', type: 'boolean', default: false })
  manuallyOverridden!: boolean;
}
