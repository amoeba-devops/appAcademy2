import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export const SBM_EXAM_TYPES = ['MAP', 'ISEE', 'SSAT'] as const;
export const SBM_DATA_STATUSES = ['COMPLETE', 'INHERITED_FROM', 'PLACEHOLDER'] as const;
export const SBG_CURRICULUM_SYSTEMS = ['UK_YEAR', 'US_GRADE', 'KOREAN', 'MIXED'] as const;
export const SBF_MODIFIER_TYPES = ['FOREIGN_SCHOOL', 'INTERNATIONAL_BOARDING', 'OTHER'] as const;
export const SBF_UNITS = ['POINTS', 'PERCENTILE'] as const;

export class BenchmarkGradeDto {
  @ApiProperty() @IsString() @Length(1, 10)
  gradeLabel!: string;

  @ApiProperty() @IsInt() @Min(-2) @Max(12)
  gradeMin!: number;

  @ApiProperty() @IsInt() @Min(-2) @Max(12)
  gradeMax!: number;

  @ApiPropertyOptional({ enum: SBG_CURRICULUM_SYSTEMS })
  @IsOptional()
  @IsEnum(SBG_CURRICULUM_SYSTEMS)
  curriculumSystem?: (typeof SBG_CURRICULUM_SYSTEMS)[number];
}

export class CreateScoreBenchmarkDto {
  @ApiProperty()
  @IsString()
  @Matches(/^[A-Z0-9_]{3,50}$/, { message: 'VAL_REF_CODE_FORMAT' })
  code!: string;

  @ApiProperty({ enum: SBM_EXAM_TYPES }) @IsEnum(SBM_EXAM_TYPES)
  examType!: (typeof SBM_EXAM_TYPES)[number];

  @ApiProperty() @IsString() @Length(1, 50)
  levelLabel!: string;

  // MAP-only
  @ApiPropertyOptional() @IsOptional() @IsNumber({ maxDecimalPlaces: 1 }) @Min(100) @Max(300)
  mapReadingScore?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber({ maxDecimalPlaces: 1 }) @Min(100) @Max(300)
  mapMathScore?: number;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  mapNoUpperBound?: boolean;

  // ISEE/SSAT
  @ApiPropertyOptional() @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100)
  generalPct?: number;

  @ApiPropertyOptional() @IsOptional() @Matches(/^\d(-\d)?$/, { message: 'VAL_STANINE_FORMAT' })
  generalStanine?: string;

  @ApiPropertyOptional() @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100)
  premiumPrivatePct?: number;

  @ApiPropertyOptional() @IsOptional() @Matches(/^\d(-\d)?$/, { message: 'VAL_STANINE_FORMAT' })
  premiumPrivateStanine?: string;

  @ApiPropertyOptional() @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100)
  topBoardingPct?: number;

  @ApiPropertyOptional() @IsOptional() @Matches(/^\d(-\d)?$/, { message: 'VAL_STANINE_FORMAT' })
  topBoardingStanine?: string;

  @ApiPropertyOptional({ enum: SBM_DATA_STATUSES })
  @IsOptional()
  @IsEnum(SBM_DATA_STATUSES)
  dataStatus?: (typeof SBM_DATA_STATUSES)[number];

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  inheritsFromSbmId?: string;

  @ApiProperty({ description: 'ISO date' }) @IsDateString()
  effectiveFrom!: string;

  @ApiProperty({ type: [BenchmarkGradeDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => BenchmarkGradeDto)
  grades!: BenchmarkGradeDto[];
}

export class UpdateScoreBenchmarkDto extends PartialType(CreateScoreBenchmarkDto) {}

export class CreateScoreBenchmarkModifierDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID()
  sbmId?: string;

  @ApiProperty({ enum: SBF_MODIFIER_TYPES }) @IsEnum(SBF_MODIFIER_TYPES)
  modifierType!: (typeof SBF_MODIFIER_TYPES)[number];

  @ApiProperty() @IsNumber({ maxDecimalPlaces: 1 })
  adjustmentMin!: number;

  @ApiProperty() @IsNumber({ maxDecimalPlaces: 1 })
  adjustmentMax!: number;

  @ApiPropertyOptional({ enum: SBF_UNITS }) @IsOptional() @IsEnum(SBF_UNITS)
  unit?: (typeof SBF_UNITS)[number];

  @ApiPropertyOptional() @IsOptional() @IsString()
  description?: string;

  @ApiProperty({ description: 'ISO date' }) @IsDateString()
  effectiveFrom!: string;
}

export class GapAnalysisRequestDto {
  @ApiProperty({ enum: SBM_EXAM_TYPES }) @IsEnum(SBM_EXAM_TYPES)
  examType!: (typeof SBM_EXAM_TYPES)[number];

  @ApiProperty() @IsInt() @Min(-2) @Max(12)
  grade!: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber()
  scoreReading?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber()
  scoreMath?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber({ maxDecimalPlaces: 2 })
  percentile?: number;

  @ApiPropertyOptional({ description: 'ISO date; default now' })
  @IsOptional()
  @IsDateString()
  asOfDate?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  applyForeignSchoolModifier?: boolean;
}
