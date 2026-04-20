import {
  IsString,
  IsOptional,
  IsInt,
  IsEnum,
  MaxLength,
  Min,
  Max,
  IsNumber,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateProgramSettingDto {
  @ApiPropertyOptional({ description: 'Fee amount', example: '350000' })
  @IsOptional()
  @IsString()
  feeAmount?: string;

  @ApiPropertyOptional({ description: 'Fee currency', example: 'KRW' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  feeCurrency?: string;

  @ApiPropertyOptional({ description: 'Max capacity', example: 15 })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacityMax?: number;

  @ApiPropertyOptional({ description: 'Total session count', example: 24 })
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

export class CreateProgramDto {
  @ApiProperty({ description: 'Program name', example: 'RC Master 중등반' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Category',
    enum: ['ENGLISH', 'MATH', 'SCIENCE', 'OTHER'],
    example: 'ENGLISH',
  })
  @IsEnum(['ENGLISH', 'MATH', 'SCIENCE', 'OTHER'])
  category: string;

  @ApiPropertyOptional({ description: 'Description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Duration in weeks', example: 12 })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationWeeks?: number;

  @ApiPropertyOptional({ description: 'Min target age', example: 13 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  targetAgeMin?: number;

  @ApiPropertyOptional({ description: 'Max target age', example: 15 })
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

  @ApiPropertyOptional({ description: 'Program settings', type: CreateProgramSettingDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateProgramSettingDto)
  setting?: CreateProgramSettingDto;
}
