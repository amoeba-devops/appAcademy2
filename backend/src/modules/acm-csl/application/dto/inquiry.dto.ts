import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import type {
  ApplyPurpose,
  ApplyType,
  CslStage,
  InflowType,
  PhoneStatus,
  YesNo,
} from '../../infrastructure/typeorm/inquiry.typeorm-entity';
import type {
  MapFeeStatus,
  MapScheduleStatus,
  MapWaiverReason,
} from '../../infrastructure/typeorm/map-test.typeorm-entity';
import type { FeedbackStatus } from '../../infrastructure/typeorm/trial-class.typeorm-entity';
import type { NoticeStatus } from '../../infrastructure/typeorm/enrollment.typeorm-entity';
import type { CancellationReasonCode } from '../../infrastructure/typeorm/cancellation.typeorm-entity';

const STAGES: readonly CslStage[] = [
  'INTAKE',
  'MAP_TEST',
  'TRIAL_CLASS',
  'ENROLLMENT_COUNSELING',
  'PAYMENT',
  'CLASS_STARTED',
  'DROPPED',
] as const;
const INFLOW_TYPES: readonly InflowType[] = ['HOMEPAGE', 'KAKAO_CHANNEL', 'PHONE'] as const;
const APPLY_TYPES: readonly ApplyType[] = ['COUNSELING_ONLY', 'EXAM_ONLY', 'BOTH'] as const;
const APPLY_PURPOSES = [
  'MAP_TEST_TUTORING',
  'ISEE_TUTORING',
  'INTL_SCHOOL_PREP',
  'GPA_MGMT',
  'ADVANCED_COURSES',
] as const;
const PHONE_STATUSES: readonly PhoneStatus[] = ['PROVIDED', 'DECLINED', 'UNKNOWN'] as const;
const YES_NO: readonly YesNo[] = ['YES', 'NO'] as const;

const MAP_FEE_STATUSES: readonly MapFeeStatus[] = ['PAID', 'UNPAID', 'WAIVED'] as const;
const MAP_WAIVER_REASONS: readonly MapWaiverReason[] = [
  'RETAKE_WITHIN_90D',
  'TRIAL_PROMOTION',
  'SISTER_ACADEMY_TRANSFER',
  'OTHER',
] as const;
const MAP_SCHEDULE_STATUSES: readonly MapScheduleStatus[] = [
  'SCHEDULED',
  'TAKEN',
  'NOT_TAKING',
  'RESCHEDULED',
] as const;

const FEEDBACK_STATUSES: readonly FeedbackStatus[] = ['SENT', 'PENDING', 'NA'] as const;
const NOTICE_STATUSES: readonly NoticeStatus[] = ['SENT', 'PENDING', 'NA'] as const;
const CANCELLATION_REASON_CODES: readonly CancellationReasonCode[] = [
  'ACADEMY_CANCELLED',
  'STUDENT_ILLNESS',
  'STUDENT_SCHEDULE_CHANGE',
  'PAYMENT_DECLINED',
  'LOST_TO_COMPETITOR',
  'OTHER',
] as const;

// ── Inquiry (INTAKE stage entry) ────────────────────────────────────────
export class CreateInquiryDto {
  /** F-04 — student name (encrypted at rest) */
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(50)
  studentName!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;

  /** F-05 — parent phone (E.164 / KR mobile loose) */
  @ApiPropertyOptional()
  @ValidateIf((o: CreateInquiryDto) => o.phoneStatus === 'PROVIDED' || !!o.parentPhone)
  @IsString()
  @Matches(/^[0-9+\-() ]{7,20}$/)
  parentPhone?: string;

