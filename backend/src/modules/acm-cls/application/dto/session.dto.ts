import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const SES_STATUSES = [
  'SCHEDULED',
  'HELD',
  'CANCELLED',
  'RESCHEDULED',
  'NO_SHOW',
  'MAKEUP_REPLACEMENT',
] as const;
export const SES_MODES = ['IN_PERSON', 'ONLINE', 'TWO_PERSON_IN_PERSON', 'HYBRID'] as const;
export const SES_CANCEL_REASONS = [
  'STUDENT_ABSENCE',
  'STUDENT_ILLNESS',
  'TEACHER_ABSENCE',
  'TEACHER_BUSINESS_TRIP',
  'TEACHER_CONSULTING_PREP',
  'STUDENT_DAY_OF_CANCEL',
  'FAMILY_TRAVEL',
  'HOLIDAY',
  'OTHER',
] as const;
export const SES_DISPOSITIONS = [
  'MAKEUP_PLANNED',
  'CARRYOVER_TO_NEXT_MONTH',
  'NO_MAKEUP',
] as const;
export const ATT_STATUSES = [
  'PRESENT',
  'ABSENT_EXCUSED',
  'ABSENT_UNEXCUSED',
  'LATE',
  'LEFT_EARLY',
] as const;
export const FBK_STATUSES = ['DRAFT', 'SUBMITTED', 'DELIVERED_TO_PARENT'] as const;
export const MKP_STATUSES = ['PROPOSED', 'APPROVED', 'COMPLETED', 'CARRIED_OVER', 'REJECTED'] as const;

// ============================================================================
// Session
// ============================================================================
export class CreateSessionDto {
  @ApiProperty() @IsUUID() clsId!: string;

  @ApiProperty({ description: 'ISO 8601 timestamp' })
  @IsDateString() scheduledAt!: string;

  @ApiProperty() @IsInt() @Min(30) @Max(480)
  durationMin!: number;

  @ApiPropertyOptional({ enum: SES_MODES }) @IsOptional() @IsEnum(SES_MODES)
  mode?: typeof SES_MODES[number];
}

export class RescheduleSessionDto {
  @ApiProperty({ description: 'ISO 8601 timestamp' })
  @IsDateString() scheduledAt!: string;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(30) @Max(480)
  durationMin?: number;

  @ApiPropertyOptional({ enum: SES_MODES }) @IsOptional() @IsEnum(SES_MODES)
  mode?: typeof SES_MODES[number];
}

export class CancelSessionDto {
  @ApiProperty({ enum: SES_CANCEL_REASONS }) @IsEnum(SES_CANCEL_REASONS)
  cancelReason!: typeof SES_CANCEL_REASONS[number];

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000)
  cancelNote?: string;

  @ApiPropertyOptional({ enum: SES_DISPOSITIONS })
  @IsOptional() @IsEnum(SES_DISPOSITIONS)
  cancelDisposition?: typeof SES_DISPOSITIONS[number];
}

export class HoldSessionDto {
  @ApiPropertyOptional({ description: 'ISO 8601; defaults to now()' })
  @IsOptional() @IsDateString()
  heldAt?: string;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(480)
  actualMinutes?: number;
}

export class ListSessionsQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID()
  clsId?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  teacherUserId?: string;

  @ApiPropertyOptional({ description: 'YYYY-MM-DD' })
  @IsOptional() @IsDateString() from?: string;

  @ApiPropertyOptional({ description: 'YYYY-MM-DD' })
  @IsOptional() @IsDateString() to?: string;

  @ApiPropertyOptional({ enum: SES_STATUSES })
  @IsOptional() @IsEnum(SES_STATUSES)
  status?: typeof SES_STATUSES[number];
}

// ============================================================================
// Attendance
// ============================================================================
export class AttendanceLineDto {
  @ApiProperty() @IsUUID() cstId!: string;

  @ApiProperty({ enum: ATT_STATUSES }) @IsEnum(ATT_STATUSES)
  status!: typeof ATT_STATUSES[number];

  @ApiProperty() @IsNumber({ maxDecimalPlaces: 1 }) @Min(0) @Max(10)
  billableHours!: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000)
  remark?: string;
}

export class RecordAttendanceDto {
  @ApiPropertyOptional({ description: 'ISO 8601; defaults to now()' })
  @IsOptional() @IsDateString()
  heldAt?: string;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(480)
  actualMinutes?: number;

  @ApiPropertyOptional({ enum: SES_MODES }) @IsOptional() @IsEnum(SES_MODES)
  mode?: typeof SES_MODES[number];

  @ApiProperty({ type: [AttendanceLineDto] })
  @IsArray() @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AttendanceLineDto)
  lines!: AttendanceLineDto[];
}

// ============================================================================
// Feedback
// ============================================================================
export class UpsertFeedbackDto {
  @ApiProperty() @IsUUID() studentUserId!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10000)
  progress?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10000)
  feedback?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10000)
  homework?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10000)
  weaknessDev?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10000)
  academicPlan?: string;

  @ApiPropertyOptional({ enum: FBK_STATUSES, default: 'DRAFT' })
  @IsOptional() @IsEnum(FBK_STATUSES)
  status?: typeof FBK_STATUSES[number];
}

// ============================================================================
// Makeup
// ============================================================================
export class ProposeMakeupDto {
  @ApiProperty() @IsUUID() originalSesId!: string;

  @ApiProperty({ description: 'Proposed makeup datetime, ISO 8601' })
  @IsDateString() makeupScheduledAt!: string;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(30) @Max(480)
  durationMin?: number;

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  substituteTeacherId?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  substitutionApproverId?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  advisorId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000)
  remark?: string;
}

export class ApproveMakeupDto {
  @ApiProperty({ enum: MKP_STATUSES }) @IsEnum(MKP_STATUSES)
  status!: typeof MKP_STATUSES[number];
}

// ============================================================================
// Settlement
// ============================================================================
export class SettlementQueryDto {
  @ApiProperty({ description: 'YYYY-MM' })
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) yearMonth!: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  teacherUserId?: string;
}

export class ConfirmSettlementDto {
  @ApiPropertyOptional({ description: 'Override withholding rate (e.g. 0 for 사업자)' })
  @IsOptional() @IsNumber() @Min(0) @Max(0.5)
  withholdingRate?: number;
}
