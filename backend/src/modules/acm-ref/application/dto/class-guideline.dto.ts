import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

export const CGD_EXAM_TYPES = [
  'MAP_TEST',
  'SSAT',
  'ISEE',
  'WRITING_COMP',
  'SUMMER_CAMP',
  'JUNIOR_BOARDING',
  'BOARDING',
  'INTL_SCHOOL_APP',
  'OTHER',
] as const;

export const CGD_DATA_STATUSES = ['COMPLETE', 'PARTIAL', 'PLACEHOLDER'] as const;

export const CGD_STEP_ROLES = [
  'ADVISOR',
  'TEAM_LEAD',
  'TEACHER',
  'SENIOR_MANAGER',
  'ADMIN',
  'OTHER',
] as const;

export class WorkflowStepDto {
  @ApiProperty() @IsInt() @Min(1)
  step_num!: number;

  @ApiProperty({ enum: CGD_STEP_ROLES }) @IsEnum(CGD_STEP_ROLES)
  role!: (typeof CGD_STEP_ROLES)[number];

  @ApiProperty() @IsString() @Length(1, 1000)
  description!: string;
}

export class CreateClassGuidelineDto {
  @ApiProperty()
  @IsString()
  @Matches(/^[A-Z0-9_]{3,50}$/, { message: 'VAL_REF_CODE_FORMAT' })
  code!: string;

  @ApiProperty({ enum: CGD_EXAM_TYPES }) @IsEnum(CGD_EXAM_TYPES)
  examType!: (typeof CGD_EXAM_TYPES)[number];

  @ApiProperty() @IsString() @Length(1, 200)
  labelKr!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 200)
  labelEn?: string;

  @ApiPropertyOptional({ type: [WorkflowStepDto] })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => WorkflowStepDto)
  workflowSteps?: WorkflowStepDto[];

  @ApiPropertyOptional() @IsOptional() @IsString()
  remark?: string;

  @ApiPropertyOptional({ enum: CGD_DATA_STATUSES })
  @IsOptional()
  @IsEnum(CGD_DATA_STATUSES)
  dataStatus?: (typeof CGD_DATA_STATUSES)[number];

  @ApiProperty({ description: 'ISO date' }) @IsDateString()
  effectiveFrom!: string;
}

export class UpdateClassGuidelineDto extends PartialType(CreateClassGuidelineDto) {}