  /** REQ-260511 — parent name (optional, encrypted at rest) */
  @ApiPropertyOptional({ description: 'Parent name (encrypted)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  parentName?: string;

  /** REQ-260511 — school name (optional) */
  @ApiPropertyOptional({ description: 'School name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  schoolName?: string;

  @ApiPropertyOptional({ enum: PHONE_STATUSES, default: 'UNKNOWN' })
  @IsOptional()
  @IsEnum(PHONE_STATUSES)
  phoneStatus?: PhoneStatus;

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  schoolId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  schoolFreetext?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10)
  grade?: string;

  /** F-06 */
  @ApiProperty({ enum: INFLOW_TYPES }) @IsEnum(INFLOW_TYPES)
  inflowType!: InflowType;

  /** F-07 */
  @ApiProperty({ enum: APPLY_TYPES }) @IsEnum(APPLY_TYPES)
  applyType!: ApplyType;

  /** F-08 — multi-select; comma-joined on storage */
  @ApiPropertyOptional({ type: [String], enum: APPLY_PURPOSES })
  @IsOptional()
  @IsArray()
  @IsIn([...APPLY_PURPOSES], { each: true })
  applyPurposes?: string[];

  /** F-09 */
  @ApiPropertyOptional({ enum: YES_NO }) @IsOptional() @IsEnum(YES_NO)
  consultDone?: YesNo;

  /** F-02 — defaults to today on server if omitted */
  @ApiPropertyOptional({ description: 'YYYY-MM-DD; defaults to today' })
  @IsOptional()
  @IsDateString()
  registeredAt?: string;

  /** F-03 */
  @ApiPropertyOptional() @IsOptional() @IsDateString()
  followupAt?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000)
  followupMemo?: string;
}

export class UpdateInquiryDto extends PartialType(CreateInquiryDto) {}

// ── MAP / Level test (1:1) ──────────────────────────────────────────────

/** REQ-260626 FR-CSL-112 — generalized level test types (DSN §5.6). */
const LEVEL_TEST_TYPES = ['MAP', 'ISEE', 'SSAT', 'DUOLINGO', 'TOEFL', 'TOEFL_JR', 'OTHER'] as const;
export type LevelTestType = (typeof LEVEL_TEST_TYPES)[number];

export class UpsertMapTestDto {
  /** F-10 */
  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  hasPriorScore?: boolean;

  /** F-11 */
  @ApiPropertyOptional({ enum: MAP_FEE_STATUSES })
  @IsOptional()
  @IsEnum(MAP_FEE_STATUSES)
  feeStatus?: MapFeeStatus;

  @ApiPropertyOptional({ enum: MAP_WAIVER_REASONS })
  @ValidateIf((o: UpsertMapTestDto) => o.feeStatus === 'WAIVED')
  @IsEnum(MAP_WAIVER_REASONS, { message: 'waiverReason required when feeStatus=WAIVED' })
  waiverReason?: MapWaiverReason;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  waiverNote?: string;

  /** F-12 */
  @ApiPropertyOptional() @IsOptional() @IsDateString()
  scheduledAt?: string;

  /**
   * @deprecated REQ-260626 FR-CSL-107 — scheduling status field removed from UI.
   * DTO field kept temporarily so legacy clients don't break.
   */
  @ApiPropertyOptional({ enum: MAP_SCHEDULE_STATUSES })
  @IsOptional()
  @IsEnum(MAP_SCHEDULE_STATUSES)
  scheduledStatus?: MapScheduleStatus;

  /**
   * F-13 — MAP score range **100~350** per "시험별 점수표" (DSN §5.6).
   * Previously documented as 100~300; DB CHECK now matches 350 ceiling
   * (sql/acm/985 §1). Non-MAP test scores live in `scoreDetail` JSONB.
   */
  @ApiPropertyOptional({ minimum: 100, maximum: 350 })
  @IsOptional() @IsInt() @Min(100) @Max(350)
  scoreReading?: number;

  @ApiPropertyOptional({ minimum: 100, maximum: 350 })
  @IsOptional() @IsInt() @Min(100) @Max(350)
  scoreMath?: number;

  @ApiPropertyOptional({ minimum: 100, maximum: 350 })
  @IsOptional() @IsInt() @Min(100) @Max(350)
  scoreLanguage?: number;

  // ── REQ-260626 (DSN §3.2 + §5.6) ───────────────────────────────────────

  /** FR-CSL-112 — test type. Defaults to MAP on first write (matches DB default). */
  @ApiPropertyOptional({ enum: LEVEL_TEST_TYPES })
  @IsOptional() @IsEnum(LEVEL_TEST_TYPES)
  testType?: LevelTestType;

  /** FR-CSL-112 — required only when testType=OTHER. */
  @ApiPropertyOptional()
  @ValidateIf((o: UpsertMapTestDto) => o.testType === 'OTHER')
  @IsString({ message: 'testTypeOther required when testType=OTHER' })
  @MaxLength(100)
  testTypeOther?: string;

  /**
   * FR-CSL-113 — 30-min granularity. Format: 'HH:MM' or 'HH:MM:SS' (TIME).
   * Server-side validation: minutes ∈ {00, 30}. DB CHECK enforces too.
   */
  @ApiPropertyOptional({ description: '30-min granularity time (HH:MM)' })
  @IsOptional()
  @Matches(/^\d{2}:(00|30)(:\d{2})?$/, {
    message: 'scheduledTime must be HH:MM with 30-min granularity (e.g., 14:00 or 14:30)',
  })
  scheduledTime?: string;

  /**
   * FR-CSL-115 / DSN §5.6 — non-MAP score detail JSONB. Shape depends on
   * testType. MAP uses the dedicated `score{Reading,Math,Language}` columns
   * above. Per-type schema validation runs in {@link validateLevelTestScoreDetail}.
   */
  @ApiPropertyOptional({ description: 'Non-MAP score detail (DSN §5.6 schema by test type)' })
  @IsOptional() @IsObject()
  scoreDetail?: Record<string, unknown>;

  /**
   * DSN-260629 §4.1 — INTAKE 단계 self-report 이전 점수.
   * Validator 는 v1 에선 shape pass-through (operator-discretion 자유입력 허용),
   * 정식 검증은 2단계 LevelTest result 에서.
   */
  @ApiPropertyOptional({ description: 'INTAKE prior self-report scores (DSN-260629 §4.1)' })
  @IsOptional() @IsObject()
  priorScoresDetail?: Record<string, unknown>;
}

/**
 * REQ-260626 FR-CSL-115 / Q-CSL-111 — operator-only result recording.
 * Separates "schedule + intake" (UpsertMapTestDto) from "result entry"
 * so the controller can enforce role guard (STAFF↑) without leaking
 * across other PATCH fields.
 */
export class RecordLevelTestResultDto {
  @ApiProperty({ enum: LEVEL_TEST_TYPES })
  @IsEnum(LEVEL_TEST_TYPES)
  testType!: LevelTestType;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(100) @Max(350)
  scoreReading?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(100) @Max(350)
  scoreMath?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(100) @Max(350)
  scoreLanguage?: number;

  /** Per-type schema validated separately (see validateLevelTestScoreDetail). */
  @ApiPropertyOptional() @IsOptional() @IsObject()
  scoreDetail?: Record<string, unknown>;
}

// ── DSN-260629 §6 — per-test-type level-test schedule + status ──────────

const LEVEL_TEST_STATUSES = ['PENDING', 'COMPLETED', 'NOT_HELD'] as const;
export type LevelTestStatus = (typeof LEVEL_TEST_STATUSES)[number];

/**
 * DSN-260629 §6 — upsert a single per-type level-test row.
 *
 *   PUT /acm/csl/inquiries/:inqId/level-tests/:testType
 *
 * The row is keyed by (inq_id, testType) via uq_acm_csl_mpt_inq_type
 * (sql/acm/987). Empty fields keep the stored value; explicit nulls
 * clear it. Scoring is a separate endpoint (RecordLevelTestResultDto)
 * so the admin gate only wraps result writes.
 */
export class UpsertLevelTestDto {
  /** 30-min granularity scheduled time (HH:MM[:SS]). Reuses UpsertMapTestDto regex. */
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{2}:(00|30)(:\d{2})?$/, {
    message: 'scheduledTime must be HH:MM with 30-min granularity',
  })
  scheduledTime?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  teacherId?: string;

  @ApiPropertyOptional({ enum: LEVEL_TEST_STATUSES })
  @IsOptional() @IsEnum(LEVEL_TEST_STATUSES)
  status?: LevelTestStatus;

  /** For OTHER type only — freetext exam name. */
  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(100)
  testTypeOther?: string;
}

export { LEVEL_TEST_STATUSES };

// ── Trial class / Demo class (1:N) ─────────────────────────────────────
export class CreateTrialClassDto {
  @ApiProperty() @IsDateString()
  heldAt!: string;

