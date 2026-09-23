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
 * CSL pipeline (acm-req-csl-001 v2.1 §4.1) + ATTENDING(수강중, PLN-260714) + DROPPED.
 */
export type CslStage =
  | 'INTAKE'
  | 'MAP_TEST'
  | 'TRIAL_CLASS'
  | 'ENROLLMENT_COUNSELING'
  | 'PAYMENT'
  | 'CLASS_STARTED'
  | 'ATTENDING'
  | 'DROPPED';

export type InflowType =
  | 'HOMEPAGE'
  | 'KAKAO_CHANNEL'
  | 'PHONE'
  | 'WEB_EXTERNAL';

/** REQ-260903G — external intake source sites (imweb). */
export type SourceSite = 'TPI' | 'TRINITY' | 'SANTACROCE';
export type ApplyType = 'COUNSELING_ONLY' | 'EXAM_ONLY' | 'BOTH';
/** REQ-260921B — 구분: 튜터링 상담 | 맵테스트. */
export const INQUIRY_KINDS = ['TUTORING', 'MAP_TEST'] as const;
export type InquiryKind = (typeof INQUIRY_KINDS)[number];
/** REQ-260921B — 성별 (학생·맵테스트 부속과 동일 코드). */
export const INQUIRY_GENDERS = ['M', 'F'] as const;
export type InquiryGender = (typeof INQUIRY_GENDERS)[number];
/**
 * 신청목적 — 접수 사이트마다 상품 구성이 달라 **사이트별로 분리 유지**한다
 * (요구 260914F). 의미가 비슷해 보여도 합치지 않는다: 합치면 사이트별 상품
 * 통계가 불가능해진다.
 *
 * `inq_apply_purpose` 는 TEXT(콤마 구분, CHECK 제약 없음 — 마이그레이션 120)
 * 이라 코드를 늘려도 스키마 변경이 필요 없다.
 */
