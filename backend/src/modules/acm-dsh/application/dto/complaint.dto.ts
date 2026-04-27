import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export const COMPLAINT_CHANNELS = ['PHONE', 'EMAIL', 'CHAT', 'IN_PERSON', 'OTHER'] as const;
export const COMPLAINT_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;

export class CreateComplaintDto {
  @ApiProperty({ example: '2026-04-26' })
  @IsISO8601()
  date!: string;

  @ApiProperty({ enum: COMPLAINT_CHANNELS })
  @IsEnum(COMPLAINT_CHANNELS)
  channel!: (typeof COMPLAINT_CHANNELS)[number];

  @ApiPropertyOptional({ enum: COMPLAINT_SEVERITIES, default: 'MEDIUM' })
  @IsOptional()
  @IsEnum(COMPLAINT_SEVERITIES)
  severity?: (typeof COMPLAINT_SEVERITIES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  linkedQnaId?: string;
}

export class UpdateComplaintDto {
  @ApiPropertyOptional({ enum: COMPLAINT_CHANNELS })
  @IsOptional()
  @IsEnum(COMPLAINT_CHANNELS)
  channel?: (typeof COMPLAINT_CHANNELS)[number];

  @ApiPropertyOptional({ enum: COMPLAINT_SEVERITIES })
  @IsOptional()
  @IsEnum(COMPLAINT_SEVERITIES)
  severity?: (typeof COMPLAINT_SEVERITIES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  linkedQnaId?: string;
}
