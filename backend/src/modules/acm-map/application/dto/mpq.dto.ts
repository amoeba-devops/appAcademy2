import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export const MPQ_GRADES = ['G2', 'G3', 'G4'] as const;
export const MPQ_STATUSES = ['PUBLISHED', 'DRAFT', 'ARCHIVED'] as const;
export const MPQ_DIFFICULTIES = ['BASIC', 'INTERMEDIATE', 'ADVANCED'] as const;

export class CreateMpqDto {
  @ApiProperty({ enum: MPQ_GRADES }) @IsIn(MPQ_GRADES)
  mpqGrade!: typeof MPQ_GRADES[number];

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1)
  @Type(() => Number)
  mpqExternalNo?: number;

  @ApiProperty() @IsString()
  mpgBody!: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  mpgGlossary?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  mpgPairBody?: string;

  @ApiProperty() @IsString()
  mpqQuestion!: string;

  @ApiProperty({ type: [String] })
  @IsArray() @ArrayMinSize(4) @ArrayMaxSize(4) @IsString({ each: true })
  mpqChoices!: string[];

  @ApiPropertyOptional({ minimum: 0, maximum: 3, nullable: true })
  @IsOptional() @ValidateIf((_o, v) => v !== null) @IsInt() @Min(0) @Max(3)
  @Type(() => Number)
  mpqAnswerIndex?: number | null;

  @ApiPropertyOptional() @IsOptional() @IsString()
  mpqExplanation?: string;

  @ApiPropertyOptional({ enum: MPQ_DIFFICULTIES, default: 'INTERMEDIATE' })
  @IsOptional() @IsEnum(MPQ_DIFFICULTIES)
  mpqDifficulty?: typeof MPQ_DIFFICULTIES[number];

  @ApiPropertyOptional({ enum: MPQ_STATUSES })
  @IsOptional() @IsEnum(MPQ_STATUSES)
  mpqStatus?: typeof MPQ_STATUSES[number];

  @ApiPropertyOptional({ default: 'MAP_RC_G2-4_PAST' })
  @IsOptional() @IsString() @MaxLength(40)
  mpqSource?: string;
}

export class UpdateMpqDto {
  @ApiPropertyOptional({ enum: MPQ_GRADES }) @IsOptional() @IsIn(MPQ_GRADES)
  mpqGrade?: typeof MPQ_GRADES[number];

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1)
  @Type(() => Number)
  mpqExternalNo?: number;

  @ApiPropertyOptional() @IsOptional() @IsString()
  mpgBody?: string;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString()
  mpgGlossary?: string | null;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString()
  mpgPairBody?: string | null;

  @ApiPropertyOptional() @IsOptional() @IsString()
  mpqQuestion?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @ArrayMinSize(4) @ArrayMaxSize(4) @IsString({ each: true })
  mpqChoices?: string[];

  @ApiPropertyOptional({ minimum: 0, maximum: 3, nullable: true })
  @IsOptional() @ValidateIf((_o, v) => v !== null) @IsInt() @Min(0) @Max(3)
  @Type(() => Number)
  mpqAnswerIndex?: number | null;

  @ApiPropertyOptional() @IsOptional() @IsString()
  mpqExplanation?: string;

  @ApiPropertyOptional({ enum: MPQ_DIFFICULTIES })
  @IsOptional() @IsEnum(MPQ_DIFFICULTIES)
  mpqDifficulty?: typeof MPQ_DIFFICULTIES[number];

  @ApiPropertyOptional({ enum: MPQ_STATUSES })
  @IsOptional() @IsEnum(MPQ_STATUSES)
  mpqStatus?: typeof MPQ_STATUSES[number];
}

export class PatchMpqAnswerDto {
  @ApiProperty({ minimum: 0, maximum: 3, nullable: true })
  @ValidateIf((_o, v) => v !== null)
  @IsInt() @Min(0) @Max(3)
  @Type(() => Number)
  answerIndex!: number | null;
}

export class ListMpqQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: [...MPQ_GRADES, 'ALL'] })
  @IsOptional() @IsIn([...MPQ_GRADES, 'ALL'])
  grade?: typeof MPQ_GRADES[number] | 'ALL';

  @ApiPropertyOptional({ enum: ['ALL', 'YES', 'NO'] })
  @IsOptional() @IsIn(['ALL', 'YES', 'NO'])
  hasAnswer?: 'ALL' | 'YES' | 'NO';

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional() @Type(() => Boolean) @IsBoolean()
  paired?: boolean;

  @ApiPropertyOptional({ enum: [...MPQ_STATUSES, 'ALL'] })
  @IsOptional() @IsIn([...MPQ_STATUSES, 'ALL'])
  status?: typeof MPQ_STATUSES[number] | 'ALL';

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(200)
  @Type(() => Number)
  limit?: number;
}

export interface MpqImportResult {
  inserted: number;
  updated: number;
  errors: Array<{ row: number; message: string }>;
  total: number;
}
