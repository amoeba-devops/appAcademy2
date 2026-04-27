import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';

export const LVL_EXAM_TYPES = ['ISEE_LEVEL_TEST', 'SSAT_LEVEL_TEST', 'OTHER'] as const;
export const LVL_GRADE_BASES = ['TARGET_GRADE', 'CURRENT_GRADE'] as const;
export const LVL_RESOURCE_TYPES = ['DRIVE_FOLDER', 'EXTERNAL_LINK', 'INTERNAL_DOC'] as const;

export class ProcedureStepDto {
  @ApiProperty() @IsInt() @Min(1)
  step_num!: number;

  @ApiProperty() @IsString() @Length(1, 1000)
  description!: string;
}

export class CreateLevelTestGuideDto {
  @ApiProperty({ enum: LVL_EXAM_TYPES }) @IsEnum(LVL_EXAM_TYPES)
  examType!: (typeof LVL_EXAM_TYPES)[number];

  @ApiProperty({ enum: LVL_GRADE_BASES }) @IsEnum(LVL_GRADE_BASES)
  gradeBasis!: (typeof LVL_GRADE_BASES)[number];

  @ApiPropertyOptional() @IsOptional() @IsString()
  assignmentRuleText?: string;

  @ApiPropertyOptional() @IsOptional() @IsUrl({ require_protocol: true })
  resourceUrl?: string;

  @ApiPropertyOptional({ enum: LVL_RESOURCE_TYPES })
  @IsOptional()
  @IsEnum(LVL_RESOURCE_TYPES)
  resourceType?: (typeof LVL_RESOURCE_TYPES)[number];

  @ApiPropertyOptional() @IsOptional() @IsString()
  resourceNote?: string;

  @ApiPropertyOptional({ type: [ProcedureStepDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProcedureStepDto)
  procedureSteps?: ProcedureStepDto[];

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1)
  defaultDurationMin?: number;

  @ApiProperty({ description: 'ISO date' }) @IsDateString()
  effectiveFrom!: string;
}

export class UpdateLevelTestGuideDto extends PartialType(CreateLevelTestGuideDto) {}
