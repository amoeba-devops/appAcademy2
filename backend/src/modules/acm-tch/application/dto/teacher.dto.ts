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

export const TCH_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
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

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  limit?: number;
}
