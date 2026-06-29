import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export type MapFeeStatus = 'PAID' | 'UNPAID' | 'WAIVED';
export type MapWaiverReason =
  | 'RETAKE_WITHIN_90D'
  | 'TRIAL_PROMOTION'
  | 'SISTER_ACADEMY_TRANSFER'
  | 'OTHER';
/**
 * @deprecated DSN-260629 §6 — replaced by LevelTestStatus.
 * Legacy values mapped in sql/acm/987: SCHEDULED→PENDING, TAKEN→COMPLETED,
 * NOT_TAKING→NOT_HELD, RESCHEDULED→PENDING.
 */
export type MapScheduleStatus = 'SCHEDULED' | 'TAKEN' | 'NOT_TAKING' | 'RESCHEDULED';

/**
 * DSN-260629 §6.3 — 3-state level-test status. Shared column with the
 * deprecated `MapScheduleStatus` (legacy values migrated by sql/acm/987).
 */
export type LevelTestStatus = 'PENDING' | 'COMPLETED' | 'NOT_HELD';

/** REQ-260626 FR-CSL-112 — generalized level test. Q-CSL-110: enum unchanged, UI label only. */
export type LevelTestType =
  | 'MAP'
  | 'ISEE'
  | 'SSAT'
  | 'DUOLINGO'
  | 'TOEFL'
  | 'TOEFL_JR'
  | 'OTHER';

/**
 * MAP test sub-table (1:1 with inquiry; F-10 ~ F-13 + waiver scaffolding).
 * @see acm-req-csl-001 v2.1 §3.2.4 / §3.2.7
 */
@Entity('amb_acm_csl_map_test')
@Index('idx_acm_csl_mpt_ent', ['entId'])
export class MapTestTypeormEntity {
  @PrimaryColumn({ name: 'mpt_id', type: 'uuid' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  @Column({ name: 'inq_id', type: 'uuid' })
  inqId!: string;

  /** F-10 */
  @Column({ name: 'mpt_has_prior_score', type: 'boolean', nullable: true })
  hasPriorScore?: boolean | null;

  /** F-11 */
  @Column({ name: 'mpt_fee_status', type: 'varchar', length: 16, nullable: true })
  feeStatus?: MapFeeStatus | null;
  @Column({ name: 'mpt_waiver_reason', type: 'varchar', length: 40, nullable: true })
  waiverReason?: MapWaiverReason | null;
  @Column({ name: 'mpt_waiver_approver_id', type: 'uuid', nullable: true })
  waiverApproverId?: string | null;
  @Column({ name: 'mpt_waiver_approved_at', type: 'timestamptz', nullable: true })
  waiverApprovedAt?: Date | null;
  @Column({ name: 'mpt_waiver_note', type: 'text', nullable: true })
  waiverNote?: string | null;

  /** F-12 */
  @Column({ name: 'mpt_scheduled_at', type: 'date', nullable: true })
  scheduledAt?: string | null;
  /**
   * @deprecated REQ-260626 FR-CSL-107 — kept for back-compat; new writes
   * removed in this revision. Phase-7 candidate for drop.
   */
  @Column({ name: 'mpt_scheduled_status', type: 'varchar', length: 16, nullable: true })
  scheduledStatus?: LevelTestStatus | null;

  /** F-13 — MAP score range 100~350 (NWEA per "시험별 점수표"; was previously documented 100-300). */
  @Column({ name: 'mpt_score_reading', type: 'int', nullable: true })
  scoreReading?: number | null;
  @Column({ name: 'mpt_score_math', type: 'int', nullable: true })
  scoreMath?: number | null;
  @Column({ name: 'mpt_score_language', type: 'int', nullable: true })
  scoreLanguage?: number | null;

  // ── REQ-260626 (DSN §3.2 ALTER) ─────────────────────────────────────────

  /** FR-CSL-112 — level test type (default 'MAP' on existing rows). */
  @Column({ name: 'mpt_test_type', type: 'varchar', length: 20, default: 'MAP' })
  testType!: LevelTestType;

  /** FR-CSL-112 — freetext when testType = OTHER. */
  @Column({ name: 'mpt_test_type_other', type: 'varchar', length: 100, nullable: true })
  testTypeOther?: string | null;

  /** FR-CSL-113 — 30-min granularity scheduled time (paired with scheduledAt). */
  @Column({ name: 'mpt_scheduled_time', type: 'time', nullable: true })
  scheduledTime?: string | null;

  /** FR-CSL-114 — CAL event link via meetKey csl:{inq}:LVT. */
  @Column({ name: 'mpt_cal_event_id', type: 'uuid', nullable: true })
  calEventId?: string | null;

  /**
   * DSN-260629 §6 — 시험별 학원측 시간조율 담당강사 (FK amb_acm_tch_teacher).
   * CAL invitee 자동 추가. 데모수업의 `tcl_teacher_id` 와는 별도 — 본
   * 컬럼은 레벨테스트 일정 조율 책임자.
   */
  @Column({ name: 'mpt_teacher_id', type: 'uuid', nullable: true })
  teacherId?: string | null;

  /**
   * FR-CSL-115 / DSN §5.6 — non-MAP scores live here as JSONB
   * (ISEE/SSAT/DUOLINGO/TOEFL/TOEFL_JR/OTHER). Shape per DSN §5.6.
   */
  @Column({ name: 'mpt_score_detail', type: 'jsonb', nullable: true })
  scoreDetail?: unknown | null;

  /**
   * DSN-260629 §4.1 — INTAKE 단계 운영자가 받은 self-report 이전 점수.
   * 2단계 결과 점수 (`scoreDetail`) 와 의미가 다르므로 별도 컬럼.
   * Shape: { iseeIntake?: {verbal, reading, quantitative, mathematics},
   *          priorAdvanced?: {testName, scores: {...}} }
   */
  @Column({ name: 'mpt_prior_scores_detail', type: 'jsonb', nullable: true })
  priorScoresDetail?: Record<string, unknown> | null;

  /** Q-CSL-111 — result entry is admin-only; actor recorded for audit. */
  @Column({ name: 'mpt_result_entered_by', type: 'uuid', nullable: true })
  resultEnteredBy?: string | null;
  @Column({ name: 'mpt_result_entered_at', type: 'timestamptz', nullable: true })
  resultEnteredAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