  /**
   * @deprecated REQ-260626 FR-CSL-124 — replaced by `completed` + feedback_*
   * columns. DTO field retained for legacy client compatibility (PENDING
   * default is the no-op state).
   */
  @ApiPropertyOptional({ enum: FEEDBACK_STATUSES, default: 'PENDING' })
  @IsOptional() @IsEnum(FEEDBACK_STATUSES)
  feedbackStatus?: FeedbackStatus;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000)
  note?: string;

  // ── REQ-260626 (FR-CSL-122/123) ────────────────────────────────────────

  /** FR-CSL-122 — 30-min granularity time HH:MM[:SS]. */
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{2}:(00|30)(:\d{2})?$/, {
    message: 'heldTime must be HH:MM with 30-min granularity',
  })
  heldTime?: string;

  /** FR-CSL-123 — demo teacher (AMA Client via amb_acm_tch_teacher). */
  @ApiPropertyOptional() @IsOptional() @IsUUID()
  teacherId?: string;
}

/**
 * REQ-260626 FR-CSL-122~125 — partial update for an existing demo class.
 * Each field is independent so the operator can iterate (assign teacher
 * first, mark completed later, schedule edit, …) without re-sending the
 * whole row.
 */
export class UpdateTrialClassDto {
  @ApiPropertyOptional() @IsOptional() @IsDateString()
  heldAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{2}:(00|30)(:\d{2})?$/, {
    message: 'heldTime must be HH:MM with 30-min granularity',
  })
  heldTime?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  teacherId?: string;

  /** FR-CSL-125 — completion flag (replaces deprecated feedbackStatus). */
  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  completed?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000)
  note?: string;

  /** FR-CSL-122 — CAL event link (set by T-08 integration; allowed to clear). */
  @ApiPropertyOptional() @IsOptional() @IsUUID()
  calEventId?: string;
}

