import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export const STD_STATUSES = ['ACTIVE', 'INACTIVE', 'WITHDRAWN'] as const;
export const STD_GENDERS = ['M', 'F'] as const;

// ============================================================================
// Parent (guardian) sub-DTO — embedded in student create/update payload
// ============================================================================
export class StudentParentInputDto {
  /** par_id — when present, link existing parent (optionally update fields). */
  @ApiPropertyOptional() @IsOptional() @IsUUID()
  parId?: string;

  @ApiProperty() @IsString() @MaxLength(100)
  parName!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20)
  parRelation?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30)
  parPhone?: string;

  @ApiPropertyOptional() @IsOptional() @IsEmail() @MaxLength(200)
  parEmail?: string;

  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean()
  spIsPrimary?: boolean;
}

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

  @ApiPropertyOptional() @IsOptional() @IsEmail() @MaxLength(200)
  stdEmail?: string;

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

  @ApiPropertyOptional({ type: [StudentParentInputDto] })
  @IsOptional() @IsArray() @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => StudentParentInputDto)
  stdParents?: StudentParentInputDto[];
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

  @ApiPropertyOptional() @IsOptional() @IsEmail() @MaxLength(200)
  stdEmail?: string;

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

  @ApiPropertyOptional({ type: [StudentParentInputDto] })
  @IsOptional() @IsArray() @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => StudentParentInputDto)
  stdParents?: StudentParentInputDto[];
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

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional() @IsIn(['asc', 'desc'])
  dir?: 'asc' | 'desc';
}
