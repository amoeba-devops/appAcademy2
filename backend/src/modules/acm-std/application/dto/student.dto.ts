import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export const STD_STATUSES = ['ACTIVE', 'INACTIVE', 'WITHDRAWN'] as const;
export const STD_GENDERS = ['M', 'F'] as const;

// ============================================================================
// Create
// ============================================================================
export class CreateStudentDto {
  @ApiProperty() @IsString() @MaxLength(100)
  stdName!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  stdEnglishName?: string;

  @ApiPropertyOptional({ enum: STD_GENDERS }) @IsOptional() @IsIn(STD_GENDERS)
  stdGender?: 'M' | 'F';

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  stdBirthDate?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30)
  stdPhone?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  stdResidence?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  stdSchool?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20)
  stdGrade?: string;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(100) @Max(350)
  @Type(() => Number)
  stdMapReading?: number;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(100) @Max(350)
  @Type(() => Number)
  stdMapMath?: number;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(100) @Max(350)
  @Type(() => Number)
  stdMapLanguage?: number;

  @ApiPropertyOptional() @IsOptional() @IsString()
  stdMapNote?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  stdTeacher?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  stdSubject?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  stdCurriculum?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  stdMaterials?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50)
  stdMobility?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20)
  stdGpa?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  stdSsatIseeNote?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  stdSpecialNote?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  stdGoalsNote?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200)
  stdSatisfactionNote?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  stdLastCounselDate?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  stdStartDate?: string;

  @ApiPropertyOptional({ enum: STD_STATUSES, default: 'ACTIVE' })
  @IsOptional() @IsEnum(STD_STATUSES)
  stdStatus?: typeof STD_STATUSES[number];
}

// ============================================================================
// Update — all fields optional
// ============================================================================
export class UpdateStudentDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  stdName?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  stdEnglishName?: string;

  @ApiPropertyOptional({ enum: STD_GENDERS }) @IsOptional() @IsIn(STD_GENDERS)
  stdGender?: 'M' | 'F';

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  stdBirthDate?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30)
  stdPhone?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  stdResidence?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  stdSchool?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20)
  stdGrade?: string;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(100) @Max(350)
  @Type(() => Number)
  stdMapReading?: number;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(100) @Max(350)
  @Type(() => Number)
  stdMapMath?: number;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(100) @Max(350)
  @Type(() => Number)
  stdMapLanguage?: number;

  @ApiPropertyOptional() @IsOptional() @IsString()
  stdMapNote?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  stdTeacher?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  stdSubject?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  stdCurriculum?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  stdMaterials?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50)
  stdMobility?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20)
  stdGpa?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  stdSsatIseeNote?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  stdSpecialNote?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  stdGoalsNote?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200)
  stdSatisfactionNote?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  stdLastCounselDate?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  stdStartDate?: string;

  @ApiPropertyOptional({ enum: STD_STATUSES })
  @IsOptional() @IsEnum(STD_STATUSES)
  stdStatus?: typeof STD_STATUSES[number];
}

// ============================================================================
// Status change
// ============================================================================
export class ChangeStudentStatusDto {
  @ApiProperty({ enum: STD_STATUSES })
  @IsEnum(STD_STATUSES)
  stdStatus!: typeof STD_STATUSES[number];
}

// ============================================================================
// List query
// ============================================================================
export class ListStudentsQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE', 'WITHDRAWN', 'ALL'], default: 'ACTIVE' })
  @IsOptional() @IsString()
  status?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  school?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  grade?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  teacher?: string;

  @ApiPropertyOptional({ default: 1 }) @IsOptional() @IsInt() @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ default: 50 }) @IsOptional() @IsInt() @Min(1) @Max(200)
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({ default: 'name' })
  @IsOptional() @IsIn(['name', 'createdAt'])
  sort?: string;
}