/**
 * REQ-260626 FR-CSL-127 — TEACHER writes feedback after the session.
 * Controller enforces the TEACHER role gate (or STAFF↑ for late edits);
 * the service stamps authorId/At from the actor.
 */
export class WriteFeedbackDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(4000)
  body!: string;
}

// ── Enrollment (1:1) ────────────────────────────────────────────────────
export class UpsertEnrollmentDto {
  /** F-16 */
  @ApiPropertyOptional({ enum: NOTICE_STATUSES }) @IsOptional() @IsEnum(NOTICE_STATUSES)
  paymentNoticeStatus?: NoticeStatus;

  /** F-17 */
  @ApiPropertyOptional({ enum: YES_NO }) @IsOptional() @IsEnum(YES_NO)
  counselDone?: YesNo;

  /** F-18 */
  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  applied?: boolean;

  /** F-19 */
  @ApiPropertyOptional({ enum: YES_NO }) @IsOptional() @IsEnum(YES_NO)
  paymentNoticeSent?: YesNo;

  /** F-20 */
  @ApiPropertyOptional({ minimum: 1 }) @IsOptional() @IsInt() @Min(1)
  classMinutes?: number;

  /** F-21 — KRW 0..50,000,000 */
  @ApiPropertyOptional({ minimum: 0, maximum: 50_000_000 })
  @IsOptional() @IsInt() @Min(0) @Max(50_000_000)
  tuitionAmount?: number;

  /** F-22 — BR-CSL-012 (server enforces senior-manager role) */
  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  tuitionPaid?: boolean;

  /** F-23 */
  @ApiPropertyOptional() @IsOptional() @IsDateString()
  classStartedAt?: string;

