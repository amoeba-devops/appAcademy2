import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Matches,
  IsInt,
  Min,
  Max,
  ValidateIf,
} from 'class-validator';

export const COMPLAINT_CHANNELS = [
  'PHONE',
  'EMAIL',
  'CHAT',
  'IN_PERSON',
  'OTHER',
] as const;
export const COMPLAINT_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;
export const COMPLAINT_SITES = ['TPI', 'TRINITY', 'SANTACROCE'] as const;

export class CreateComplaintDto {
  @ApiProperty({ example: '2026-04-26' })
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @ApiProperty({ enum: COMPLAINT_CHANNELS })
  @IsEnum(COMPLAINT_CHANNELS)
  channel!: (typeof COMPLAINT_CHANNELS)[number];

  @ApiPropertyOptional({ enum: COMPLAINT_SEVERITIES, default: 'MEDIUM' })
  @ValidateIf((_, value) => value !== undefined)
  @IsEnum(COMPLAINT_SEVERITIES)
  severity?: (typeof COMPLAINT_SEVERITIES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  linkedQnaId?: string | null;

  /** PLN-260914B — site attribution; omit = 공통 */
  @ApiPropertyOptional({ enum: COMPLAINT_SITES })
  @IsOptional()
  @IsEnum(COMPLAINT_SITES)
  site?: (typeof COMPLAINT_SITES)[number] | null;
}

export class UpdateComplaintDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;

  @IsISO8601({ strict: true })
  expectedUpdatedAt!: string;

  @ApiPropertyOptional({ enum: COMPLAINT_SITES })
  @IsOptional()
  @IsEnum(COMPLAINT_SITES)
  site?: (typeof COMPLAINT_SITES)[number] | null;

  @ApiPropertyOptional({ enum: COMPLAINT_CHANNELS })
  @ValidateIf((_, value) => value !== undefined)
  @IsEnum(COMPLAINT_CHANNELS)
  channel?: (typeof COMPLAINT_CHANNELS)[number];

  @ApiPropertyOptional({ enum: COMPLAINT_SEVERITIES })
  @ValidateIf((_, value) => value !== undefined)
  @IsEnum(COMPLAINT_SEVERITIES)
  severity?: (typeof COMPLAINT_SEVERITIES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  linkedQnaId?: string | null;
}

export class SearchComplaintsDto {
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from!: string;
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to!: string;
  @IsOptional()
  @IsEnum(['ALL', 'COMMON', ...COMPLAINT_SITES])
  site?: string;
  @IsOptional()
  @IsEnum(COMPLAINT_CHANNELS)
  channel?: string;
  @IsOptional()
  @IsEnum(COMPLAINT_SEVERITIES)
  severity?: string;
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
