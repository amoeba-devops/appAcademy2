import {
  IsString,
  IsOptional,
  IsInt,
  IsEnum,
  MaxLength,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateProgramSettingDto {
  @ApiPropertyOptional({ description: 'Fee amount' })
  @IsOptional()
  @IsString()
  feeAmount?: string;

  @ApiPropertyOptional({ description: 'Fee currency' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  feeCurrency?: string;

  @ApiPropertyOptional({ description: 'Max capacity' })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacityMax?: number;

  @ApiPropertyOptional({ description: 'Total session count' })
  @IsOptional()
  @IsInt()
  @Min(1)
  sessionCount?: number;

  @ApiPropertyOptional({ description: 'Material info (JSON)' })
  @IsOptional()
  materialInfo?: unknown;

  @ApiPropertyOptional({ description: 'Refund policy (JSON)' })
  @IsOptional()
  refundPolicy?: unknown;
}

export class UpdateProgramDto {
  @ApiPropertyOptional({ description: 'Program name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Category',
    enum: ['ENGLISH', 'MATH', 'SCIENCE', 'OTHER'],
  })
  @IsOptional()
  @IsEnum(['ENGLISH', 'MATH', 'SCIENCE', 'OTHER'])
  category?: string;

  @ApiPropertyOptional({ description: 'Description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Duration in weeks' })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationWeeks?: number;

  @ApiPropertyOptional({ description: 'Min target age' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  targetAgeMin?: number;

  @ApiPropertyOptional({ description: 'Max target age' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  targetAgeMax?: number;

  @ApiPropertyOptional({
    description: 'Level',
    enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'],
  })
  @IsOptional()
  @IsEnum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED'])
  level?: string;

  @ApiPropertyOptional({ description: 'Status', enum: ['DRAFT', 'ACTIVE', 'PUBLISHED', 'ARCHIVED'] })
  @IsOptional()
  @IsEnum(['DRAFT', 'ACTIVE', 'PUBLISHED', 'ARCHIVED'])
  status?: string;

  @ApiPropertyOptional({ description: 'Program settings', type: UpdateProgramSettingDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateProgramSettingDto)
  setting?: UpdateProgramSettingDto;
}
