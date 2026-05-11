import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * 6-stage CSL pipeline (acm-req-csl-001 v2.1 §4.1) + DROPPED.
 */
export type CslStage =
  | 'INTAKE'
  | 'MAP_TEST'
  | 'TRIAL_CLASS'
  | 'ENROLLMENT_COUNSELING'
  | 'PAYMENT'
  | 'CLASS_STARTED'
  | 'DROPPED';

export type InflowType = 'HOMEPAGE' | 'KAKAO_CHANNEL' | 'PHONE';
export type ApplyType = 'COUNSELING_ONLY' | 'EXAM_ONLY' | 'BOTH';
export type ApplyPurpose =
  | 'MAP_TEST_TUTORING'
  | 'ISEE_TUTORING'
  | 'INTL_SCHOOL_PREP'
  | 'GPA_MGMT'
  | 'ADVANCED_COURSES';
export type PhoneStatus = 'PROVIDED' | 'DECLINED' | 'UNKNOWN';
export type YesNo = 'YES' | 'NO';

/**
 * Main inquiry table — fields F-01 ~ F-09 + meta + current stage.
 * @see acm-req-csl-001 v2.1 §3.1
 */
@Entity('amb_acm_csl_inquiry')
@Index('idx_acm_csl_inq_ent_stage', ['entId', 'currentStage'])
@Index('idx_acm_csl_inq_ent_registered', ['entId', 'registeredAt'])
@Index('idx_acm_csl_inq_advisor', ['entId', 'advisorId'])
export class InquiryTypeormEntity {
  @PrimaryColumn({ name: 'inq_id', type: 'uuid' })
  id!: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId!: string;

  /** F-01 — per-tenant auto-increment, immutable */
  @Column({ name: 'inq_seq_no', type: 'int' })
  seqNo!: number;

  /** F-02 */
  @Column({ name: 'inq_registered_at', type: 'date' })
  registeredAt!: string; // YYYY-MM-DD

  /** F-03 split into date + memo */
  @Column({ name: 'inq_followup_at', type: 'date', nullable: true })
  followupAt?: string | null;
  @Column({ name: 'inq_followup_memo', type: 'text', nullable: true })
  followupMemo?: string | null;

  /** F-04 — encrypted name + anonymous flag */
  @Column({ name: 'inq_name_encrypted', type: 'bytea' })
  nameEncrypted!: Buffer;
  @Column({ name: 'inq_name_iv', type: 'bytea' })
  nameIv!: Buffer;
  @Column({ name: 'inq_name_auth_tag', type: 'bytea' })
  nameAuthTag!: Buffer;
  @Column({ name: 'inq_is_anonymous', type: 'boolean', default: false })
  isAnonymous!: boolean;

  /** F-05 — encrypted phone + status enum */
  @Column({ name: 'inq_phone_encrypted', type: 'bytea', nullable: true })
  phoneEncrypted?: Buffer | null;
  @Column({ name: 'inq_phone_iv', type: 'bytea', nullable: true })
  phoneIv?: Buffer | null;
  @Column({ name: 'inq_phone_auth_tag', type: 'bytea', nullable: true })
  phoneAuthTag?: Buffer | null;
  @Column({ name: 'inq_phone_status', type: 'varchar', length: 16, default: 'UNKNOWN' })
  phoneStatus!: PhoneStatus;

  /** REQ-260511 — encrypted parent name (optional) */
  @Column({ name: 'inq_parent_name_encrypted', type: 'bytea', nullable: true })
  parentNameEncrypted?: Buffer | null;
  @Column({ name: 'inq_parent_name_iv', type: 'bytea', nullable: true })
  parentNameIv?: Buffer | null;
  @Column({ name: 'inq_parent_name_auth_tag', type: 'bytea', nullable: true })
  parentNameAuthTag?: Buffer | null;

  /** F-06 */
  @Column({ name: 'inq_inflow_type', type: 'varchar', length: 20 })
  inflowType!: InflowType;

  /** F-07 — Q-CSL-009 */
  @Column({ name: 'inq_apply_type', type: 'varchar', length: 20 })
  applyType!: ApplyType;

  /** F-08 — comma-separated list of ApplyPurpose values (multi-select) */
  @Column({ name: 'inq_apply_purpose', type: 'text', nullable: true })
  applyPurpose?: string | null;
  @Column({ name: 'inq_apply_purpose_other', type: 'text', nullable: true })
  applyPurposeOther?: string | null;

  /** F-09 */
  @Column({ name: 'inq_consult_done', type: 'varchar', length: 8, nullable: true })
  consultDone?: YesNo | null;

  /** School link (existing master) or freetext fallback */
  @Column({ name: 'school_id', type: 'uuid', nullable: true })
  schoolId?: string | null;
  @Column({ name: 'school_freetext', type: 'varchar', length: 100, nullable: true })
  schoolFreetext?: string | null;
  @Column({ name: 'grade', type: 'varchar', length: 10, nullable: true })
  grade?: string | null;

  /** 6-stage state machine */
  @Column({ name: 'inq_current_stage', type: 'varchar', length: 32, default: 'INTAKE' })
  currentStage!: CslStage;
  @Column({ name: 'inq_previous_stage', type: 'varchar', length: 32, nullable: true })
  previousStage?: CslStage | null;

  /** Ownership / lifecycle */
  @Column({ name: 'advisor_id', type: 'uuid', nullable: true })
  advisorId?: string | null;
  @Column({ name: 'channel_legacy', type: 'varchar', length: 20, nullable: true })
  channelLegacy?: string | null;
  @Column({ name: 'enrolled_at', type: 'timestamptz', nullable: true })
  enrolledAt?: Date | null;
  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
