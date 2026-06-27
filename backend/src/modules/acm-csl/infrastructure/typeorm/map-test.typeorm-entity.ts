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
/** @deprecated REQ-260626 FR-CSL-107 — no longer written; UI removed. */
export type MapScheduleStatus = 'SCHEDULED' | 'TAKEN' | 'NOT_TAKING' | 'RESCHEDULED';

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
  scheduledStatus?: MapScheduleStatus | null;

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
   * FR-CSL-115 / DSN §5.6 — non-MAP scores live here as JSONB
   * (ISEE/SSAT/DUOLINGO/TOEFL/TOEFL_JR/OTHER). Shape per DSN §5.6.
   */
  @Column({ name: 'mpt_score_detail', type: 'jsonb', nullable: true })
  scoreDetail?: unknown | null;

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
