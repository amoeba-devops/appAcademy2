import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const MANUAL_INPUT_STATUSES = ['PENDING', 'PARTIAL', 'COMPLETE'] as const;
export const MANUAL_INPUT_SITES = ['TPI', 'TRINITY', 'SANTACROCE'] as const;

export class UpsertManualInputDto {
  /** PLN-260914B — site row; omit for the tenant-level (공통) row. */
  @ApiPropertyOptional({ enum: MANUAL_INPUT_SITES })
  @IsOptional()
  @IsEnum(MANUAL_INPUT_SITES)
  site?: (typeof MANUAL_INPUT_SITES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  marketingVisitor?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000000000)
  marketingCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  marketingEffect?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  csComplain?: number;

  @ApiPropertyOptional({ enum: MANUAL_INPUT_STATUSES })
  @IsOptional()
  @IsEnum(MANUAL_INPUT_STATUSES)
  status?: (typeof MANUAL_INPUT_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  visitorSource?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  costSource?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class MonthQueryDto {
  @ApiProperty({ example: '2026-04' })
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'yearMonth must be YYYY-MM' })
  yearMonth!: string;
}

export class DateQueryDto {
  @ApiProperty({ example: '2026-04-26' })
  @IsISO8601()
  date!: string;
}