export type ApplyPurpose =
  // TPI (tpi.co.kr/contact2)
  | 'MAP_TEST_TUTORING'
  | 'ISEE_TUTORING'
  | 'INTL_SCHOOL_PREP'
  | 'GPA_MGMT'
  | 'ADVANCED_COURSES'
  // TRINITY (trinityacademy.kr/contact2)
  | 'TRI_INTL_ACCREDITED'
  | 'TRI_INTL_UNACCREDITED'
  | 'TRI_FOREIGN_SCHOOL'
  | 'TRI_BOARDING_PREP'
  | 'TRI_ALL_IN_ONE'
  // SANTACROCE (santacroce.co.kr/consult)
  | 'SAN_EDU_AGENT'
  | 'SAN_US_UK_ADMISSIONS'
  | 'SAN_TOP_BOARDING'
  | 'SAN_TOP_JUNIOR_BOARDING'
  | 'SAN_PREMIUM_GUARDIAN'
  | 'SAN_INTL_CONSULTING';
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

  @Column({ name: 'inq_english_name_encrypted', type: 'bytea', nullable: true })
  englishNameEncrypted?: Buffer | null;
  @Column({ name: 'inq_english_name_iv', type: 'bytea', nullable: true })
  englishNameIv?: Buffer | null;
  @Column({ name: 'inq_english_name_auth_tag', type: 'bytea', nullable: true })
  englishNameAuthTag?: Buffer | null;

  /** F-05 — encrypted phone + status enum */
  @Column({ name: 'inq_phone_encrypted', type: 'bytea', nullable: true })
  phoneEncrypted?: Buffer | null;
  @Column({ name: 'inq_phone_iv', type: 'bytea', nullable: true })
  phoneIv?: Buffer | null;
  @Column({ name: 'inq_phone_auth_tag', type: 'bytea', nullable: true })
  phoneAuthTag?: Buffer | null;
  @Column({
    name: 'inq_phone_status',
    type: 'varchar',
    length: 16,
    default: 'UNKNOWN',
  })
  phoneStatus!: PhoneStatus;

  /** REQ-260511 — encrypted parent name (optional) */
  @Column({ name: 'inq_parent_name_encrypted', type: 'bytea', nullable: true })
  parentNameEncrypted?: Buffer | null;
  @Column({ name: 'inq_parent_name_iv', type: 'bytea', nullable: true })
  parentNameIv?: Buffer | null;
  @Column({ name: 'inq_parent_name_auth_tag', type: 'bytea', nullable: true })
  parentNameAuthTag?: Buffer | null;

  /** 요구 260914E — 학부모 이메일 (외부 접수 폼에서 연락처 분리). */
  @Column({ name: 'inq_parent_email_encrypted', type: 'bytea', nullable: true })
  parentEmailEncrypted?: Buffer | null;
  @Column({ name: 'inq_parent_email_iv', type: 'bytea', nullable: true })
  parentEmailIv?: Buffer | null;
  @Column({ name: 'inq_parent_email_auth_tag', type: 'bytea', nullable: true })
  parentEmailAuthTag?: Buffer | null;

  /** F-06 */
  @Column({ name: 'inq_inflow_type', type: 'varchar', length: 20 })
  inflowType!: InflowType;

  /** REQ-260903G — external intake source site code (WEB_EXTERNAL only) */
  @Column({
    name: 'inq_source_site',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  sourceSite?: SourceSite | null;

  /** PLN-260914B — operator-assigned site for dashboard attribution (overrides sourceSite) */
  @Column({
    name: 'inq_site_override',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  siteOverride?: SourceSite | null;

  /** F-07 — Q-CSL-009 */
  @Column({ name: 'inq_apply_type', type: 'varchar', length: 20 })
  applyType!: ApplyType;

  /** F-08 — comma-separated list of ApplyPurpose values (multi-select) */
  @Column({ name: 'inq_apply_purpose', type: 'text', nullable: true })
  applyPurpose?: string | null;
  @Column({ name: 'inq_apply_purpose_other', type: 'text', nullable: true })
  applyPurposeOther?: string | null;

  /** F-09 */
  @Column({
    name: 'inq_consult_done',
    type: 'varchar',
    length: 8,
    nullable: true,
  })
  consultDone?: YesNo | null;

  /** School link (existing master) or freetext fallback */
  @Column({ name: 'school_id', type: 'uuid', nullable: true })
  schoolId?: string | null;
  @Column({
    name: 'school_freetext',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  schoolFreetext?: string | null;
  /** REQ-260921B — 자유 입력(예: 중2, G10, 예비고1). 10→40자 (마이그레이션 1016). */
  @Column({ name: 'grade', type: 'varchar', length: 40, nullable: true })
  grade?: string | null;

  /** REQ-260921B — 구분. 웹 /test2 접수·부속 행 보유 건은 MAP_TEST. */
  @Column({
    name: 'inq_kind',
    type: 'varchar',
    length: 20,
    default: 'TUTORING',
  })
  kind!: InquiryKind;
  /** REQ-260921B — 생년월일 (YYYY-MM-DD). 맵테스트 부속 mpa_birthdate 와 동기. */
  @Column({ name: 'inq_birthdate', type: 'date', nullable: true })
  birthdate?: string | null;
  /** REQ-260921B — 성별 M|F. 맵테스트 부속 mpa_gender 와 동기. */
  @Column({ name: 'inq_gender', type: 'varchar', length: 10, nullable: true })
  gender?: InquiryGender | null;

  /** 6-stage state machine */
  @Column({
    name: 'inq_current_stage',
    type: 'varchar',
    length: 32,
    default: 'INTAKE',
  })
  currentStage!: CslStage;
  @Column({
    name: 'inq_previous_stage',
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  previousStage?: CslStage | null;

  /** Ownership / lifecycle */
  @Column({ name: 'advisor_id', type: 'uuid', nullable: true })
  advisorId?: string | null;
  @Column({
    name: 'channel_legacy',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  channelLegacy?: string | null;
  @Column({ name: 'enrolled_at', type: 'timestamptz', nullable: true })
  enrolledAt?: Date | null;

  /** PLN-260706 — STD student auto-registered on CLASS_STARTED (idempotency link). */
  @Column({ name: 'inq_std_id', type: 'uuid', nullable: true })
  stdId?: string | null;
  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
