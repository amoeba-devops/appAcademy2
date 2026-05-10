import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export const TCH_STATUSES = ['ACTIVE', 'LEAVE', 'RESIGNED'] as const;
export const TCH_EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME'] as const;
export const TCH_ACCOUNT_STATES = ['UNLOCKED', 'LOCKED', 'NO_ACCOUNT'] as const;
export const TCH_SUBJECTS = [
  'MAP',
  'MATH',
  'WRITING',
  'LANGUAGE_ARTS',
  'SSAT',
  'ISEE',
  'INTL_PREP',
  'OTHER',
] as const;

export class CreateTeacherDto {
  @ApiProperty() @IsString() @MaxLength(100)
  tchName!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  tchEnglishName?: string;

  @ApiProperty() @IsEmail() @MaxLength(200)
  tchEmail!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30)
  tchPhone?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  tchBirthDate?: string;

  @ApiPropertyOptional({ enum: TCH_SUBJECTS, isArray: true })
  @IsOptional() @IsArray() @IsIn(TCH_SUBJECTS, { each: true })
  tchSubjects?: typeof TCH_SUBJECTS[number][];

  @ApiPropertyOptional() @IsOptional() @IsString()
  tchMemo?: string;

  @ApiPropertyOptional({ enum: TCH_STATUSES, default: 'ACTIVE' })
  @IsOptional() @IsEnum(TCH_STATUSES)
  tchStatus?: typeof TCH_STATUSES[number];

  // --- REQ-260510: 신규 필드 ---
  @ApiPropertyOptional({ description: '강사여부 (default true)' })
  @IsOptional() @IsBoolean()
  tchIsInstructor?: boolean;

  @ApiPropertyOptional({ enum: TCH_EMPLOYMENT_TYPES, default: 'FULL_TIME' })
  @IsOptional() @IsEnum(TCH_EMPLOYMENT_TYPES)
  tchEmploymentType?: typeof TCH_EMPLOYMENT_TYPES[number];

  @ApiPropertyOptional({ description: '입사일자 (YYYY-MM-DD)' })
  @IsOptional() @IsDateString()
  tchHiredAt?: string;

  @ApiPropertyOptional({ description: '출결번호 (자유 입력, ≤50자)' })
  @IsOptional() @IsString() @MaxLength(50)
  tchAttendanceNo?: string;

  // 옵션: 로그인 계정 동시 생성
  @ApiPropertyOptional({ description: 'true 면 amb_acm_user 계정 생성 (TEACHER role)' })
  @IsOptional() @IsBoolean()
  tchCreateAccount?: boolean;

  @ApiPropertyOptional({ description: '로그인 비밀번호 (tchCreateAccount=true 일 때 필수, ≥8자, 영문+숫자)' })
  @IsOptional() @IsString() @MinLength(8) @MaxLength(120)
  tchPassword?: string;
}

export class UpdateTeacherDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  tchName?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  tchEnglishName?: string;

  @ApiPropertyOptional() @IsOptional() @IsEmail() @MaxLength(200)
  tchEmail?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30)
  tchPhone?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  tchBirthDate?: string;

  @ApiPropertyOptional({ enum: TCH_SUBJECTS, isArray: true })
  @IsOptional() @IsArray() @IsIn(TCH_SUBJECTS, { each: true })
  tchSubjects?: typeof TCH_SUBJECTS[number][];

  @ApiPropertyOptional() @IsOptional() @IsString()
  tchMemo?: string;

  @ApiPropertyOptional({ enum: TCH_STATUSES })
  @IsOptional() @IsEnum(TCH_STATUSES)
  tchStatus?: typeof TCH_STATUSES[number];

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  tchIsInstructor?: boolean;

  @ApiPropertyOptional({ enum: TCH_EMPLOYMENT_TYPES })
  @IsOptional() @IsEnum(TCH_EMPLOYMENT_TYPES)
  tchEmploymentType?: typeof TCH_EMPLOYMENT_TYPES[number];

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  tchHiredAt?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50)
  tchAttendanceNo?: string;
}

export class ResetTeacherPasswordDto {
  @ApiProperty() @IsString() @MinLength(8) @MaxLength(120)
  tchPassword!: string;
}

export class ListTeachersQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: [...TCH_STATUSES, 'ALL'] })
  @IsOptional() @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'INSTRUCTOR | NON_INSTRUCTOR | ALL (default ALL)' })
  @IsOptional() @IsString()
  isInstructor?: string;

  @ApiPropertyOptional({ enum: [...TCH_EMPLOYMENT_TYPES, 'ALL'] })
  @IsOptional() @IsString()
  employmentType?: string;

  @ApiPropertyOptional({ enum: [...TCH_ACCOUNT_STATES, 'ALL'] })
  @IsOptional() @IsString()
  accountState?: string;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  limit?: number;
}
