import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
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

// ── MAP test (1:1) ──────────────────────────────────────────────────────
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

  @ApiPropertyOptional({ enum: MAP_SCHEDULE_STATUSES })
  @IsOptional()
  @IsEnum(MAP_SCHEDULE_STATUSES)
  scheduledStatus?: MapScheduleStatus;

  /** F-13 — NWEA range 100-300 */
  @ApiPropertyOptional({ minimum: 100, maximum: 300 })
  @IsOptional() @IsInt() @Min(100) @Max(300)
  scoreReading?: number;

  @ApiPropertyOptional({ minimum: 100, maximum: 300 })
  @IsOptional() @IsInt() @Min(100) @Max(300)
  scoreMath?: number;

  @ApiPropertyOptional({ minimum: 100, maximum: 300 })
  @IsOptional() @IsInt() @Min(100) @Max(300)
  scoreLanguage?: number;
}

// ── Trial class (1:N) ───────────────────────────────────────────────────
export class CreateTrialClassDto {
  @ApiProperty() @IsDateString()
  heldAt!: string;

  @ApiPropertyOptional({ enum: FEEDBACK_STATUSES, default: 'PENDING' })
  @IsOptional() @IsEnum(FEEDBACK_STATUSES)
  feedbackStatus?: FeedbackStatus;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000)
  note?: string;
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