  /** F-24 */
  @ApiPropertyOptional({ enum: YES_NO }) @IsOptional() @IsEnum(YES_NO)
  classStarted?: YesNo;

  // ── REQ-260626 (FR-CSL-131~135) ────────────────────────────────────────

  /** FR-CSL-131 — operator-recorded counsel memo. */
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000)
  counselMemo?: string;

  /** FR-CSL-132 — course master FK. Mutually exclusive-ish with courseFreetext. */
  @ApiPropertyOptional() @IsOptional() @IsUUID()
  courseId?: string;

  /** FR-CSL-132 — freetext course when no master row exists. */
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  courseFreetext?: string;

  /** FR-CSL-134 — total session count. */
  @ApiPropertyOptional({ minimum: 0 }) @IsOptional() @IsInt() @Min(0)
  sessionCount?: number;

  /** FR-CSL-135 — enrollment date range (DB CHECK end >= start). */
  @ApiPropertyOptional() @IsOptional() @IsDateString()
  startDate?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  endDate?: string;
}

// ── REQ-260626 — Multi-teacher assignment + Payment approval ────────────

/** FR-CSL-136 — assign a teacher to an inquiry (PRIMARY/SECONDARY role). */
export class AssignTeacherDto {
  @ApiProperty() @IsUUID()
  teacherId!: string;

  @ApiPropertyOptional({ enum: ['PRIMARY', 'SECONDARY'], default: 'PRIMARY' })
  @IsOptional() @IsEnum(['PRIMARY', 'SECONDARY'])
  role?: 'PRIMARY' | 'SECONDARY';
}

/**
 * FR-CSL-141 — explicit payment approval endpoint. Distinct from the
 * generic enrollment upsert so the role gate (ADMIN/APP_ADMIN) lives on
 * a single semantic action. method/memo are confirmation metadata only —
 * no online PG (Out-of-Scope per REQ §3.2).
 */
export class ApprovePaymentDto {
  @ApiProperty({ enum: ['CARD', 'BANK_TRANSFER'] })
  @IsEnum(['CARD', 'BANK_TRANSFER'])
  method!: 'CARD' | 'BANK_TRANSFER';

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  memo?: string;
}

// ── REQ-260626 T-06 — Attachment upload ─────────────────────────────────
//
// FIX-260630 — PresignedUploadDto removed. Backend now receives multipart
// uploads directly (FileInterceptor on POST /:inqId/attachments) because
// the previous presigned-PUT scheme couldn't reach MinIO's docker-internal
// hostname from the browser (HTTPS Mixed Content). category + optional
// refId arrive as multipart form fields; the controller validates them
// inline (no class-validator DTO needed).

// ── REQ-260626 — Course master (per-tenant) ─────────────────────────────

export class CreateCourseDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(40)
  code!: string;

  @ApiProperty() @IsString() @MinLength(1) @MaxLength(100)
  name!: string;
}

export class UpdateCourseDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  name?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  isActive?: boolean;
}

// ── Cancellation (1:N append-only) ──────────────────────────────────────
export class CreateCancellationDto {
  @ApiProperty({ enum: CANCELLATION_REASON_CODES })
  @IsEnum(CANCELLATION_REASON_CODES)
  reasonCode!: CancellationReasonCode;

  @ApiPropertyOptional()
  @ValidateIf((o: CreateCancellationDto) => o.reasonCode === 'OTHER')
  @IsString({ message: 'reasonOther required when reasonCode=OTHER' })
  @MaxLength(500)
  reasonOther?: string;
}

// ── Stage transition ────────────────────────────────────────────────────
export class ChangeStageDto {
  @ApiProperty({ enum: STAGES }) @IsEnum(STAGES)
  toStage!: CslStage;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  reason?: string;
}

export {
  STAGES,
  INFLOW_TYPES,
  APPLY_TYPES,
  APPLY_PURPOSES,
  PHONE_STATUSES,
  YES_NO,
  CANCELLATION_REASON_CODES,
};
