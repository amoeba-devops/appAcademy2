import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
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

export const CLS_SUBJECT_TYPES = [
  'MAP_TEST',
  'SSAT',
  'ISEE',
  'ENGLISH_TEST',
  'SAT',
  'ACT',
  'COMPETITION',
  'WRITING',
  'LANGUAGE_ARTS',
  'MATH',
  'INTL_PREP',
  'DEMO',
  'OTHER',
] as const;
export const CLS_STATUSES = ['PROPOSED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'] as const;
export const CLS_STARTED_FROMS = ['CSL_PIPELINE', 'DIRECT_ENROLLMENT', 'MIGRATION'] as const;
export const CST_CAPACITY_ROLES = ['PRIMARY', 'GROUP_PEER'] as const;
export const REC_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
export const REC_MODES = ['IN_PERSON', 'ONLINE', 'TWO_PERSON_IN_PERSON'] as const;
export const VCF_PROVIDERS = ['GOOGLE_MEET', 'BODASCHOOL'] as const;

// ============================================================================
// Class
// ============================================================================
export class CreateClassStudentDto {
  @ApiProperty() @IsUUID() studentUserId!: string;

  @ApiProperty({ description: 'KRW per hour' })
  @IsInt() @Min(1) @Max(500000)
  hourlyRate!: number;

  @ApiPropertyOptional({ enum: CST_CAPACITY_ROLES, default: 'PRIMARY' })
  @IsOptional() @IsEnum(CST_CAPACITY_ROLES)
  capacityRole?: typeof CST_CAPACITY_ROLES[number];

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  inqId?: string;
}

export class CreateRecurrenceDto {
  @ApiProperty({ enum: REC_DAYS }) @IsEnum(REC_DAYS)
  dayOfWeek!: typeof REC_DAYS[number];

  @ApiProperty({ description: 'HH:mm:ss' })
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/)
  startTime!: string;

  @ApiProperty() @IsInt() @Min(30) @Max(480)
  durationMin!: number;

  @ApiPropertyOptional({ enum: REC_MODES, default: 'ONLINE' })
  @IsOptional() @IsEnum(REC_MODES)
  defaultMode?: typeof REC_MODES[number];

  @ApiPropertyOptional({ description: 'YYYY-MM-DD' })
  @IsOptional() @IsDateString()
  effectiveFrom?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  exceptions?: string[];
}

export class CreateClassDto {
  @ApiPropertyOptional({ enum: CLS_STARTED_FROMS, default: 'DIRECT_ENROLLMENT' })
  @IsOptional() @IsEnum(CLS_STARTED_FROMS)
  startedFrom?: typeof CLS_STARTED_FROMS[number];

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  inqId?: string;

  @ApiProperty({ enum: CLS_SUBJECT_TYPES }) @IsEnum(CLS_SUBJECT_TYPES)
  subjectType!: typeof CLS_SUBJECT_TYPES[number];

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200)
  subjectLabel?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  courseId?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  refGuidelineId?: string;

  @ApiProperty() @IsUUID()
  teacherUserId!: string;

  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean()
  isDemo?: boolean;

  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean()
  isInPersonDefault?: boolean;

  @ApiProperty({ description: 'YYYY-MM-DD' }) @IsDateString()
  startedAt!: string;

  @ApiPropertyOptional({ description: 'YYYY-MM-DD' })
  @IsOptional() @IsDateString()
  endedAt?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000)
  remark?: string;

  @ApiProperty({ type: [CreateClassStudentDto] })
  @IsArray() @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateClassStudentDto)
  students!: CreateClassStudentDto[];

  @ApiProperty({ type: [CreateRecurrenceDto] })
  @IsArray() @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateRecurrenceDto)
  recurrences!: CreateRecurrenceDto[];

  @ApiPropertyOptional({ enum: VCF_PROVIDERS, default: 'GOOGLE_MEET' })
  @IsOptional() @IsEnum(VCF_PROVIDERS)
  videoProvider?: typeof VCF_PROVIDERS[number];

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  videoPersistentLink?: string;
}

export class UpdateClassDto extends PartialType(CreateClassDto) {}

export class ChangeClassStatusDto {
  @ApiProperty({ enum: CLS_STATUSES }) @IsEnum(CLS_STATUSES)
  status!: typeof CLS_STATUSES[number];
}

export class ListClassesQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsEnum(CLS_STATUSES)
  status?: typeof CLS_STATUSES[number];

  @ApiPropertyOptional() @IsOptional() @IsEnum(CLS_SUBJECT_TYPES)
  subjectType?: typeof CLS_SUBJECT_TYPES[number];

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  teacherUserId?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  studentUserId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  limit?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  offset?: string;
}
